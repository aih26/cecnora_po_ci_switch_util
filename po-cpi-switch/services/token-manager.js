const axios = require('axios');
const https = require('https');
const store = require('../store');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Cache keyed by tenant ID: { [tenantId]: { access_token, expires_at, fetched_at } }
const _caches = {};

async function getDefaultCpiTenant() {
  const tenants = await store.find('cpi_tenants');
  if (tenants.length) return tenants[0];
  // Legacy fallback: read from flat settings
  const rows = await store.find('settings');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  if (s.cpi_token_url) {
    return { id: '__legacy__', host: s.cpi_host || '', token_url: s.cpi_token_url, client_id: s.cpi_client_id || '', client_secret: s.cpi_client_secret || '' };
  }
  return null;
}

async function fetchTokenForTenant(tenant) {
  const { token_url, client_id, client_secret } = tenant;
  if (!token_url || !client_id || !client_secret) {
    throw new Error('CPI OAuth2 not configured — set token URL, client ID and client secret in Systems & Mapping');
  }
  const params = new URLSearchParams({ grant_type: 'client_credentials' });
  const response = await axios.post(token_url, params.toString(), {
    auth: { username: client_id, password: client_secret },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
    httpsAgent
  });
  const { access_token, expires_in } = response.data;
  if (!access_token) throw new Error('Token response missing access_token');
  const cache = {
    access_token,
    expires_at: Date.now() + (parseInt(expires_in, 10) - 60) * 1000,
    fetched_at: new Date().toISOString()
  };
  _caches[tenant.id] = cache;
  return cache;
}

async function getToken(tenant) {
  if (!tenant) tenant = await getDefaultCpiTenant();
  if (!tenant) throw new Error('No CPI tenant configured');
  const cached = _caches[tenant.id];
  if (cached && cached.expires_at > Date.now()) return cached.access_token;
  return (await fetchTokenForTenant(tenant)).access_token;
}

function getTokenStatus(tenantId) {
  const cache = tenantId ? _caches[tenantId] : (Object.values(_caches)[0] || null);
  if (!cache) return { status: 'none', message: 'No token fetched yet' };
  if (cache.expires_at <= Date.now()) {
    return { status: 'expired', message: 'Token expired — will auto-refresh on next request', fetched_at: cache.fetched_at };
  }
  const ttlSec = Math.round((cache.expires_at - Date.now()) / 1000);
  const t = cache.access_token;
  const preview = t ? t.slice(0, 20) + '…' + t.slice(-8) : null;
  return { status: 'valid', message: 'Valid', fetched_at: cache.fetched_at, expires_in_sec: ttlSec, token_preview: preview };
}

function clearToken(tenantId) {
  if (tenantId) delete _caches[tenantId];
  else Object.keys(_caches).forEach(k => delete _caches[k]);
}

module.exports = { getToken, getTokenStatus, clearToken, getDefaultCpiTenant };
