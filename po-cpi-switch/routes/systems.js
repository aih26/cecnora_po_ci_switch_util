const express = require('express');
const router = express.Router();
const store = require('../store');
const https = require('https');

const MASK = '••••••••';

// ── PO Systems ──────────────────────────────────────────────────────────────

router.get('/po', async (req, res) => {
  try {
    const rows = await store.find('po_systems', null, { orderBy: ['name'] });
    res.json(rows.map(r => ({ ...r, password: r.password ? MASK : '' })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/po', async (req, res) => {
  try {
    const { name, sid, host, port, https_port, username, password, use_https } = req.body;
    if (!name || !host) return res.status(400).json({ error: 'name and host are required' });
    const row = await store.insert('po_systems', {
      name, sid: sid || '', host,
      port: port || '50000', https_port: https_port || '50001',
      username: username || '', password: password || '',
      use_https: use_https || 'false'
    });
    res.json({ ok: true, id: row.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/po/:id', async (req, res) => {
  try {
    const existing = await store.findOne('po_systems', { id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const allowed = ['name', 'sid', 'host', 'port', 'https_port', 'username', 'use_https'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (req.body.password !== undefined && req.body.password !== MASK) updates.password = req.body.password;
    await store.update('po_systems', { id: req.params.id }, updates);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/po/:id', async (req, res) => {
  try {
    const all = await store.find('system_mappings');
    const used = all.filter(m =>
      m.system_a_id === req.params.id || m.system_b_id === req.params.id ||
      m.po_system_id === req.params.id
    );
    if (used.length) return res.status(400).json({ error: `Cannot delete: used in ${used.length} system mapping(s)` });
    await store.remove('po_systems', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/po/:id/test', async (req, res) => {
  try {
    const sys = await store.findOne('po_systems', { id: req.params.id });
    if (!sys) return res.status(404).json({ error: 'Not found' });
    const useHttps = sys.use_https === 'true';
    const host = (sys.host || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const port = useHttps ? (sys.https_port || 50001) : (sys.port || 50000);
    const url  = `${useHttps ? 'https' : 'http'}://${host}:${port}/`;
    const transport = require(useHttps ? 'https' : 'http');
    await new Promise((resolve, reject) => {
      const r = transport.get(url, { timeout: 6000, rejectUnauthorized: false }, res2 => { res2.resume(); resolve(res2.statusCode); });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Connection timed out')); });
    });
    res.json({ ok: true, host, port: Number(port) });
  } catch (err) { res.json({ ok: false, error: err.message }); }
});

// ── CPI Tenants ─────────────────────────────────────────────────────────────

router.get('/cpi', async (req, res) => {
  try {
    const rows = await store.find('cpi_tenants', null, { orderBy: ['name'] });
    res.json(rows.map(r => ({ ...r, client_secret: r.client_secret ? MASK : '' })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/cpi', async (req, res) => {
  try {
    const { name, host, token_url, client_id, client_secret } = req.body;
    if (!name || !host) return res.status(400).json({ error: 'name and host are required' });
    const row = await store.insert('cpi_tenants', {
      name, host: host || '', token_url: token_url || '',
      client_id: client_id || '', client_secret: client_secret || ''
    });
    res.json({ ok: true, id: row.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/cpi/:id', async (req, res) => {
  try {
    const existing = await store.findOne('cpi_tenants', { id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const allowed = ['name', 'host', 'token_url', 'client_id'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (req.body.client_secret !== undefined && req.body.client_secret !== MASK) updates.client_secret = req.body.client_secret;
    await store.update('cpi_tenants', { id: req.params.id }, updates);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/cpi/:id', async (req, res) => {
  try {
    const all = await store.find('system_mappings');
    const used = all.filter(m =>
      m.system_a_id === req.params.id || m.system_b_id === req.params.id ||
      m.cpi_tenant_id === req.params.id
    );
    if (used.length) return res.status(400).json({ error: `Cannot delete: used in ${used.length} system mapping(s)` });
    await store.remove('cpi_tenants', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── System Mappings ─────────────────────────────────────────────────────────

router.get('/mappings', async (req, res) => {
  try {
    const rows = await store.find('system_mappings', null, { orderBy: ['name'] });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/mappings', async (req, res) => {
  try {
    const { name, system_a_type, system_a_id, system_b_type, system_b_id, is_default } = req.body;
    if (!name || !system_a_type || !system_a_id || !system_b_type || !system_b_id)
      return res.status(400).json({ error: 'name, system_a_type, system_a_id, system_b_type, system_b_id are required' });
    if (is_default) await store.update('system_mappings', {}, { is_default: false });
    const row = await store.insert('system_mappings', {
      name, system_a_type, system_a_id, system_b_type, system_b_id, is_default: !!is_default
    });
    res.json({ ok: true, id: row.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/mappings/:id', async (req, res) => {
  try {
    const existing = await store.findOne('system_mappings', { id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, system_a_type, system_a_id, system_b_type, system_b_id, is_default } = req.body;
    if (is_default) await store.update('system_mappings', {}, { is_default: false });
    const updates = {};
    if (name          !== undefined) updates.name          = name;
    if (system_a_type !== undefined) updates.system_a_type = system_a_type;
    if (system_a_id   !== undefined) updates.system_a_id   = system_a_id;
    if (system_b_type !== undefined) updates.system_b_type = system_b_type;
    if (system_b_id   !== undefined) updates.system_b_id   = system_b_id;
    if (is_default    !== undefined) updates.is_default     = !!is_default;
    await store.update('system_mappings', { id: req.params.id }, updates);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/mappings/:id/set-default', async (req, res) => {
  try {
    const existing = await store.findOne('system_mappings', { id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await store.update('system_mappings', {}, { is_default: false });
    await store.update('system_mappings', { id: req.params.id }, { is_default: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/mappings/:id', async (req, res) => {
  try {
    const ifaces = await store.find('interface_mappings', { system_mapping_id: req.params.id });
    if (ifaces.length)
      return res.status(400).json({ error: `Cannot delete: ${ifaces.length} interface mapping(s) reference this system mapping` });
    await store.remove('system_mappings', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
