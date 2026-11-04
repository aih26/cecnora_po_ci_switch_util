const axios = require('axios');
const xpath = require('xpath');
const { DOMParser } = require('@xmldom/xmldom');
const https = require('https');
const store = require('../store');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getPoSettings() {
  const rows = await store.find('settings');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

async function getDefaultPoSystem() {
  const systems = await store.find('po_systems');
  if (systems.length) return systems[0];
  // Legacy fallback from flat settings
  const s = await getPoSettings();
  return {
    id: '__legacy__',
    host: s.po_host || '',
    port: s.po_port || '50000',
    https_port: s.po_https_port || '50001',
    username: s.po_username || '',
    password: s.po_password || '',
    use_https: s.po_use_https || 'false'
  };
}

function buildUrl(template, sys, params = {}) {
  const useHttps = sys.use_https === 'true';
  const scheme = useHttps ? 'https' : 'http';
  const host = (sys.host || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let url = template
    .replace(/\{\{po_scheme\}\}/g, scheme)
    .replace(/\{\{po_host\}\}/g,   host)
    .replace(/\{\{po_port\}\}/g,   useHttps ? (sys.https_port || '50001') : (sys.port || '50000'));
  Object.entries(params).forEach(([k, v]) => {
    url = url.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
  });
  return url;
}

function fillTemplate(template, params) {
  let body = template;
  Object.entries(params).forEach(([k, v]) => {
    body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
  });
  return body;
}

function extractXPath(xmlString, expression) {
  try {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const nodes = xpath.select(expression, doc);
    if (!nodes || nodes.length === 0) return null;
    const n = nodes[0];
    return typeof n === 'string' ? n : (n.nodeValue || n.textContent || null);
  } catch { return null; }
}

function decodeXmlEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,           (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

async function callPoApi(apiConfig, poSystem, params) {
  if (!poSystem) poSystem = await getDefaultPoSystem();
  const url  = buildUrl(apiConfig.url_template, poSystem, params);
  const body = apiConfig.request_template ? fillTemplate(apiConfig.request_template, params) : undefined;
  const headers = { 'Content-Type': apiConfig.content_type || 'text/xml; charset=utf-8' };
  if (apiConfig.soap_action) headers['SOAPAction'] = apiConfig.soap_action;

  const response = await axios({
    method:  apiConfig.method || 'POST',
    url, data: body, headers,
    auth: { username: poSystem.username || '', password: poSystem.password || '' },
    timeout: 15000,
    httpsAgent,
    validateStatus: () => true
  });

  const xml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const mappings = Array.isArray(apiConfig.response_mappings) ? apiConfig.response_mappings : [];
  const result = { _status: response.status, _raw: xml };

  if (response.status >= 200 && response.status < 300) {
    mappings.forEach(m => { result[m.name] = extractXPath(xml, m.path); });
    const adminErr = extractXPath(xml, '//*[local-name()="AdminErrorInformation"]/text()');
    if (adminErr && adminErr.trim()) {
      const decoded = decodeXmlEntities(adminErr.trim());
      result._error = decoded.split('\n')[0].replace(/^[\w.]+Exception:\s*/i, '').trim();
    }
  } else {
    const fault = extractXPath(xml, '//*[local-name()="faultstring"]/text()')
      || extractXPath(xml, '//*[local-name()="message"]/text()')
      || extractXPath(xml, '//*[local-name()="detail"]//text()');
    result._error = fault || `HTTP ${response.status}`;
  }
  return result;
}

module.exports = { getPoSettings, getDefaultPoSystem, buildUrl, fillTemplate, extractXPath, callPoApi };
