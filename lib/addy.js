import https from 'node:https';

const ADDY_BASE_URL = 'https://app.addy.io/api/v1';

function getApiKey() {
  return process.env.ANONADDR_API_KEY || '';
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'NaijaAlias-Next/1.0',
    'Accept': 'application/json'
  };
}

/**
 * Robust fetch wrapper using node:https with family: 4
 */
function addyFetch(path, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return resolve({ ok: false, status: 401, json: async () => ({ error: 'Missing addy.io API key' }) });
      }

      const fullUrl = path.startsWith('http') ? path : `${ADDY_BASE_URL}${path}`;
      const u = new URL(fullUrl);
      const reqHeaders = {
        ...getHeaders(),
        ...(options.headers || {})
      };

      const req = https.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: reqHeaders,
        family: 4, // Force IPv4
        timeout: 20000
      }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              try { return JSON.parse(data); } catch (e) { return {}; }
            },
            text: async () => data,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('addy.io request timed out after 20s'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        const bodyData = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
        req.write(bodyData);
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function getAccountDetails() {
  try {
    const res = await addyFetch('/account-details');
    if (!res.ok) return null;
    const body = await res.json();
    return body.data || null;
  } catch (err) {
    console.error('addy.io getAccountDetails error:', err.message);
    return null;
  }
}

export async function getDomainOptions() {
  try {
    const res = await addyFetch('/domain-options');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('addy.io getDomainOptions error:', err.message);
    return null;
  }
}

export async function getActiveAliases() {
  try {
    const res = await addyFetch('/aliases');
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch (err) {
    console.error('addy.io getActiveAliases error:', err.message);
    return [];
  }
}

export async function createNameAlias({ firstName, lastName, fullName, note }) {
  try {
    const account = await getAccountDetails();
    const username = account?.username || 'uniben';

    const cleanFirst = (firstName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanLast = (lastName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Strategy 1: Create on user domain (e.g. adeyemi.balogun@uniben.anonaddy.me)
    // Username domain aliases on addy.io free plan have NO 10-alias limit!
    const localPartVariants = [
      `${cleanFirst}.${cleanLast}`,
      `${cleanFirst}.${cleanLast}.${Math.floor(Math.random() * 90 + 10)}`,
      `${cleanFirst}_${cleanLast}`
    ];

    const userDomain = `${username}.anonaddy.me`;

    for (const localPart of localPartVariants) {
      const res = await addyFetch('/aliases', {
        method: 'POST',
        body: {
          domain: userDomain,
          format: 'custom',
          local_part: localPart,
          description: note || fullName
        }
      });

      if (res.status === 201 || res.status === 200) {
        const body = await res.json();
        return {
          success: true,
          id: body.data.id,
          alias: body.data.email,
          domain: userDomain,
          provider: 'addy'
        };
      }
    }

    // Strategy 2: If user domain failed, fallback to shared domain (anonaddy.me) with random characters
    const sharedRes = await addyFetch('/aliases', {
      method: 'POST',
      body: {
        domain: 'anonaddy.me',
        description: note || fullName
      }
    });

    if (sharedRes.status === 201 || sharedRes.status === 200) {
      const body = await sharedRes.json();
      return {
        success: true,
        id: body.data.id,
        alias: body.data.email,
        domain: 'anonaddy.me',
        provider: 'addy'
      };
    }

    const errBody = await sharedRes.json();
    return {
      success: false,
      error: errBody.message || 'Failed to create alias on addy.io'
    };
  } catch (err) {
    console.error('addy.io createNameAlias error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteAlias(aliasId) {
  if (!aliasId) return false;
  try {
    const res = await addyFetch(`/aliases/${aliasId}`, {
      method: 'DELETE'
    });
    return res.status === 204 || res.status === 200;
  } catch (err) {
    console.error(`addy.io deleteAlias ${aliasId} error:`, err.message);
    return false;
  }
}
