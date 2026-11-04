const express = require('express');
const router = express.Router();
const store = require('../store');
const { callCpiApi } = require('../services/cpi-service');
const { getTokenStatus, clearToken, getToken, getDefaultCpiTenant } = require('../services/token-manager');

async function getCpiTenantForMapping(mappingId) {
  const mapping = await store.findOne('interface_mappings', { id: mappingId });
  if (mapping?.system_mapping_id) {
    const sysMap = await store.findOne('system_mappings', { id: mapping.system_mapping_id });
    if (sysMap) {
      for (const side of ['a', 'b']) {
        if (sysMap[`system_${side}_type`] === 'cpi') {
          const tenant = await store.findOne('cpi_tenants', { id: sysMap[`system_${side}_id`] });
          if (tenant) return tenant;
        }
      }
      if (sysMap.cpi_tenant_id) {
        const tenant = await store.findOne('cpi_tenants', { id: sysMap.cpi_tenant_id });
        if (tenant) return tenant;
      }
    }
  }
  return getDefaultCpiTenant();
}

// GET token status (uses first/default tenant)
router.get('/token/status', (req, res) => {
  res.json(getTokenStatus());
});

// POST force token refresh (uses first/default tenant)
router.post('/token/refresh', async (req, res) => {
  try {
    clearToken();
    const tenant = await getDefaultCpiTenant();
    if (tenant) await getToken(tenant);
    res.json(getTokenStatus());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all iflow mappings
router.get('/iflows', async (req, res) => {
  const rows = await store.find('interface_mappings', null, { orderBy: ['sort_order', 'cpi_iflow_name'] });
  res.json(rows);
});

// GET iflow runtime status
router.get('/iflow/:id/status', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    if (!mapping.cpi_iflow_id) return res.json({ status: 'unknown', reason: 'No iFlow ID configured' });
    const apiConfig = await store.findOne('api_configs', { id: 'cpi-iflow-status' });
    const cpiTenant = await getCpiTenantForMapping(req.params.id);
    const result = await callCpiApi(apiConfig, cpiTenant, { iflowId: mapping.cpi_iflow_id });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST deploy iflow
router.post('/iflow/:id/deploy', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    const apiConfig = await store.findOne('api_configs', { id: 'cpi-deploy-iflow' });
    const cpiTenant = await getCpiTenantForMapping(req.params.id);
    const result = await callCpiApi(apiConfig, cpiTenant, { iflowId: mapping.cpi_iflow_id });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE undeploy iflow
router.delete('/iflow/:id/undeploy', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    const apiConfig = await store.findOne('api_configs', { id: 'cpi-undeploy-iflow' });
    const cpiTenant = await getCpiTenantForMapping(req.params.id);
    const result = await callCpiApi(apiConfig, cpiTenant, { iflowId: mapping.cpi_iflow_id });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET last MPL
router.get('/iflow/:id/lastmpl', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    if (!mapping.cpi_iflow_id) return res.json({ lastTime: null, status: 'unknown' });
    const apiConfig = await store.findOne('api_configs', { id: 'cpi-last-mpl' });
    const cpiTenant = await getCpiTenantForMapping(req.params.id);
    const result = await callCpiApi(apiConfig, cpiTenant, { iflowId: mapping.cpi_iflow_id });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST call arbitrary CPI API config (dynamic components)
router.post('/call/:apiConfigId', async (req, res) => {
  try {
    const apiConfig = await store.findOne('api_configs', { id: req.params.apiConfigId });
    if (!apiConfig || apiConfig.system !== 'CPI') return res.status(404).json({ error: 'CPI API config not found' });
    const cpiTenant = await getDefaultCpiTenant();
    const result = await callCpiApi(apiConfig, cpiTenant, req.body || {});
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
