import https from 'node:https';

const SIMPLELOGIN_BASE_URL = 'https://app.simplelogin.io/api';

function getApiKey() {
  return process.env.SIMPLELOGIN_API_KEY || '';
}

function getHeaders() {
  return {
    'Authentication': getApiKey(),
    'Content-Type': 'application/json',
    'User-Agent': 'NaijaAlias-Next/1.0',
  };
}

/**
 * Robust fetch wrapper using node:https with family: 4
 * Guarantees zero IPv6 NAT64 timeout issues on Linux and serverless environments.
 */
function slFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
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
        family: 4, // Force IPv4 to prevent dual-stack ETIMEDOUT
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
        req.destroy(new Error('SimpleLogin request timed out after 20s'));
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

export async function getUserInfo() {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/user_info`);
    if (!res.ok) {
      if (res.status === 429) {
        return { error: 'Rate limit exceeded', status: 429 };
      }
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('SimpleLogin getUserInfo error:', err.message);
    return null;
  }
}

export async function getActiveAliases() {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/v2/aliases?page_id=0`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.aliases || [];
  } catch (err) {
    console.error('SimpleLogin getActiveAliases error:', err.message);
    return [];
  }
}

export async function getOptions() {
  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/v5/alias/options`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function getDefaultMailboxId() {
  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/mailboxes`);
    if (!res.ok) return null;
    const data = await res.json();
    const mailboxes = data.mailboxes || [];
    const def = mailboxes.find(m => m.default);
    if (def) return def.id;
    if (mailboxes.length > 0) return mailboxes[0].id;
    return null;
  } catch (err) {
    return null;
  }
}

export async function createNameAlias({ firstName, lastName, fullName, note }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'SimpleLogin API key is missing' };
  }

  const options = await getOptions();
  const mailboxId = await getDefaultMailboxId();

  const cleanFirst = (firstName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanLast = (lastName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  if (options && options.can_create && options.suffixes && options.suffixes.length > 0 && mailboxId) {
    const signedSuffix = options.suffixes[0].signed_suffix;
    const prefixes = [
      `${cleanFirst}.${cleanLast}`,
      `${cleanFirst}.${cleanLast}.${Math.floor(Math.random() * 90 + 10)}`
    ];

    for (const prefix of prefixes) {
      try {
        const payload = {
          alias_prefix: prefix,
          signed_suffix: signedSuffix,
          mailbox_ids: [mailboxId],
          note: note || fullName,
          name: fullName,
        };

        const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/v3/alias/custom/new`, {
          method: 'POST',
          body: payload
        });

        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          return {
            success: true,
            id: String(data.id),
            alias: data.email,
            provider: 'simplelogin'
          };
        }

        if (res.status === 429) {
          return {
            success: false,
            isRateLimit: true,
            error: 'SimpleLogin rate limit exceeded (5 aliases per minute). Please wait 60s.'
          };
        }

        if (res.status === 409) {
          // Conflict / taken prefix, try next disambiguated prefix
          continue;
        }
      } catch (err) {
        console.error('Error creating custom alias prefix:', err.message);
      }
    }
  }

  // Fallback to random alias
  return await createRandomAlias({ note, fullName });
}

export async function createRandomAlias({ note, fullName }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'SimpleLogin API key is missing' };
  }

  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/alias/random/new`, {
      method: 'POST',
      body: { note: note || fullName }
    });

    if (res.status === 429) {
      return {
        success: false,
        isRateLimit: true,
        error: 'SimpleLogin rate limit exceeded (5 aliases per minute). Please wait 60s.'
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const aliasId = String(data.id);
    const aliasEmail = data.email;

    // Attach display name if available
    if (fullName) {
      try {
        await slFetch(`${SIMPLELOGIN_BASE_URL}/aliases/${aliasId}`, {
          method: 'PATCH',
          body: { name: fullName }
        });
      } catch (e) {
        // non-blocking
      }
    }

    return {
      success: true,
      id: aliasId,
      alias: aliasEmail,
      provider: 'simplelogin'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteAlias(aliasId) {
  const apiKey = getApiKey();
  if (!apiKey || !aliasId) return false;

  try {
    const res = await slFetch(`${SIMPLELOGIN_BASE_URL}/aliases/${aliasId}`, {
      method: 'DELETE'
    });

    if (res.status === 200 || res.status === 204) {
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error deleting alias ${aliasId}:`, err.message);
    return false;
  }
}
