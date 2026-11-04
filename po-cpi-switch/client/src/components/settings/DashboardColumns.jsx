import React, { useEffect, useState } from 'react';
import { saveSettings } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

const COL_TYPES = ['text', 'mono', 'badge', 'datetime'];

function uid() { return 'dc_' + Math.random().toString(36).slice(2, 9); }

const BLANK_NEW = { label: '', side: 'po', source: 'mapping', field: '', type: 'text', api_config_id: '', response_field: '', input_mappings: {} };

/* Shared form used for both Add and Edit */
function ColForm({ initialValues, side, apiConfigs, mappingFields, onSave, onCancel, isEdit }) {
  const init = initialValues || { ...BLANK_NEW, side, field: mappingFields[0]?.value || '' };
  const [form, setForm] = useState({ ...init });
  const [imRows, setImRows] = useState(() => {
    const existing = Object.entries(init.input_mappings || {}).map(([k, v]) => ({ k, v }));
    return existing.length ? [...existing, { k: '', v: '' }] : [{ k: '', v: '' }];
  });

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function addImRow()         { setImRows(r => [...r, { k: '', v: '' }]); }
  function setImRow(i, f, v)  { setImRows(r => r.map((x, j) => j === i ? { ...x, [f]: v } : x)); }
  function delImRow(i)        { setImRows(r => r.filter((_, j) => j !== i)); }

  function handleSave() {
    if (!form.label.trim()) return;
    const input_mappings = {};
    imRows.forEach(r => { if (r.k.trim()) input_mappings[r.k.trim()] = r.v; });
    onSave({ ...form, id: form.id || uid(), enabled: form.enabled !== false, input_mappings });
  }

  const selectedApi = apiConfigs.find(a => a.id === form.api_config_id);
  const dlId = (i) => `dcol-im-dl-${i}`;

  return (
    <div className="dcol-add-form">
      <div className="dcol-add-row">
        <label className="dcol-add-field">
          <span>Label</span>
          <input type="text" value={form.label} onChange={e => setF('label', e.target.value)} placeholder="Column label" />
        </label>
        <label className="dcol-add-field">
          <span>Side</span>
          <select value={form.side} onChange={e => setF('side', e.target.value)}>
            <option value="po">PO</option>
            <option value="cpi">CPI</option>
          </select>
        </label>
        <label className="dcol-add-field">
          <span>Type</span>
          <select value={form.type} onChange={e => setF('type', e.target.value)}>
            {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="dcol-add-field">
          <span>Source</span>
          <select value={form.source} onChange={e => setF('source', e.target.value)}>
            <option value="mapping">Static (CSV field)</option>
            <option value="api">Dynamic (API response)</option>
          </select>
        </label>
      </div>

      {form.source === 'mapping' && (
        <div className="dcol-add-row">
          <label className="dcol-add-field dcol-wide">
            <span>CSV Mapped Field</span>
            <select value={form.field} onChange={e => setF('field', e.target.value)}>
              <option value="">— select field —</option>
              {mappingFields.map(f => (
                <option key={f.value} value={f.value}>{f.label}  ({f.value})</option>
              ))}
            </select>
          </label>
          {mappingFields.length === 0 && (
            <p className="dcol-hint-warn">No fields detected — configure column names in the CSV Mapping tab first.</p>
          )}
        </div>
      )}

      {form.source === 'api' && (
        <>
          <div className="dcol-add-row">
            <label className="dcol-add-field dcol-wide">
              <span>API Config</span>
              <select value={form.api_config_id} onChange={e => setF('api_config_id', e.target.value)}>
                <option value="">— select API —</option>
                {apiConfigs.map(a => <option key={a.id} value={a.id}>{a.name} ({a.system})</option>)}
              </select>
            </label>
            <label className="dcol-add-field">
              <span>Response Field</span>
              {selectedApi?.response_mappings?.length > 0 ? (
                <select value={form.response_field} onChange={e => setF('response_field', e.target.value)}>
                  <option value="">— pick field —</option>
                  {selectedApi.response_mappings.map(m => (
                    <option key={m.name} value={m.name}>{m.name}{m.description ? ` — ${m.description}` : ''}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={form.response_field} onChange={e => setF('response_field', e.target.value)}
                  placeholder="e.g. state, lastTime" />
              )}
            </label>
          </div>

          <div className="dcol-im-section">
            <div className="dcol-im-title">
              Input Param Mappings
              <em> — API template param → CSV row field</em>
            </div>
            {imRows.map((r, i) => (
              <div className="dcol-im-row" key={i}>
                <input type="text" value={r.k} onChange={e => setImRow(i, 'k', e.target.value)}
                  placeholder="API param name" className="dcol-im-key" />
                <span className="dcol-im-arrow">→</span>
                <input list={dlId(i)} type="text" value={r.v} onChange={e => setImRow(i, 'v', e.target.value)}
                  placeholder="{{row.fieldname}}" className="dcol-im-val" />
                <datalist id={dlId(i)}>
                  {mappingFields.map(f => (
                    <option key={f.value} value={`{{row.${f.value}}}`}>{f.label}</option>
                  ))}
                </datalist>
                <button className="cgbtn danger" onClick={() => delImRow(i)}>✕</button>
              </div>
            ))}
            <button className="btn btn-sm btn-secondary" onClick={addImRow}>+ Add Param</button>
          </div>
        </>
      )}

      <div className="dcol-add-actions">
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {isEdit ? 'Update Column' : 'Add Column'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function DashboardColumns() {
  const { state, notify, loadSettings } = useApp();
  const { settingsGrouped, apiConfigs } = state;
  const [cols, setCols]             = useState([]);
  const [mappingFields, setMappingFields] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState(false);
  const [showAdd, setShowAdd]       = useState(null);
  const [editingId, setEditingId]   = useState(null);

  useEffect(() => {
    const raw = (settingsGrouped['Dashboard'] || []).find(s => s.key === 'dashboard_columns')?.value;
    if (raw) { try { setCols(JSON.parse(raw)); } catch {} }

    const csvRaw = (settingsGrouped['CSV Mapping'] || []).find(s => s.key === 'csv_column_map')?.value;
    const seen = new Set();
    const fields = [];
    if (csvRaw) {
      try {
        JSON.parse(csvRaw)
          .filter(c => c.fieldName && c.enabled !== false)
          .forEach(c => {
            if (!seen.has(c.fieldName)) {
              seen.add(c.fieldName);
              fields.push({ value: c.fieldName, label: c.label });
            }
          });
      } catch {}
    }
    setMappingFields(fields);
  }, [settingsGrouped]);

  function mark() { setDirty(true); }

  function toggleCol(id) { setCols(c => c.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x)); mark(); }
  function setLabel(id, v) { setCols(c => c.map(x => x.id === id ? { ...x, label: v } : x)); mark(); }
  function move(id, dir) {
    const i = cols.findIndex(x => x.id === id);
    if (i < 0) return;
    const next = [...cols];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setCols(next); mark();
  }
  function remove(id) { setCols(c => c.filter(x => x.id !== id)); mark(); }
  function addCol(col) { setCols(c => [...c, col]); setShowAdd(null); mark(); }
  function updateCol(col) { setCols(c => c.map(x => x.id === col.id ? col : x)); setEditingId(null); mark(); }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings({ dashboard_columns: JSON.stringify(cols) });
      await loadSettings();
      notify('Dashboard columns saved — refreshing status…', 'success');
      setDirty(false);
      await refreshAllStatus(undefined, cols);
    } catch (err) { notify('Save failed: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  function renderSection(side) {
    const sideCols = cols.filter(c => c.side === side);
    const sideLabel = side === 'po' ? 'PO / PI' : 'CPI';
    return (
      <div className="dcol-section">
        <div className={`dcol-section-hdr dcol-${side}`}>{sideLabel} Columns</div>
        <div className="dcol-grid">
          <div className="dcol-gh">On</div>
          <div className="dcol-gh">Label</div>
          <div className="dcol-gh">Source / Field</div>
          <div className="dcol-gh">Type</div>
          <div className="dcol-gh"></div>

          {sideCols.map((col, i) => {
            const fieldLabel = col.source === 'mapping'
              ? (mappingFields.find(f => f.value === col.field)?.label || col.field || '?')
              : null;
            const sourceDesc = col.source === 'mapping'
              ? `${fieldLabel}`
              : `${col.api_config_id || '?'} → ${col.response_field || '?'}`;

            if (editingId === col.id) {
              return (
                <React.Fragment key={col.id}>
                  <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border)' }}>
                    <ColForm
                      initialValues={col}
                      side={side}
                      apiConfigs={apiConfigs}
                      mappingFields={mappingFields}
                      onSave={updateCol}
                      onCancel={() => setEditingId(null)}
                      isEdit
                    />
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={col.id}>
                <div className="dcol-cell dcol-on">
                  <input type="checkbox" checked={!!col.enabled} onChange={() => toggleCol(col.id)} />
                </div>
                <div className="dcol-cell">
                  <input type="text" value={col.label} onChange={e => setLabel(col.id, e.target.value)}
                    className={`dcol-label-inp${!col.enabled ? ' dcol-dim' : ''}`} />
                </div>
                <div className="dcol-cell dcol-src" title={sourceDesc}>
                  <span className={`dcol-src-tag ${col.source === 'api' ? 'src-api' : 'src-static'}`}>
                    {col.source === 'api' ? 'API' : 'field'}
                  </span>
                  <span className="dcol-src-val">{sourceDesc}</span>
                </div>
                <div className="dcol-cell dcol-type">{col.type}</div>
                <div className="dcol-cell dcol-acts">
                  <button className="cgbtn" onClick={() => move(col.id, -1)} disabled={i === 0} title="Up">↑</button>
                  <button className="cgbtn" onClick={() => move(col.id, 1)} disabled={i === sideCols.length - 1} title="Down">↓</button>
                  <button className="cgbtn" title="Edit column" onClick={() => { setEditingId(col.id); setShowAdd(null); }}>✏</button>
                  <button className="cgbtn danger" onClick={() => remove(col.id)} title="Remove">✕</button>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {showAdd === side ? (
          <ColForm side={side} apiConfigs={apiConfigs} mappingFields={mappingFields} onSave={addCol} onCancel={() => setShowAdd(null)} />
        ) : (
          <button className="btn btn-sm btn-secondary dcol-add-btn" onClick={() => { setShowAdd(side); setEditingId(null); }}>
            + Add {sideLabel} Column
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <h3 style={{ marginBottom:3 }}>Dashboard Column Configuration</h3>
          <p className="section-hint" style={{ margin:0 }}>
            Click <strong>✏</strong> to edit any column. The field picker shows exactly what you defined in
            <strong> Settings → CSV Mapping</strong> — add or rename fields there and they appear here automatically.
          </p>
        </div>
      </div>

      {renderSection('po')}
      {renderSection('cpi')}

      <div className="csv-footer" style={{ marginTop:16 }}>
        {dirty && <span className="csv-unsaved">Unsaved changes</span>}
        <span style={{ flex:1 }} />
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Dashboard Config'}
        </button>
      </div>
    </div>
  );
}
