const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

// ── API Configs ────────────────────────────────────────────────────────────

router.get('/apis', async (req, res) => {
  const rows = await store.find('api_configs', null, { orderBy: ['system', 'name'] });
  res.json(rows);
});

router.get('/apis/:id', async (req, res) => {
  const row = await store.findOne('api_configs', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/apis', async (req, res) => {
  const { name, description, system, url_template, method, content_type, auth_type,
          soap_action, request_template, response_mappings, headers } = req.body;
  if (!name || !system || !url_template) return res.status(400).json({ error: 'name, system, url_template required' });
  const row = await store.insert('api_configs', {
    name, description: description || null, system, url_template,
    method: method || 'GET', content_type: content_type || 'application/json',
    auth_type: auth_type || 'oauth2', soap_action: soap_action || null,
    request_template: request_template || null,
    response_mappings: response_mappings || [],
    headers: headers || {},
    is_builtin: false
  });
  res.json({ ok: true, id: row.id });
});

router.put('/apis/:id', async (req, res) => {
  const existing = await store.findOne('api_configs', { id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description, system, url_template, method, content_type, auth_type,
          soap_action, request_template, response_mappings, headers } = req.body;
  await store.update('api_configs', { id: req.params.id }, {
    ...(name            !== undefined && { name }),
    ...(description     !== undefined && { description }),
    ...(system          !== undefined && { system }),
    ...(url_template    !== undefined && { url_template }),
    ...(method          !== undefined && { method }),
    ...(content_type    !== undefined && { content_type }),
    ...(auth_type       !== undefined && { auth_type }),
    ...(soap_action     !== undefined && { soap_action }),
    ...(request_template!== undefined && { request_template }),
    ...(response_mappings !== undefined && { response_mappings }),
    ...(headers         !== undefined && { headers }),
  });
  res.json({ ok: true });
});

router.delete('/apis/:id', async (req, res) => {
  const existing = await store.findOne('api_configs', { id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.is_builtin) return res.status(403).json({ error: 'Cannot delete a built-in API config. Edit it instead.' });
  await store.remove('api_configs', { id: req.params.id });
  res.json({ ok: true });
});

// ── UI Components ─────────────────────────────────────────────────────────

router.get('/components', async (req, res) => {
  const rows = await store.find('ui_components', null, { orderBy: ['placement', 'sort_order'] });
  res.json(rows);
});

router.post('/components', async (req, res) => {
  const { name, label, type, placement, api_config_id,
          input_mappings, display_config, confirm_message, sort_order } = req.body;
  if (!name || !label || !type || !placement) {
    return res.status(400).json({ error: 'name, label, type, placement required' });
  }
  const row = await store.insert('ui_components', {
    name, label, type, placement,
    api_config_id: api_config_id || null,
    input_mappings: input_mappings || {},
    display_config: display_config || {},
    confirm_message: confirm_message || null,
    is_active: true, sort_order: sort_order || 0
  });
  res.json({ ok: true, id: row.id });
});

router.put('/components/:id', async (req, res) => {
  const existing = await store.findOne('ui_components', { id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const allowed = ['name','label','type','placement','api_config_id',
                   'input_mappings','display_config','confirm_message','sort_order','is_active'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  await store.update('ui_components', { id: req.params.id }, updates);
  res.json({ ok: true });
});

router.delete('/components/:id', async (req, res) => {
  await store.remove('ui_components', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
