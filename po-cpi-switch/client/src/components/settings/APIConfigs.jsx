import React, { useState } from 'react';
import { createApiConfig, updateApiConfig, deleteApiConfig } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

const EMPTY_CONFIG = {
  name: '', description: '', system: 'CPI', url_template: '', method: 'GET',
  content_type: 'application/json', auth_type: 'oauth2', soap_action: '',
  request_template: '', response_mappings: [], headers: {}
};

function MappingEditor({ mappings, onChange }) {
  function add() { onChange([...mappings, { name: '', path: '', type: 'jsonpath', description: '' }]); }
  function update(i, field, val) {
    const next = mappings.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    onChange(next);
  }
  function remove(i) { onChange(mappings.filter((_, idx) => idx !== i)); }

  return (
    <div className="mapping-editor">
      <div className="mapping-header">
        <span>Response Mappings</span>
        <button type="button" className="btn btn-sm" onClick={add}>+ Add</button>
      </div>
      {mappings.map((m, i) => (
        <div key={i} className="mapping-row">
          <input placeholder="Field name" value={m.name} onChange={e => update(i, 'name', e.target.value)} />
          <input placeholder="XPath or JSONPath" value={m.path} onChange={e => update(i, 'path', e.target.value)} className="path-input" />
          <select value={m.type} onChange={e => update(i, 'type', e.target.value)}>
            <option value="jsonpath">JSONPath</option>
            <option value="xpath">XPath</option>
          </select>
          <input placeholder="Description" value={m.description || ''} onChange={e => update(i, 'description', e.target.value)} />
          <button type="button" className="btn-icon danger" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
    </div>
  );
}

function ApiConfigForm({ config, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_CONFIG, ...config });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="api-form">
      <div className="form-grid">
        <label>Name *<input value={form.name} onChange={e => set('name', e.target.value)} /></label>
        <label>System *
          <select value={form.system} onChange={e => set('system', e.target.value)}>
            <option value="PO">PO</option>
            <option value="CPI">CPI</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
        </label>
        <label className="full-width">Description
          <input value={form.description || ''} onChange={e => set('description', e.target.value)} />
        </label>
        <label className="full-width">URL Template *
          <input value={form.url_template} onChange={e => set('url_template', e.target.value)}
            placeholder="https://{{cpi_host}}/api/v1/..." />
        </label>
        <label>Method
          <select value={form.method} onChange={e => set('method', e.target.value)}>
            {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Auth Type
          <select value={form.auth_type} onChange={e => set('auth_type', e.target.value)}>
            <option value="basic">Basic (PO)</option>
            <option value="oauth2">OAuth2 (CPI)</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>Content-Type
          <input value={form.content_type || ''} onChange={e => set('content_type', e.target.value)} />
        </label>
        <label>SOAP Action
          <input value={form.soap_action || ''} onChange={e => set('soap_action', e.target.value)}
            placeholder="Leave empty for REST" />
        </label>
        <label className="full-width">Request Template
          <textarea rows={6} value={form.request_template || ''} onChange={e => set('request_template', e.target.value)}
            placeholder="XML/JSON body with {{placeholder}} tokens" className="code-area" />
        </label>
      </div>

      <MappingEditor
        mappings={Array.isArray(form.response_mappings) ? form.response_mappings : []}
        onChange={v => set('response_mappings', v)}
      />

      <div className="section-actions">
        <button className="btn btn-primary" onClick={() => onSave(form)}>Save API Config</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function APIConfigs() {
  const { state, notify, loadApiConfigs } = useApp();
  const configs = state.apiConfigs;
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | config object

  async function handleSave(form) {
    try {
      if (form.id) {
        await updateApiConfig(form.id, form);
        notify('API config updated', 'success');
      } else {
        await createApiConfig(form);
        notify('API config created', 'success');
      }
      setEditing(null);
      loadApiConfigs();
    } catch (err) {
      notify('Save failed: ' + err.message, 'error');
    }
  }

  async function handleDelete(cfg) {
    if (!confirm(`Delete API config "${cfg.name}"?`)) return;
    try {
      await deleteApiConfig(cfg.id);
      notify('Deleted', 'success');
      loadApiConfigs();
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'error');
    }
  }

  const grouped = configs.reduce((acc, c) => {
    const g = c.system || 'CUSTOM';
    acc[g] = acc[g] || [];
    acc[g].push(c);
    return acc;
  }, {});

  return (
    <div className="settings-section">
      <div className="section-title-row">
        <h3>API Configurations</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add API Config</button>
      </div>
      <p className="section-hint">
        All API endpoints used by this application. Edit URL templates, request bodies, and response
        XPath/JSONPath mappings here — no restart needed.
      </p>

      {editing && (
        <ApiConfigForm
          config={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {Object.entries(grouped).map(([system, cfgs]) => (
        <div key={system} className="api-group">
          <h4 className={`api-group-title api-system-${system.toLowerCase()}`}>{system} APIs</h4>
          {cfgs.map(cfg => (
            <div key={cfg.id} className={`api-card ${expanded === cfg.id ? 'expanded' : ''}`}>
              <div className="api-card-header" onClick={() => setExpanded(expanded === cfg.id ? null : cfg.id)}>
                <span className="api-card-name">{cfg.name}</span>
                <span className="api-card-method">{cfg.method}</span>
                <span className="api-card-url">{cfg.url_template?.substring(0, 60)}{cfg.url_template?.length > 60 ? '…' : ''}</span>
                <div className="api-card-actions">
                  {!cfg.is_builtin && (
                    <>
                      <button className="btn-icon" title="Edit" onClick={e => { e.stopPropagation(); setEditing(cfg); }}>✏</button>
                      <button className="btn-icon danger" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(cfg); }}>🗑</button>
                    </>
                  )}
                  {cfg.is_builtin && <span className="builtin-tag">built-in</span>}
                  <span className="expand-icon">{expanded === cfg.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded === cfg.id && (
                <div className="api-card-body">
                  <p className="api-desc">{cfg.description || 'No description'}</p>
                  <div className="api-detail-grid">
                    <div><strong>Auth:</strong> {cfg.auth_type}</div>
                    <div><strong>Content-Type:</strong> {cfg.content_type}</div>
                    {cfg.soap_action && <div><strong>SOAP Action:</strong> {cfg.soap_action}</div>}
                  </div>
                  <div className="api-url-full"><strong>URL:</strong> <code>{cfg.url_template}</code></div>
                  {cfg.request_template && (
                    <div className="api-template">
                      <strong>Request Template:</strong>
                      <pre className="code-block">{cfg.request_template}</pre>
                    </div>
                  )}
                  {cfg.response_mappings?.length > 0 && (
                    <div className="api-mappings">
                      <strong>Response Mappings:</strong>
                      <table className="mappings-table">
                        <thead><tr><th>Field</th><th>Path</th><th>Type</th><th>Description</th></tr></thead>
                        <tbody>
                          {cfg.response_mappings.map((m, i) => (
                            <tr key={i}>
                              <td><code>{m.name}</code></td>
                              <td><code>{m.path}</code></td>
                              <td>{m.type}</td>
                              <td>{m.description || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {cfg.is_builtin && (
                    <div className="builtin-edit-note">
                      Built-in configs can be edited using the edit button.{' '}
                      <button className="btn-link" onClick={() => setEditing(cfg)}>Edit this config →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
