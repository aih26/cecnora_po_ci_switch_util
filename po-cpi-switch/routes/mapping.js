const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const path    = require('path');
const store   = require('../store');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

const DEFAULT_COL_MAP = [
  { colIndex: 1, label: 'ICO Name',       enabled: true },
  { colIndex: 2, label: 'Sender Party',   enabled: true },
  { colIndex: 3, label: 'Sender Service', enabled: true },
  { colIndex: 4, label: 'Channel Name',   enabled: true },
  { colIndex: 5, label: 'iFlow ID',       enabled: true },
  { colIndex: 6, label: 'iFlow Name',     enabled: true },
  { colIndex: 7, label: 'Package ID',     enabled: true },
];

function parseColMap(settings) {
  try {
    const raw = settings.csv_column_map;
    if (!raw) return DEFAULT_COL_MAP;
    const parsed = JSON.parse(raw);
    return parsed.length ? parsed : DEFAULT_COL_MAP;
  } catch { return DEFAULT_COL_MAP; }
}

function getAllFieldKeys(settings) {
  const keys = new Set();
  try {
    const colMap = parseColMap(settings);
    colMap.forEach(c => { if (c.fieldName) keys.add(c.fieldName); });
  } catch {}
  try {
    const raw = settings.csv_custom_fields;
    if (raw) JSON.parse(raw).forEach(f => { if (f.key) keys.add(f.key); });
  } catch {}
  keys.add('notes');
  return [...keys];
}

// GET all mappings (optionally filtered by system_mapping_id)
router.get('/', async (req, res) => {
  const filter = req.query.system_mapping_id ? { system_mapping_id: req.query.system_mapping_id } : null;
  const rows = await store.find('interface_mappings', filter, { orderBy: ['sort_order', 'po_channel_name'] });
  res.json(rows);
});

// POST upload CSV or Excel
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const allSettings = await store.find('settings');
    const settings = {};
    allSettings.forEach(r => { settings[r.key] = r.value; });

    const workbook = XLSX.readFile(req.file.path);
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const hasHeader = settings.csv_has_header !== 'false';
    const dataRows  = hasHeader ? rows.slice(1) : rows;

    const colMap     = parseColMap(settings);
    const activeCols = colMap.filter(m => m.enabled !== false);

    // Resolve system_mapping_id: use the one from the request, or fall back to default
    let system_mapping_id = req.body.system_mapping_id || null;
    if (!system_mapping_id) {
      const defaultMapping = await store.findOne('system_mappings', { is_default: true });
      if (!defaultMapping) {
        const anyMapping = await store.find('system_mappings');
        if (anyMapping.length) system_mapping_id = anyMapping[0].id;
      } else {
        system_mapping_id = defaultMapping.id;
      }
    }

    const replace = req.body.replace === 'true';
    if (replace && system_mapping_id) {
      await store.remove('interface_mappings', { system_mapping_id });
    } else if (replace) {
      await store.remove('interface_mappings');
    }

    let inserted = 0;
    for (const [idx, row] of dataRows.entries()) {
      const record = {};
      activeCols.forEach(m => {
        const ci    = parseInt(m.colIndex, 10) - 1;
        const field = m.fieldName;
        if (ci >= 0 && field) {
          const val = String(row[ci] || '').trim();
          if (val) record[field] = val;
        }
      });
      if (Object.keys(record).length === 0) continue;
      if (system_mapping_id) record.system_mapping_id = system_mapping_id;
      await store.insert('interface_mappings', { ...record, sort_order: idx });
      inserted++;
    }

    res.json({ ok: true, inserted, total: dataRows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update a single mapping row
router.put('/:id', async (req, res) => {
  const existing = await store.findOne('interface_mappings', { id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const allSettingsRows = await store.find('settings');
  const allSettings = {};
  allSettingsRows.forEach(r => { allSettings[r.key] = r.value; });
  const allowed = getAllFieldKeys(allSettings);

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  await store.update('interface_mappings', { id: req.params.id }, updates);
  res.json({ ok: true });
});

// DELETE a mapping
router.delete('/:id', async (req, res) => {
  await store.remove('interface_mappings', { id: req.params.id });
  res.json({ ok: true });
});

// DELETE all mappings
router.delete('/', async (req, res) => {
  await store.remove('interface_mappings');
  res.json({ ok: true });
});

module.exports = router;
