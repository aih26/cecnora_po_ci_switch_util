import React, { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import * as api from '../api/index.js';
import { updateMapping } from '../api/index.js';

function applyFmt(d, fmt) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const MM   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const HH   = String(d.getHours()).padStart(2, '0');
  const mm   = String(d.getMinutes()).padStart(2, '0');
  return fmt.replace('DD', dd).replace('MM', MM).replace('YYYY', yyyy).replace('HH', HH).replace('mm', mm);
}

function formatTime(ts, fmt = 'DD/MM/YYYY HH:mm') {
  if (!ts) return '—';
  try {
    let d;
    if (typeof ts === 'string' && ts.startsWith('/Date(')) {
      d = new Date(parseInt(ts.replace(/\/Date\((\d+)[^)]*\)/, '$1'), 10));
    } else {
      d = new Date(ts);
    }
    if (isNaN(d.getTime())) return String(ts);
    return applyFmt(d, fmt);
  } catch { return String(ts); }
}

/* Resolve a column's value from the row and rowStatus */
function resolveColValue(col, mapping, rs) {
  if (col.source === 'mapping') {
    return mapping[col.field] || (col.fallback && mapping[col.fallback]) || null;
  }
  if (col.source === 'api') {
    return rs.apis?.[col.api_config_id]?.[col.response_field] ?? null;
  }
  return null;
}

/* Render a single table cell for a column */
function ColCell({ col, mapping, rs, dateFormat }) {
  const raw = resolveColValue(col, mapping, rs);

  if (col.source === 'api' && rs.loading) {
    return <td><span className="loading-dots">…</span></td>;
  }
  if (col.type === 'badge') {
    const apiResult = rs.apis?.[col.api_config_id];
    return <td><StatusBadge value={raw} undeployed={apiResult?._undeployed === true} notFound={apiResult?._not_found === true} /></td>;
  }
  if (col.type === 'datetime') {
    const formatted = formatTime(raw, dateFormat);
    return <td className="time-cell" title={formatted}>{formatted}</td>;
  }
  if (col.type === 'mono') {
    const text = raw || '—';
    return <td className="cell-name monospace" title={text}>{text}</td>;
  }
  const text = raw || '—';
  return (
    <td className="cell-name" title={text}>{text}</td>
  );
}

function RowActions({ mapping, components, placement, onAction }) {
  const active = components.filter(c => c.placement === placement && c.is_active);
  if (!active.length) return null;
  return (
    <div className="row-actions">
      {active.map(c => {
        const cfg = JSON.parse(typeof c.display_config === 'string' ? c.display_config : JSON.stringify(c.display_config));
        return (
          <button key={c.id} className={`btn-action btn-${cfg.variant || 'default'}`}
            title={c.label} onClick={() => onAction(c, mapping)}>
            {cfg.icon || ''} {c.label}
          </button>
        );
      })}
    </div>
  );
}

function EditRowModal({ mapping, onSave, onClose }) {
  const { state } = useApp();

  // Build field list from the saved CSV column map — fully dynamic
  const csvFields = React.useMemo(() => {
    const raw = (state.settingsGrouped?.['CSV Mapping'] || []).find(s => s.key === 'csv_column_map')?.value;
    if (!raw) return [];
    try {
      return JSON.parse(raw)
        .filter(c => c.fieldName && c.enabled !== false)
        .map(c => ({ key: c.fieldName, label: c.label }));
    } catch { return []; }
  }, [state.settingsGrouped]);

  const [form, setForm] = useState({ ...mapping });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Row — {Object.values(form).find(v => v && typeof v === 'string' && v.length > 1) || form.id}</h3>
        <div className="form-grid">
          {csvFields.length > 0
            ? csvFields.map(f => (
                <label key={f.key}>
                  {f.label}
                  <input value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                </label>
              ))
            : <p style={{ gridColumn: '1/-1', color: 'var(--text-muted)', fontSize: 13 }}>
                No columns configured — set up your CSV Mapping in Settings first.
              </p>
          }
          <label className="full-width">
            Notes
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function InterfaceTable({ mappings, uiComponents, onRefreshRow }) {
  const { notify, refreshRowStatus, state } = useApp();
  const { rowStatus, dashboardColumns } = state;
  const dateFormat = (state.settingsGrouped?.['General'] || []).find(s => s.key === 'date_format')?.value || 'DD/MM/YYYY HH:mm';
  const [confirmAction, setConfirmAction] = useState(null);
  const [editRow, setEditRow]             = useState(null);
  const [filter, setFilter]               = useState('');

  const cols    = (dashboardColumns || []).filter(c => c.enabled !== false);
  const poCols  = cols.filter(c => c.side === 'po');
  const cpiCols = cols.filter(c => c.side === 'cpi');

  // Build a list of searchable field keys from the active CSV column map
  const filterFieldKeys = React.useMemo(() => {
    const raw = (state.settingsGrouped?.['CSV Mapping'] || []).find(s => s.key === 'csv_column_map')?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw).filter(c => c.fieldName && c.enabled !== false).map(c => c.fieldName);
    } catch { return null; }
  }, [state.settingsGrouped]);

  const filtered = filter
    ? mappings.filter(m => {
        const keys = filterFieldKeys || Object.keys(m).filter(k => typeof m[k] === 'string');
        return keys.some(k => typeof m[k] === 'string' && m[k].toLowerCase().includes(filter.toLowerCase()));
      })
    : mappings;

  const [apiConfigMap, setApiConfigMap] = useState({});
  React.useEffect(() => {
    api.getApiConfigs().then(cfgs => {
      const map = {};
      cfgs.forEach(c => { map[c.id] = c; });
      setApiConfigMap(map);
    }).catch(() => {});
  }, []);

  const enrichedComponents = uiComponents.map(c => ({ ...c, _api_config: apiConfigMap[c.api_config_id] }));

  async function executeAction(component, mapping) {
    const inputMappings = component.input_mappings || {};
    const params = {};
    Object.entries(inputMappings).forEach(([k, v]) => {
      const match = v.match(/\{\{row\.(\w+)\}\}/);
      params[k] = match ? (mapping[match[1]] || '') : v;
    });
    if (!component.api_config_id) { notify('Component has no API config assigned', 'error'); return; }
    try {
      const cfg = component._api_config;
      const result = cfg?.system === 'PO'
        ? await api.callPoApi(component.api_config_id, params)
        : await api.callCpiApi(component.api_config_id, params);
      if (result._status >= 400 || result._error) {
        const detail = result._error || `HTTP ${result._status}`;
        notify(`${component.label} failed: ${detail}`, 'error');
      } else {
        notify(`${component.label} — OK`, 'success');
        setTimeout(() => refreshRowStatus(mapping), 1500);
      }
    } catch (err) { notify(`${component.label} failed: ${err.message}`, 'error'); }
  }

  function handleAction(component, mapping) {
    const enriched = { ...component, _api_config: apiConfigMap[component.api_config_id] };
    const displayCfg = component.display_config || {};
    if (displayCfg.confirmRequired) {
      const msg = (component.confirm_message || `Execute "${component.label}"?`)
        .replace(/\{\{row\.(\w+)\}\}/g, (_, k) => mapping[k] || '');
      setConfirmAction({ component: enriched, mapping, msg });
    } else {
      executeAction(enriched, mapping);
    }
  }

  async function handleSaveRow(form) {
    try {
      await updateMapping(form.id, form);
      notify('Row saved', 'success');
      setEditRow(null);
      if (onRefreshRow) onRefreshRow();
    } catch (err) { notify('Save failed: ' + err.message, 'error'); }
  }

  const totalCols = 1 + poCols.length + 1 + cpiCols.length + 1 + 1; // #, po cols, po-actions, cpi cols, cpi-actions, meta

  function colW(col) {
    if (col.type === 'mono')     return '200px';
    if (col.type === 'badge')    return '80px';
    if (col.type === 'datetime') return '120px';
    return '130px'; // text — wider than before so wrapping is readable
  }

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <input className="filter-input" placeholder="Filter interfaces…"
          value={filter} onChange={e => setFilter(e.target.value)} />
        <span className="row-count">{filtered.length} of {mappings.length} rows</span>
      </div>

      <div className="table-scroll">
        <table className="interface-table">
          <colgroup>
            <col style={{ width: '28px' }} />
            {poCols.map(c  => <col key={c.id}  style={{ width: colW(c) }} />)}
            <col style={{ width: '110px' }} />
            {cpiCols.map(c => <col key={c.id}  style={{ width: colW(c) }} />)}
            <col style={{ width: '110px' }} />
            <col style={{ width: '52px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-num"></th>
              <th colSpan={poCols.length + 1} className="section-header po-section-header">
                SAP Process Orchestration (PO/PI)
              </th>
              <th colSpan={cpiCols.length + 1} className="section-header cpi-section-header">
                SAP Cloud Integration (CPI)
              </th>
              <th></th>
            </tr>
            <tr className="subheader">
              <th className="col-num"></th>
              {poCols.map(c => <th key={c.id}>{c.label}</th>)}
              <th>PO Actions</th>
              {cpiCols.map(c => <th key={c.id}>{c.label}</th>)}
              <th>CPI Actions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={totalCols} className="empty-state">
                No interface mappings loaded. Use "Import Mapping" to upload a CSV or Excel file.
              </td></tr>
            ) : filtered.map((m, idx) => {
              const rs = rowStatus[m.id] || {};
              return (
                <tr key={m.id} className={rs.loading ? 'row-loading' : ''}>
                  <td className="col-num">{idx + 1}</td>
                  {poCols.map(c => <ColCell key={c.id} col={c} mapping={m} rs={rs} dateFormat={dateFormat} />)}
                  <td className="col-po-actions">
                    <RowActions mapping={m} components={enrichedComponents} placement="row-po" onAction={handleAction} />
                  </td>
                  {cpiCols.map(c => <ColCell key={c.id} col={c} mapping={m} rs={rs} dateFormat={dateFormat} />)}
                  <td className="col-cpi-actions">
                    <RowActions mapping={m} components={enrichedComponents} placement="row-cpi" onAction={handleAction} />
                  </td>
                  <td className="col-row-meta">
                    <button className="btn-icon" title="Edit row" onClick={() => setEditRow(m)}>✏</button>
                    <button className="btn-icon" title="Refresh row" onClick={() => refreshRowStatus(m)}>↻</button>
                    {m.notes && <span className="notes-tip" title={m.notes}>💬</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Action</h3>
            <p>{confirmAction.msg}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => {
                executeAction(confirmAction.component, confirmAction.mapping);
                setConfirmAction(null);
              }}>Yes, proceed</button>
              <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editRow && <EditRowModal mapping={editRow} onSave={handleSaveRow} onClose={() => setEditRow(null)} />}
    </div>
  );
}
