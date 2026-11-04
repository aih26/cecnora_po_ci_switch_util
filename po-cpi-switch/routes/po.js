const express = require('express');
const router = express.Router();
const store = require('../store');
const { callPoApi, getDefaultPoSystem } = require('../services/po-service');

async function getPoSystemForMapping(mappingId) {
  const mapping = await store.findOne('interface_mappings', { id: mappingId });
  if (mapping?.system_mapping_id) {
    const sysMap = await store.findOne('system_mappings', { id: mapping.system_mapping_id });
    if (sysMap) {
      for (const side of ['a', 'b']) {
        if (sysMap[`system_${side}_type`] === 'po') {
          const po = await store.findOne('po_systems', { id: sysMap[`system_${side}_id`] });
          if (po) return po;
        }
      }
      if (sysMap.po_system_id) {
        const po = await store.findOne('po_systems', { id: sysMap.po_system_id });
        if (po) return po;
      }
    }
  }
  return getDefaultPoSystem();
}

// GET test PO connection reachability (uses first/default PO system)
router.get('/test', async (req, res) => {
  const sys = await getDefaultPoSystem();
  if (!sys.host) return res.json({ ok: false, error: 'PO host not configured' });
  const useHttps = sys.use_https === 'true';
  const host = sys.host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const port = useHttps ? (sys.https_port || 50001) : (sys.port || 50000);
  const url  = `${useHttps ? 'https' : 'http'}://${host}:${port}/`;
  try {
    const transport = require(useHttps ? 'https' : 'http');
    await new Promise((resolve, reject) => {
      const r = transport.get(url, { timeout: 6000, rejectUnauthorized: false }, res2 => { res2.resume(); resolve(res2.statusCode); });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Connection timed out')); });
    });
    res.json({ ok: true, host, port: Number(port) });
  } catch (err) {
    res.json({ ok: false, host, port: Number(port), error: err.message });
  }
});

// GET all channel mappings
router.get('/channels', async (req, res) => {
  const rows = await store.find('interface_mappings', null, { orderBy: ['sort_order', 'po_channel_name'] });
  res.json(rows);
});

// POST start a channel
router.post('/channel/:id/start', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    const apiConfig = await store.findOne('api_configs', { id: 'po-start-channel' });
    if (!apiConfig) return res.status(500).json({ error: 'API config not found' });
    const poSystem = await getPoSystemForMapping(req.params.id);
    const result = await callPoApi(apiConfig, poSystem, {
      channelObjectId: mapping.po_channel_object_id || req.body?.channelObjectId || ''
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST stop a channel
router.post('/channel/:id/stop', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    const apiConfig = await store.findOne('api_configs', { id: 'po-stop-channel' });
    if (!apiConfig) return res.status(500).json({ error: 'API config not found' });
    const poSystem = await getPoSystemForMapping(req.params.id);
    const result = await callPoApi(apiConfig, poSystem, {
      channelObjectId: mapping.po_channel_object_id || req.body?.channelObjectId || ''
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET channel state
router.get('/channel/:id/status', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    if (!mapping.po_channel_object_id) return res.json({ state: 'unknown', reason: 'No channel object ID configured' });
    const apiConfig = await store.findOne('api_configs', { id: 'po-get-channel-state' });
    const poSystem = await getPoSystemForMapping(req.params.id);
    const result = await callPoApi(apiConfig, poSystem, { channelObjectId: mapping.po_channel_object_id });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET last message time
router.get('/channel/:id/lastmessage', async (req, res) => {
  try {
    const mapping = await store.findOne('interface_mappings', { id: req.params.id });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    const apiConfig = await store.findOne('api_configs', { id: 'po-last-message' });
    const poSystem = await getPoSystemForMapping(req.params.id);
    const result = await callPoApi(apiConfig, poSystem, {
      senderParty:   mapping.po_sender_party   || '',
      senderService: mapping.po_sender_service || ''
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST call arbitrary PO API config by id (dynamic components)
router.post('/call/:apiConfigId', async (req, res) => {
  try {
    const apiConfig = await store.findOne('api_configs', { id: req.params.apiConfigId });
    if (!apiConfig || apiConfig.system !== 'PO') return res.status(404).json({ error: 'PO API config not found' });
    const poSystem = await getDefaultPoSystem();
    const result = await callPoApi(apiConfig, poSystem, req.body || {});
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
