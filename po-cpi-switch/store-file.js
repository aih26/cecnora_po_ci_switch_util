const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'app.json');

let _data = null;

const TABLES = ['settings', 'api_configs', 'ui_components', 'interface_mappings', 'status_cache', 'po_systems', 'cpi_tenants', 'system_mappings'];

function emptyDb() {
  return Object.fromEntries(TABLES.map(t => [t, []]));
}

function load() {
  if (_data) return _data;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { _data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { _data = emptyDb(); }
  } else {
    _data = emptyDb();
  }
  TABLES.forEach(t => { if (!_data[t]) _data[t] = []; });
  return _data;
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(_data, null, 2), 'utf8');
}

function matches(row, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => row[k] === v);
}

function sortRows(rows, orderBy) {
  if (!orderBy || !orderBy.length) return rows;
  return [...rows].sort((a, b) => {
    for (const key of orderBy) {
      const dir = key.startsWith('-') ? -1 : 1;
      const k   = dir === -1 ? key.slice(1) : key;
      const av  = a[k] ?? '';
      const bv  = b[k] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
    }
    return 0;
  });
}

async function initTables() {}

async function find(table, filter, options = {}) {
  const db = load();
  let rows = db[table].filter(r => matches(r, filter));
  if (options.orderBy) rows = sortRows(rows, options.orderBy);
  return rows;
}

async function findOne(table, filter) {
  return load()[table].find(r => matches(r, filter)) ?? null;
}

async function count(table, filter) {
  return load()[table].filter(r => matches(r, filter)).length;
}

async function insert(table, record) {
  const db = load();
  const row = { id: uuidv4(), ...record };
  db[table].push(row);
  persist();
  return row;
}

async function insertIfNotExists(table, filter, record) {
  const existing = await findOne(table, filter);
  if (existing) return { inserted: false, row: existing };
  const row = await insert(table, record);
  return { inserted: true, row };
}

async function upsert(table, idKey, record) {
  const db = load();
  const idx = db[table].findIndex(r => r[idKey] === record[idKey]);
  if (idx >= 0) {
    db[table][idx] = { ...db[table][idx], ...record };
    persist();
    return db[table][idx];
  }
  return insert(table, record);
}

async function update(table, filter, updates) {
  const db = load();
  let n = 0;
  db[table] = db[table].map(r => {
    if (matches(r, filter)) { n++; return { ...r, ...updates }; }
    return r;
  });
  if (n) persist();
  return n;
}

async function remove(table, filter) {
  const db = load();
  const before = db[table].length;
  db[table] = filter ? db[table].filter(r => !matches(r, filter)) : [];
  if (db[table].length !== before) persist();
  return before - db[table].length;
}

module.exports = { initTables, find, findOne, count, insert, insertIfNotExists, upsert, update, remove };
