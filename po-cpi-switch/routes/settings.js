const express = require('express');
const router = express.Router();
const store = require('../store');

// GET all settings grouped
router.get('/', async (req, res) => {
  const rows = await store.find('settings', null, { orderBy: ['group_name', 'sort_order'] });
  const safe = rows.map(r => ({ ...r, value: r.type === 'password' && r.value ? '••••••••' : r.value }));
  res.json(safe);
});

// GET settings grouped as { groupName: [settings] }
router.get('/grouped', async (req, res) => {
  const rows = await store.find('settings', null, { orderBy: ['group_name', 'sort_order'] });
  const grouped = {};
  rows.forEach(r => {
    const g = r.group_name || 'General';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ ...r, value: r.type === 'password' && r.value ? '••••••••' : r.value });
  });
  res.json(grouped);
});

// GET raw values map (keys → values, no masking — for internal backend use)
router.get('/values', async (req, res) => {
  const rows = await store.find('settings');
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  res.json(map);
});

const MASK = '••••••••';

// PUT bulk update settings { key: value, ... }
router.put('/', async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    const existing = await store.findOne('settings', { key });
    if (existing?.type === 'password' && (value === MASK || value === '')) continue;
    await store.update('settings', { key }, { value });
  }
  res.json({ ok: true });
});

// PUT single setting
router.put('/:key', async (req, res) => {
  const { value } = req.body;
  const existing = await store.findOne('settings', { key: req.params.key });
  if (existing?.type === 'password' && (value === MASK || value === '')) return res.json({ ok: true });
  await store.update('settings', { key: req.params.key }, { value });
  res.json({ ok: true });
});

// POST add a new custom setting key
router.post('/', async (req, res) => {
  const { key, value, label, type, group_name, description } = req.body;
  if (!key || !label) return res.status(400).json({ error: 'key and label are required' });
  await store.upsert('settings', 'key', {
    key, value: value || null, label, type: type || 'text',
    group_name: group_name || 'General', description: description || null, sort_order: 99
  });
  res.json({ ok: true });
});

// DELETE a custom setting (only non-system settings deletable)
router.delete('/:key', async (req, res) => {
  const s = await store.findOne('settings', { key: req.params.key });
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (['PO Connection', 'CPI Connection'].includes(s.group_name)) {
    return res.status(403).json({ error: 'Cannot delete core connection settings' });
  }
  await store.remove('settings', { key: req.params.key });
  res.json({ ok: true });
});

module.exports = router;
