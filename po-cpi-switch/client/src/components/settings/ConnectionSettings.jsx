import React, { useEffect, useState, useCallback } from 'react';
import { getSettingsGrouped, saveSettings } from '../../api/index.js';
import { getCpiTokenStatus, refreshCpiToken, testPoConnection } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

function CpiTokenPanel() {
  const { notify } = useApp();
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getCpiTokenStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const s = await refreshCpiToken();
      setStatus(s);
      notify('Token refreshed successfully', 'success');
    } catch (err) {
      notify('Token refresh failed: ' + err.message, 'error');
    } finally { setRefreshing(false); }
  }

  if (!status) return null;

  const isValid = status.status === 'valid';
  const isNone  = status.status === 'none';

  return (
    <div className={`conn-status-panel ${isValid ? 'conn-ok' : isNone ? 'conn-none' : 'conn-err'}`}>
      <div className="conn-status-row">
        <span className="conn-dot">{isValid ? '●' : isNone ? '○' : '●'}</span>
        <span className="conn-label">OAuth2 Token</span>
        <span className="conn-value">{status.message || status.status}</span>
        {isValid && status.expires_in_sec != null && (
          <span className="conn-expiry">
            expires in {status.expires_in_sec > 60
              ? `${Math.floor(status.expires_in_sec / 60)}m ${status.expires_in_sec % 60}s`
              : `${status.expires_in_sec}s`}
          </span>
        )}
        <button className="btn btn-sm btn-secondary" onClick={handleRefresh} disabled={refreshing} style={{ marginLeft: 'auto' }}>
          {refreshing ? 'Fetching…' : isNone ? 'Fetch Token' : 'Refresh Token'}
        </button>
      </div>
      {isValid && status.token_preview && (
        <div className="conn-token-preview" title={status.token_preview}>
          <span className="conn-token-label">Bearer</span>
          <code className="conn-token-val">{status.token_preview}</code>
        </div>
      )}
    </div>
  );
}

function PoTestPanel() {
  const { notify } = useApp();
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const r = await testPoConnection();
      setResult(r);
      if (r.ok) notify('PO connection successful', 'success');
      else notify('PO connection failed: ' + r.error, 'error');
    } catch (err) {
      setResult({ ok: false, error: err.message });
      notify('Connection test error: ' + err.message, 'error');
    } finally { setTesting(false); }
  }

  return (
    <div className={`conn-status-panel ${result ? (result.ok ? 'conn-ok' : 'conn-err') : 'conn-none'}`}>
      <div className="conn-status-row">
        <span className="conn-dot">{result ? (result.ok ? '●' : '●') : '○'}</span>
        <span className="conn-label">PO / PI Connectivity</span>
        {result && (
          <span className="conn-value">
            {result.ok
              ? `Reachable — ${result.host}:${result.port}`
              : `Failed — ${result.error}`}
          </span>
        )}
        {!result && <span className="conn-value" style={{ color: 'var(--text-light)' }}>Not tested yet</span>}
        <button className="btn btn-sm btn-secondary" onClick={handleTest} disabled={testing} style={{ marginLeft: 'auto' }}>
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

export default function ConnectionSettings({ group, title, color }) {
  const { notify, loadSettings } = useApp();
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettingsGrouped().then(grouped => {
      const grpFields = grouped[group] || [];
      setFields(grpFields);
      const v = {};
      grpFields.forEach(f => {
        // Don't seed password fields with the display mask — leave blank so user must re-enter to change
        v[f.key] = (f.type === 'password') ? '' : (f.value || '');
      });
      setValues(v);
    });
  }, [group]);

  function set(key, val) { setValues(prev => ({ ...prev, [key]: val })); }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings(values);
      await loadSettings();
      notify(`${title} saved`, 'success');
    } catch (err) {
      notify('Save failed: ' + err.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className={`settings-section settings-section-${color || 'default'}`}>
      <h3>{title}</h3>
      <div className="form-grid">
        {fields.map(f => (
          <label key={f.key} className={f.type === 'boolean' ? 'label-checkbox' : ''}>
            <span className="field-label">{f.label}</span>
            {f.description && <span className="field-desc">{f.description}</span>}
            {f.type === 'password' ? (
              <input type="password" value={values[f.key] || ''}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.value ? '(password set — leave blank to keep)' : `Enter ${f.label}`} />
            ) : f.type === 'boolean' ? (
              <input type="checkbox" checked={values[f.key] === 'true'}
                onChange={e => set(f.key, String(e.target.checked))} />
            ) : f.type === 'number' ? (
              <input type="number" value={values[f.key] || ''}
                onChange={e => set(f.key, e.target.value)} />
            ) : (
              <input type="text" value={values[f.key] || ''}
                onChange={e => set(f.key, e.target.value)} />
            )}
          </label>
        ))}
      </div>
      <div className="section-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Status / token panel below the form */}
      {color === 'cpi' && <CpiTokenPanel />}
      {color === 'po'  && <PoTestPanel />}
    </div>
  );
}
