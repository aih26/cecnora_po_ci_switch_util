const store = require('../store');
const { getToken, getDefaultCpiTenant } = require('./token-manager');
const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// CSRF cache per tenant ID: { [tenantId]: { token, cookies, fetchedAt } }
const _csrfCaches = {};

async function fetchCsrf(tenant) {
  const tenantId = tenant.id || '__legacy__';
  const now = Date.now();
  const cached = _csrfCaches[tenantId];
  if (cached && (now - cached.fetchedAt) < 25 * 60 * 1000) return cached;
  const cpiHost = (tenant.host || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const token = await getToken(tenant);
  const resp = await axios.get(`https://${cpiHost}/api/v1`, {
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': 'Fetch' },
    httpsAgent, validateStatus: () => true, timeout: 10000
  });
  const csrfToken = resp.headers['x-csrf-token'] || null;
  const cookieHeader = (resp.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  _csrfCaches[tenantId] = { token: csrfToken, cookies: cookieHeader, fetchedAt: now };
  return _csrfCaches[tenantId];
}

function resolveUrl(template, tenant, params = {}) {
  const cpiHost = (tenant.host || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let url = template
    .replace(/\{\{cpi_host\}\}/g, cpiHost)
    .replace(/\{\{cpi_token_url\}\}/g, tenant.token_url || '');
  Object.entries(params).forEach(([k, v]) => {
    url = url.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), encodeURIComponent(v || ''));
  });
  url = url.replace(/%27/g, "'");
  return url;
}

function getJsonPath(obj, path) {
  try {
    const keys = path.replace(/^\$\./, '').split(/[\.\[\]]+/).filter(Boolean);
    let cur = obj;
    for (const k of keys) {
      if (cur === null || cur === undefined) return null;
      cur = isNaN(k) ? cur[k] : cur[parseInt(k, 10)];
    }
    return cur ?? null;
  } catch { return null; }
}

async function callCpiApi(apiConfig, cpiTenant, params = {}) {
  if (!cpiTenant) cpiTenant = await getDefaultCpiTenant();
  if (!cpiTenant) throw new Error('No CPI tenant configured');
  const url = resolveUrl(apiConfig.url_template, cpiTenant, params);
  const token = await getToken(cpiTenant);

  const method = (apiConfig.method || 'GET').toUpperCase();

  let csrfHeaders = {};
  if (['DELETE', 'PUT', 'PATCH', 'POST'].includes(method)) {
    const csrf = await fetchCsrf(cpiTenant);
    if (csrf.token) csrfHeaders = { 'X-CSRF-Token': csrf.token, Cookie: csrf.cookies };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...csrfHeaders,
    ...(apiConfig.content_type ? { 'Content-Type': apiConfig.content_type } : {})
  };

  let data;
  if (apiConfig.request_template) {
    try { data = JSON.parse(apiConfig.request_template); }
    catch { data = apiConfig.request_template || undefined; }
  }

  const response = await axios({
    method, url, headers, data, timeout: 20000,
    httpsAgent,
    validateStatus: () => true
  });

  const mappings = Array.isArray(apiConfig.response_mappings) ? apiConfig.response_mappings : [];
  const result = { _status: response.status, _raw: response.data };

  if (response.status >= 200 && response.status < 300) {
    mappings.forEach(m => { result[m.name] = getJsonPath(response.data, m.path); });
  } else {
    result._error = response.data?.error?.message?.value
      || response.data?.error?.message
      || `HTTP ${response.status}`;

    if (response.status === 404 && method === 'GET') {
      if (apiConfig.fallback_404_url) {
        const fbUrl = resolveUrl(apiConfig.fallback_404_url, cpiTenant, params);
        try {
          const fbResp = await axios.get(fbUrl, { headers, httpsAgent, validateStatus: () => true, timeout: 8000 });
          if (fbResp.status >= 200 && fbResp.status < 300) {
            result._undeployed = true;
          } else {
            result._not_found = true;
          }
        } catch {
          result._not_found = true;
        }
      } else {
        result._not_found = true;
      }
    }
  }
  return result;
}

module.exports = { callCpiApi, getJsonPath, resolveUrl };
