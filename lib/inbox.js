import https from 'node:https';

/**
 * Universal In-App Inbox Client
 * Primary: Mail.tm (Rock solid, works on Railway / Cloud datacenter IPs, full HTML body)
 * Fallback: GuerrillaMail
 * Zero custom domain needed.
 */

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(options.url);
      const reqOptions = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        timeout: 12000
      };

      if (postData) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(reqOptions, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed, raw: data });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Request to ${u.hostname} timed out after 12s`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ──────────────────────────────────────────────
// Engine 1: Mail.tm (Primary - High reliability on Cloud / Railway)
// ──────────────────────────────────────────────

async function getMailTmDomain() {
  try {
    const res = await httpRequest({ url: 'https://api.mail.tm/domains' });
    if (res.ok && res.data && res.data['hydra:member']) {
      const active = res.data['hydra:member'].find(d => d.isActive);
      return active ? active.domain : res.data['hydra:member'][0]?.domain;
    }
    return 'maxxspace.com';
  } catch (e) {
    return 'maxxspace.com';
  }
}

async function createMailTmAccount({ firstName, lastName, fullName, note }) {
  try {
    const domain = await getMailTmDomain();
    const cleanFirst = (firstName || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanLast = (lastName || 'alias').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const email = `${cleanFirst}.${cleanLast}.${rand}@${domain}`;
    const password = `SafePass!${Math.random().toString(36).substring(2, 9)}#99`;

    const postData = JSON.stringify({ address: email, password: password });

    const createRes = await httpRequest({
      url: 'https://api.mail.tm/accounts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, postData);

    if (createRes.status !== 201 && createRes.status !== 200) {
      return null;
    }

    // Get auth token
    const tokenRes = await httpRequest({
      url: 'https://api.mail.tm/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, postData);

    const token = tokenRes.data?.token;
    if (!token) return null;

    const aliasId = `inbox_mtm_${createRes.data.id || Date.now()}`;

    return {
      success: true,
      id: aliasId,
      alias: email,
      token: token,
      engine: 'mail.tm',
      provider: 'inbox',
      accountId: createRes.data.id,
      created_at: new Date().toISOString()
    };
  } catch (e) {
    console.error('Mail.tm creation error:', e.message);
    return null;
  }
}

async function checkMailTmMessages(token) {
  try {
    const res = await httpRequest({
      url: 'https://api.mail.tm/messages',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return [];
    const members = res.data?.['hydra:member'] || [];
    return members.map(m => ({
      id: m.id,
      from: m.from?.address || 'Unknown Sender',
      subject: m.subject || 'No Subject',
      excerpt: m.intro || '',
      date: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
      timestamp: m.createdAt ? Math.floor(new Date(m.createdAt).getTime() / 1000) : 0,
      hasFullBody: true
    }));
  } catch (e) {
    console.error('Mail.tm message list error:', e.message);
    return [];
  }
}

async function fetchMailTmMessageBody(token, messageId) {
  try {
    const res = await httpRequest({
      url: `https://api.mail.tm/messages/${messageId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok || !res.data) return null;

    const data = res.data;
    const htmlBody = Array.isArray(data.html) ? data.html.join('\n') : (data.html || data.text || '');

    return {
      id: data.id,
      from: data.from?.address || '',
      subject: data.subject || '',
      date: data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Recent',
      timestamp: data.createdAt ? Math.floor(new Date(data.createdAt).getTime() / 1000) : 0,
      body: htmlBody,
      textBody: data.text || '',
      excerpt: data.intro || '',
      contentType: 'html',
      recipient: data.to?.[0]?.address || ''
    };
  } catch (e) {
    console.error('Mail.tm message body error:', e.message);
    return null;
  }
}

// ──────────────────────────────────────────────
// Engine 2: GuerrillaMail (Fallback)
// ──────────────────────────────────────────────

async function createGuerrillaAccount({ firstName, lastName, fullName }) {
  try {
    const initRes = await httpRequest({ url: 'https://api.guerrillamail.com/ajax.php?f=get_email_address' });
    if (!initRes.data?.sid_token) return null;

    const sidToken = initRes.data.sid_token;
    const cleanFirst = (firstName || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanLast = (lastName || 'alias').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const emailUser = `${cleanFirst}.${cleanLast}.${randomSuffix}`;

    const setRes = await httpRequest({
      url: `https://api.guerrillamail.com/ajax.php?f=set_email_user&email_user=${encodeURIComponent(emailUser)}&lang=en&sid_token=${encodeURIComponent(sidToken)}`
    });

    const emailAddr = setRes.data?.email_addr || `${emailUser}@guerrillamailblock.com`;
    const aliasId = `inbox_gm_${Date.now()}`;

    return {
      success: true,
      id: aliasId,
      alias: emailAddr,
      token: sidToken,
      engine: 'guerrillamail',
      provider: 'inbox',
      created_at: new Date().toISOString()
    };
  } catch (e) {
    console.error('GuerrillaMail creation error:', e.message);
    return null;
  }
}

async function checkGuerrillaMessages(sidToken) {
  try {
    const res = await httpRequest({
      url: `https://api.guerrillamail.com/ajax.php?f=check_email&seq=0&sid_token=${encodeURIComponent(sidToken)}`
    });

    if (!res.data?.list) return [];
    return res.data.list.map(m => ({
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
  } catch (e) {
    return [];
  }
}

async function fetchGuerrillaMessageBody(sidToken, messageId) {
  try {
    const res = await httpRequest({
      url: `https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${encodeURIComponent(messageId)}&sid_token=${encodeURIComponent(sidToken)}`
    });

    if (!res.data || res.data.error) return null;
    return {
      id: String(res.data.mail_id || messageId),
      from: res.data.mail_from,
      subject: res.data.mail_subject,
      date: res.data.mail_date,
      timestamp: res.data.mail_timestamp,
      body: res.data.mail_body || '',
      excerpt: res.data.mail_excerpt || '',
      contentType: res.data.content_type || 'html',
      recipient: res.data.mail_recipient
    };
  } catch (e) {
    return null;
  }
}

// ──────────────────────────────────────────────
// Unified Export Functions (Auto-Fallback)
// ──────────────────────────────────────────────

export async function createInboxAlias({ firstName, lastName, fullName, note }) {
  // Strategy 1: Mail.tm (Primary - High reliability on Cloud / Railway)
  const mtm = await createMailTmAccount({ firstName, lastName, fullName, note });
  if (mtm && mtm.success) {
    return mtm;
  }

  // Strategy 2: GuerrillaMail (Fallback)
  const gm = await createGuerrillaAccount({ firstName, lastName, fullName });
  if (gm && gm.success) {
    return gm;
  }

  return {
    success: false,
    error: 'In-App inbox creation failed. External mail services were temporarily unreachable from this host.'
  };
}

export async function checkInboxMessages(token) {
  if (!token) return [];
  // Detect if token is JWT (Mail.tm) or session string (GuerrillaMail)
  if (token.startsWith('ey') || token.length > 50) {
    return await checkMailTmMessages(token);
  }
  return await checkGuerrillaMessages(token);
}

export async function fetchInboxMessageBody(token, messageId) {
  if (!token || !messageId) return null;
  if (token.startsWith('ey') || token.length > 50) {
    return await fetchMailTmMessageBody(token, messageId);
  }
  return await fetchGuerrillaMessageBody(token, messageId);
}
