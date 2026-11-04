import React, { useEffect, useState } from 'react';
import { getSettingsGrouped, saveSettings, getBackendInfo } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

const PERF_KEYS = [
  {
    key: 'auto_refresh_on_load', label: 'Refresh on Load / Mapping Switch', type: 'boolean',
    desc: 'When ON: triggers a full status refresh immediately when the dashboard opens or you select a different system mapping. When OFF: status is restored from cache only; refreshes happen on the configured schedule or manually.'
  },
  { key: 'refresh_interval',    label: 'Refresh Schedule (sec)',     type: 'number', desc: 'Background auto-refresh interval in seconds. Set to 0 to disable scheduled refresh entirely.' },
  { key: 'parallel_rows',    label: 'Rows per Batch',         type: 'number', desc: 'How many rows are sent in a single batch request to the backend.' },
  { key: 'parallel_batches', label: 'Parallel Batches',       type: 'number', desc: 'How many batch requests run simultaneously. Total rows in flight = Rows per Batch × Parallel Batches.' },
  {
    key: 'max_payload_mb', label: 'Max Payload Size (MB)', type: 'number',
    desc: 'Maximum HTTP request body size in megabytes for saving the status cache. The server strips raw API response bodies before saving, so 50 MB is enough for thousands of rows. Increase only if you see "Payload too large" errors — the new limit takes effect immediately after saving, no restart required. Hard server ceiling: 500 MB.'
  },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY HH:mm', label: 'DD/MM/YYYY HH:mm  (European)' },
  { value: 'MM/DD/YYYY HH:mm', label: 'MM/DD/YYYY HH:mm  (US)' },
  { value: 'YYYY-MM-DD HH:mm', label: 'YYYY-MM-DD HH:mm  (ISO)' },
  { value: 'DD/MM/YYYY',       label: 'DD/MM/YYYY  (date only)' },
  { value: 'MM/DD/YYYY',       label: 'MM/DD/YYYY  (date only, US)' },
];

const DISPLAY_KEYS = [
  { key: 'app_title',        label: 'Application Title',    type: 'text',   desc: 'Title shown in the application header.' },
  { key: 'upload_title',     label: 'Import Section Title', type: 'text',   desc: 'Heading displayed above the file import controls on the dashboard.' },
  { key: 'upload_hint',      label: 'Import Section Hint',  type: 'text',   desc: 'Smaller sub-line shown below the import title.' },
  { key: 'upload_btn_label', label: 'Import Button Label',  type: 'text',   desc: 'Label on the import/upload button.' },
  { key: 'date_format',      label: 'Date/Time Format',     type: 'select', desc: 'Format used for all datetime columns in the dashboard.', options: DATE_FORMAT_OPTIONS },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent, #0066cc)' : 'var(--border-color, #ced4da)',
        transition: 'background 0.2s',
        flexShrink: 0, padding: 0
      }}
    >
      <span style={{
        position: 'absolute',
        left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function SettingsCard({ icon, title, description, keys, values, onChange, compact }) {
  return (
    <div className="settings-section gen-card">
      <div className="gen-card-header">
        <span className="gen-card-icon">{icon}</span>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="section-hint" style={{ margin: '2px 0 0' }}>{description}</p>
        </div>
      </div>

      {compact ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {keys.map((f, i) => (
            <div key={f.key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 4px',
              borderTop: i > 0 ? '1px solid var(--border-color, #dee2e6)' : 'none'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #212529)' }}>{f.label}</div>
                {f.desc && <div style={{ fontSize: 11, color: 'var(--text-muted, #6c757d)', marginTop: 2, lineHeight: 1.4 }}>{f.desc}</div>}
              </div>
              <div style={{ flexShrink: 0 }}>
                {f.type === 'boolean' ? (
                  <Toggle
                    checked={values[f.key] === 'true'}
                    onChange={v => onChange(f.key, String(v))}
                  />
                ) : f.type === 'select' ? (
                  <select value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}
                    style={{ fontSize: 13, padding: '4px 8px', width: 200 }}>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type="number" value={values[f.key] ?? ''}
                    onChange={e => onChange(f.key, e.target.value)}
                    style={{ fontSize: 13, padding: '4px 8px', width: 80, textAlign: 'right' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="form-grid" style={{ marginTop: 16 }}>
          {keys.map(f => (
            <label key={f.key} className={f.type === 'boolean' ? 'label-checkbox' : ''}>
              <span className="field-label">{f.label}</span>
              {f.desc && <span className="field-desc">{f.desc}</span>}
              {f.type === 'boolean' ? (
                <input type="checkbox" checked={values[f.key] === 'true'}
                  onChange={e => onChange(f.key, String(e.target.checked))} />
              ) : f.type === 'select' ? (
                <select value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => onChange(f.key, e.target.value)} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GeneralSettings() {
  const { notify, loadSettings } = useApp();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [backendInfo, setBackendInfo] = useState(null);

  useEffect(() => {
    getSettingsGrouped().then(grouped => {
      const v = {};
      (grouped['General'] || []).forEach(s => { v[s.key] = s.value || ''; });
      setValues(v);
    });
    getBackendInfo().then(setBackendInfo).catch(() => {});
  }, []);

  function set(key, val) { setValues(p => ({ ...p, [key]: val })); }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings(values);
      await loadSettings();
      notify('General settings saved', 'success');
    } catch (err) {
      notify('Save failed: ' + err.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <SettingsCard
        icon="⚡"
        title="Performance & Refresh"
        description="Control how fast status data is fetched and when automatic refreshes trigger."
        keys={PERF_KEYS}
        values={values}
        onChange={set}
        compact
      />
      <SettingsCard
        icon="🎨"
        title="Application & Display"
        description="Customize labels and text shown across the dashboard. Changes take effect immediately after saving."
        keys={DISPLAY_KEYS}
        values={values}
        onChange={set}
      />
      <div className="section-actions" style={{ paddingLeft: 2 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save General Settings'}
        </button>
      </div>

      {backendInfo && (
        <div className="settings-section gen-card" style={{ marginTop: 16 }}>
          <div className="gen-card-header">
            <span className="gen-card-icon">🗄️</span>
            <div>
              <h3 style={{ margin: 0 }}>Storage Backend</h3>
              <p className="section-hint" style={{ margin: '2px 0 0' }}>
                Read-only. To switch backend, set the <code>DATA_BACKEND</code> environment variable (<code>file</code> or <code>pg</code>) and restart the server.
              </p>
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <label>
              <span className="field-label">Active Backend</span>
              <input type="text" readOnly value={backendInfo.backend === 'pg' ? 'PostgreSQL' : 'File (JSON)'} style={{ background: 'var(--surface-2, #f5f5f5)', cursor: 'default' }} />
            </label>
            {backendInfo.database_url && (
              <label>
                <span className="field-label">Database URL</span>
                <input type="text" readOnly value={backendInfo.database_url} style={{ background: 'var(--surface-2, #f5f5f5)', cursor: 'default', fontFamily: 'monospace' }} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
