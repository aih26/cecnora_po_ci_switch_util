import React, { useEffect, useState } from 'react';
import { getSettingsGrouped, saveSettings } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

function labelToKey(label) {
  return (label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export default function CSVMapping() {
  const { notify } = useApp();
  const [colMap, setColMap]   = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    getSettingsGrouped().then(grouped => {
      const csv = grouped['CSV Mapping'] || [];
      const hdr = csv.find(s => s.key === 'csv_has_header');
      const map = csv.find(s => s.key === 'csv_column_map');
      if (hdr) setHasHeader(hdr.value !== 'false');
      if (map?.value) {
        try {
          const parsed = JSON.parse(map.value);
          const sorted = [...parsed].sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0));
          setColMap(sorted.map(r => ({
            label:        r.label || '',
            fieldName:    r.fieldName || null,
            fieldTouched: !!r.fieldName,
            enabled:      r.enabled !== false,
          })));
        } catch { setColMap([]); }
      }
    });
  }, []);

  function mark() { setDirty(true); }

  function setLabel(i, v) {
    setColMap(p => p.map((r, j) => {
      if (j !== i) return r;
      // Auto-update field key from label if user hasn't manually edited it
      const newField = r.fieldTouched ? r.fieldName : (labelToKey(v) || null);
      return { ...r, label: v, fieldName: newField };
    }));
    mark();
  }

  function setField(i, v) {
    setColMap(p => p.map((r, j) =>
      j === i ? { ...r, fieldName: labelToKey(v) || null, fieldTouched: true } : r
    ));
    mark();
  }

  function toggle(i) { setColMap(p => p.map((r, j) => j === i ? { ...r, enabled: !r.enabled } : r)); mark(); }
  function remove(i) { setColMap(p => p.filter((_, j) => j !== i)); mark(); }

  function move(i, dir) {
    const next = [...colMap];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setColMap(next); mark();
  }

  function addRow() {
    setColMap(p => [...p, { label: '', fieldName: null, fieldTouched: false, enabled: true }]);
    mark();
  }

  async function handleSave() {
    setSaving(true);
    try {
      // colIndex is derived from array position — always sequential
      const toSave = colMap.map((r, i) => ({
        colIndex:  i + 1,
        label:     r.label,
        fieldName: r.fieldName,
        enabled:   r.enabled,
      }));
      await saveSettings({
        csv_has_header:    String(hasHeader),
        csv_column_map:    JSON.stringify(toSave),
        csv_custom_fields: '[]',
      });
      notify('CSV mapping saved', 'success');
      setDirty(false);
    } catch (err) { notify('Save failed: ' + err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="settings-section">
      <div className="csv-hdr">
        <div>
          <h3 style={{ marginBottom: 3 }}>CSV / Excel Column Mapping</h3>
          <p className="section-hint" style={{ margin: 0 }}>
            Add one row per CSV column in order. The field key is auto-generated from the column name — edit it if needed.
            Use ↑ / ↓ to reorder; the position number updates automatically.
            Field keys are used everywhere: dashboard columns, API input mappings, and the Edit Row form.
          </p>
        </div>
        <div className="csv-hdr-right">
          <label className="csv-chk">
            <input type="checkbox" checked={hasHeader}
              onChange={e => { setHasHeader(e.target.checked); mark(); }} />
            Has header row
          </label>
        </div>
      </div>

      <div className="csv-grid">
        <div className="csv-gh csv-gh-idx">#</div>
        <div className="csv-gh">Column Name <em>(as in your file)</em></div>
        <div className="csv-gh csv-gh-fld">→ Field Key</div>
        <div className="csv-gh csv-gh-on">On</div>
        <div className="csv-gh csv-gh-act"></div>

        {colMap.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center',
            fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface)' }}>
            No columns defined yet — click <strong>+ Add Column</strong> below.
          </div>
        )}

        {colMap.map((row, i) => (
          <React.Fragment key={i}>
            <div className="csv-cell csv-pos">{i + 1}</div>
            <input
              className={`csv-cell csv-name ${!row.enabled ? 'csv-disabled' : ''}`}
              type="text"
              value={row.label}
              placeholder="e.g. ICO Name"
              onChange={e => setLabel(i, e.target.value)}
            />
            <div className="csv-cell csv-fld">
              <input
                className="csv-fld-input"
                type="text"
                value={row.fieldName || ''}
                placeholder={row.label ? labelToKey(row.label) : 'auto from name'}
                onChange={e => setField(i, e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="csv-cell csv-on">
              <input type="checkbox" checked={!!row.enabled} onChange={() => toggle(i)} />
            </div>
            <div className="csv-cell csv-act">
              <button className="cgbtn" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
              <button className="cgbtn" onClick={() => move(i, 1)} disabled={i === colMap.length - 1} title="Move down">↓</button>
              <button className="cgbtn danger" onClick={() => remove(i)} title="Remove">✕</button>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="csv-footer">
        <button className="btn btn-sm btn-secondary" onClick={addRow}>+ Add Column</button>
        <span style={{ flex: 1 }} />
        {dirty && <span className="csv-unsaved">Unsaved changes</span>}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Mapping'}
        </button>
      </div>
    </div>
  );
}
