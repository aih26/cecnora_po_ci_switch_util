const express = require('express');
const router  = express.Router();
const store   = require('../store');
const { callPoApi, getDefaultPoSystem } = require('../services/po-service');
const { callCpiApi } = require('../services/cpi-service');
const { getDefaultCpiTenant } = require('../services/token-manager');

let _sem = null;
let _semLimit = 0;

async function getGlobalSem() {
  const settings = await store.find('settings');
  const parallelRows    = Math.max(1, parseInt(settings.find(s => s.key === 'parallel_rows')?.value    || '20', 10));
  const parallelBatches = Math.max(1, parseInt(settings.find(s => s.key === 'parallel_batches')?.value || '1',  10));
  const limit = parallelRows * parallelBatches * 10;
  if (!_sem || limit !== _semLimit) {
    _semLimit = limit;
    _sem = makeSemaphore(limit);
  }
  return _sem;
}

function makeSemaphore(limit) {
  let active = 0;
  const queue = [];
  return {
    async run(fn) {
      if (active < limit) {
        active++;
      } else {
        await new Promise(resolve => queue.push(resolve));
        active++;
      }
      try { return await fn(); }
      finally {
        active--;
        if (queue.length) queue.shift()();
      }
    }
  };
}

function resolveParams(inputMappings, mapping) {
  const params = {};
  Object.entries(inputMappings || {}).forEach(([k, v]) => {
    const match = String(v).match(/\{\{row\.(\w+)\}\}/);
    params[k] = match ? (mapping[match[1]] || '') : v;
  });
  return params;
}

async function resolveCredentials(system_mapping_id) {
  if (!system_mapping_id) {
    // No mapping context — use global defaults (legacy single-system mode)
    return {
      poSystem:  await getDefaultPoSystem(),
      cpiTenant: await getDefaultCpiTenant()
    };
  }

  let poSystem = null, cpiTenant = null;
  const sysMap = await store.findOne('system_mappings', { id: system_mapping_id });
  if (sysMap) {
    for (const side of ['a', 'b']) {
      const type = sysMap[`system_${side}_type`];
      const id   = sysMap[`system_${side}_id`];
      if (id) {
        if (type === 'po'  && !poSystem)  poSystem  = await store.findOne('po_systems',  { id });
        if (type === 'cpi' && !cpiTenant) cpiTenant = await store.findOne('cpi_tenants', { id });
      }
    }
    // Legacy field fallback — within this mapping's own record only, never global
    if (!poSystem   && sysMap.po_system_id)  poSystem   = await store.findOne('po_systems',  { id: sysMap.po_system_id });
    if (!cpiTenant  && sysMap.cpi_tenant_id) cpiTenant  = await store.findOne('cpi_tenants', { id: sysMap.cpi_tenant_id });
  }
  // When a specific mapping was requested, never fall back to a different system.
  // If a side is not configured for this mapping, return null for that side.
  return { poSystem, cpiTenant };
}

/*
 * POST /api/status/batch
 * Body: { ids, apiCols, system_mapping_id? }
 */
router.post('/batch', async (req, res) => {
  try {
    const { ids = [], apiCols = [], system_mapping_id } = req.body;
    if (!ids.length) return res.json({});

    const { poSystem, cpiTenant } = await resolveCredentials(system_mapping_id);
    const sem = await getGlobalSem();

    const mappings = (await Promise.all(ids.map(id => store.findOne('interface_mappings', { id })))).filter(Boolean);

    const uniqueApis = [];
    const seen = new Set();
    apiCols.forEach(c => {
      if (c.api_config_id && !seen.has(c.api_config_id)) {
        seen.add(c.api_config_id);
        uniqueApis.push(c);
      }
    });

    if (!uniqueApis.length) return res.json({});

    const allJobs = mappings.flatMap(m =>
      uniqueApis.map(apiCol => ({ m, apiCol }))
    );

    const allResults = await Promise.allSettled(
      allJobs.map(async ({ m, apiCol }) => {
        const apiConfig = await store.findOne('api_configs', { id: apiCol.api_config_id });
        if (!apiConfig) return { mappingId: m.id, apiId: apiCol.api_config_id, result: { _error: 'Config not found', _status: 404 } };
        // Enforce strict mapping — don't call a PO API if this mapping has no PO system configured
        if (apiConfig.system === 'PO' && !poSystem) {
          return { mappingId: m.id, apiId: apiCol.api_config_id, result: { _error: 'Not found', _status: 404 } };
        }
        if (apiConfig.system !== 'PO' && !cpiTenant) {
          return { mappingId: m.id, apiId: apiCol.api_config_id, result: { _error: 'Not found', _status: 404 } };
        }
        const params = resolveParams(apiCol.input_mappings, m);
        const result = await sem.run(() =>
          apiConfig.system === 'PO'
            ? callPoApi(apiConfig, poSystem, params)
            : callCpiApi(apiConfig, cpiTenant, params)
        );
        return { mappingId: m.id, apiId: apiCol.api_config_id, result };
      })
    );

    const response = {};
    allResults.forEach((r, i) => {
      const { m, apiCol } = allJobs[i];
      if (!response[m.id]) response[m.id] = {};
      const raw = r.status === 'fulfilled'
        ? r.value.result
        : { _error: r.reason?.message || 'failed', _status: 500 };
      const { _raw, ...clean } = raw;
      response[m.id][apiCol.api_config_id] = clean;
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function cacheDocId(smId) { return smId ? `sm_${smId}` : 'singleton'; }

/* GET /api/status/cache?sm_id=<system_mapping_id> */
router.get('/cache', async (req, res) => {
  const docId = cacheDocId(req.query.sm_id);
  const row = await store.findOne('status_cache', { id: docId });
  res.json(row ? { last_refresh_time: row.last_refresh_time, rows: row.rows || {} }
               : { last_refresh_time: null, rows: {} });
});

async function getMaxPayloadBytes() {
  const s = await store.findOne('settings', { key: 'max_payload_mb' });
  const mb = Math.max(1, parseInt(s?.value || '50', 10));
  return mb * 1024 * 1024;
}

function payloadBytes(body) {
  return Buffer.byteLength(JSON.stringify(body));
}

/* PUT /api/status/cache */
router.put('/cache', async (req, res) => {
  const { last_refresh_time, rows, system_mapping_id } = req.body;

  const maxBytes = await getMaxPayloadBytes();
  if (payloadBytes(req.body) > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return res.status(413).json({
      error: `Payload too large (limit: ${mb} MB). Increase "Max Payload Size" in Settings → General → Performance & Refresh and save, then retry.`
    });
  }

  const clean = {};
  for (const [rowId, apis] of Object.entries(rows || {})) {
    clean[rowId] = {};
    for (const [apiId, result] of Object.entries(apis || {})) {
      const { _raw, ...rest } = result;
      clean[rowId][apiId] = rest;
    }
  }
  await store.upsert('status_cache', 'id', { id: cacheDocId(system_mapping_id), last_refresh_time, rows: clean });
  res.json({ ok: true });
});

/* PATCH /api/status/cache/row/:id */
router.patch('/cache/row/:id', async (req, res) => {
  const { id } = req.params;
  const { apis, system_mapping_id } = req.body;

  const maxBytes = await getMaxPayloadBytes();
  if (payloadBytes(req.body) > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return res.status(413).json({
      error: `Payload too large (limit: ${mb} MB). Increase "Max Payload Size" in Settings → General → Performance & Refresh and save, then retry.`
    });
  }

  const cid = cacheDocId(system_mapping_id);
  const row = await store.findOne('status_cache', { id: cid });
  const rows = row ? { ...row.rows } : {};
  const clean = {};
  for (const [apiId, result] of Object.entries(apis || {})) {
    const { _raw, ...rest } = result;
    clean[apiId] = rest;
  }
  rows[id] = clean;
  await store.upsert('status_cache', 'id', {
    id: cid,
    last_refresh_time: row?.last_refresh_time || null,
    rows
  });
  res.json({ ok: true });
});

/* GET /api/status/backend */
router.get('/backend', (req, res) => {
  const backend = (process.env.DATA_BACKEND || 'file').toLowerCase();
  const info = { backend };
  if (backend === 'pg') {
    const url = process.env.DATABASE_URL || '';
    info.database_url = url.replace(/:[^:@]*@/, ':***@');
  }
  res.json(info);
});

module.exports = router;
