import https from 'node:https';

const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php';

function gmFetch(params) {
  return new Promise((resolve, reject) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const u = new URL(`${GUERRILLA_BASE}?${qs}`);

      const req = https.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'NaijaAlias-Inbox/1.0',
          'Accept': 'application/json'
        },
        family: 4,
        timeout: 15000
      }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: 'Invalid JSON response', raw: data });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('GuerrillaMail request timed out after 15s'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates an instant in-app inbox alias with Nigerian identity
 * Requires zero custom domain and allows 100% full email body reading in-app.
 */
export async function createInboxAlias({ firstName, lastName, fullName, note }) {
  try {
    // Step 1: Initialize session
    const initData = await gmFetch({ f: 'get_email_address' });
    if (!initData.sid_token) {
      return { success: false, error: 'Could not initialize inbox session' };
    }

    const sidToken = initData.sid_token;
    const cleanFirst = (firstName || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanLast = (lastName || 'alias').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const randomSuffix = Math.floor(Math.random() * 900 + 100);

    const emailUser = `${cleanFirst}.${cleanLast}.${randomSuffix}`;

    // Step 2: Set Nigerian username
    const setUserData = await gmFetch({
      f: 'set_email_user',
      email_user: emailUser,
      lang: 'en',
      sid_token: sidToken
    });

    const emailAddr = setUserData.email_addr || `${emailUser}@guerrillamailblock.com`;
    const aliasId = `inbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      id: aliasId,
      alias: emailAddr,
      sid_token: sidToken,
      provider: 'inbox',
      email_user: emailUser,
      created_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('createInboxAlias error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch messages for a specific in-app alias by its session token
 */
export async function checkInboxMessages(sidToken) {
  if (!sidToken) return [];
  try {
    const data = await gmFetch({
      f: 'check_email',
      seq: '0',
      sid_token: sidToken
    });

    const list = data.list || [];
    return list.map(m => ({
      id: String(m.mail_id),
      from: m.mail_from,
      subject: m.mail_subject,
      excerpt: m.mail_excerpt,
      date: m.mail_date,
      timestamp: m.mail_timestamp,
      body: m.mail_body || '',
      contentType: m.content_type || 'text',
      hasFullBody: Boolean(m.mail_body)
    }));
  } catch (err) {
    console.error('checkInboxMessages error:', err.message);
    return [];
  }
}

/**
 * Fetch full body content of an email
 */
export async function fetchInboxMessageBody(sidToken, messageId) {
  if (!sidToken || !messageId) return null;
  try {
    const data = await gmFetch({
      f: 'fetch_email',
      email_id: String(messageId),
      sid_token: sidToken
    });

    if (!data || data.error) return null;

    return {
      id: String(data.mail_id || messageId),
      from: data.mail_from,
      subject: data.mail_subject,
      date: data.mail_date,
      timestamp: data.mail_timestamp,
      body: data.mail_body || '',
      excerpt: data.mail_excerpt || '',
      contentType: data.content_type || 'html',
      recipient: data.mail_recipient
    };
  } catch (err) {
    console.error('fetchInboxMessageBody error:', err.message);
    return null;
  }
}
