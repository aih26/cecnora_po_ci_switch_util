const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const TABLES = ['settings', 'api_configs', 'ui_components', 'interface_mappings', 'status_cache', 'po_systems', 'cpi_tenants', 'system_mappings'];

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

function orderByClause(fields) {
  const NUMERIC_FIELDS = new Set(['sort_order']);
  return fields.map(key => {
    const dir = key.startsWith('-') ? 'DESC' : 'ASC';
    const k = key.startsWith('-') ? key.slice(1) : key;
    const expr = NUMERIC_FIELDS.has(k)
      ? `(doc->>'${k}')::numeric`
      : `doc->>'${k}'`;
    return `${expr} ${dir} NULLS LAST`;
  }).join(', ');
}

async function initTables() {
  const pool = getPool();
  for (const t of TABLES) {
    await pool.query(`CREATE TABLE IF NOT EXISTS "${t}" (doc JSONB NOT NULL)`);
  }
}

async function find(table, filter, options = {}) {
  const pool = getPool();
  let q = `SELECT doc FROM "${table}"`;
  const params = [];
  if (filter && Object.keys(filter).length > 0) {
    q += ` WHERE doc @> $1::jsonb`;
    params.push(JSON.stringify(filter));
  }
  if (options.orderBy?.length) {
    q += ` ORDER BY ${orderByClause(options.orderBy)}`;
  }
  const { rows } = await pool.query(q, params);
  return rows.map(r => r.doc);
}

async function findOne(table, filter) {
  const pool = getPool();
  let q = `SELECT doc FROM "${table}"`;
  const params = [];
  if (filter && Object.keys(filter).length > 0) {
    q += ` WHERE doc @> $1::jsonb LIMIT 1`;
    params.push(JSON.stringify(filter));
  } else {
    q += ` LIMIT 1`;
  }
  const { rows } = await pool.query(q, params);
  return rows[0]?.doc ?? null;
}

async function count(table, filter) {
  const pool = getPool();
  let q = `SELECT COUNT(*)::int AS cnt FROM "${table}"`;
  const params = [];
  if (filter && Object.keys(filter).length > 0) {
    q += ` WHERE doc @> $1::jsonb`;
    params.push(JSON.stringify(filter));
  }
  const { rows } = await pool.query(q, params);
  return rows[0]?.cnt ?? 0;
}

async function insert(table, record) {
  const pool = getPool();
  const row = { id: uuidv4(), ...record };
  await pool.query(`INSERT INTO "${table}" (doc) VALUES ($1::jsonb)`, [JSON.stringify(row)]);
  return row;
}

async function insertIfNotExists(table, filter, record) {
  const existing = await findOne(table, filter);
  if (existing) return { inserted: false, row: existing };
  const row = await insert(table, record);
  return { inserted: true, row };
}

async function upsert(table, idKey, record) {
  const pool = getPool();
  const idVal = record[idKey];
  const { rowCount } = await pool.query(
    `UPDATE "${table}" SET doc = doc || $1::jsonb WHERE doc->>'${idKey}' = $2`,
    [JSON.stringify(record), String(idVal)]
  );
  if (rowCount === 0) {
    await pool.query(`INSERT INTO "${table}" (doc) VALUES ($1::jsonb)`, [JSON.stringify(record)]);
  }
  return record;
}

async function update(table, filter, updates) {
  const pool = getPool();
  let q = `UPDATE "${table}" SET doc = doc || $1::jsonb`;
  const params = [JSON.stringify(updates)];
  if (filter && Object.keys(filter).length > 0) {
    q += ` WHERE doc @> $2::jsonb`;
    params.push(JSON.stringify(filter));
  }
  const { rowCount } = await pool.query(q, params);
  return rowCount;
}

async function remove(table, filter) {
  const pool = getPool();
  let q = `DELETE FROM "${table}"`;
  const params = [];
  if (filter && Object.keys(filter).length > 0) {
    q += ` WHERE doc @> $1::jsonb`;
    params.push(JSON.stringify(filter));
  }
  const { rowCount } = await pool.query(q, params);
  return rowCount;
}

module.exports = { initTables, find, findOne, count, insert, insertIfNotExists, upsert, update, remove };
