import React, { useState } from 'react';
import { createUiComponent, updateUiComponent, deleteUiComponent } from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

const PLACEMENTS = [
  { value: 'row-po',        label: 'Row – PO Actions' },
  { value: 'row-cpi',       label: 'Row – CPI Actions' },
  { value: 'main-toolbar',  label: 'Main Toolbar' },
];
const TYPES = ['action-button', 'status-indicator', 'info-panel'];
const VARIANTS = ['primary', 'success', 'danger', 'warning', 'default'];

const EMPTY = {
  name: '', label: '', type: 'action-button', placement: 'row-po',
  api_config_id: '', input_mappings: {}, display_config: { variant: 'default', icon: '', confirmRequired: true },
  confirm_message: '', sort_order: 0
};

function ComponentForm({ component, apiConfigs, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...component });
  const [rawInputMappings, setRawInputMappings] = useState(
    JSON.stringify(component.input_mappings || {}, null, 2)
  );
  const [rawDisplayConfig, setRawDisplayConfig] = useState(
    JSON.stringify(component.display_config || { variant: 'default', icon: '', confirmRequired: true }, null, 2)
  );

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    try {
      const input_mappings = JSON.parse(rawInputMappings);
      const display_config = JSON.parse(rawDisplayConfig);
      onSave({ ...form, input_mappings, display_config });
    } catch (err) {
      alert('Invalid JSON in mappings: ' + err.message);
    }
  }

  return (
    <div className="component-form">
      <div className="form-grid">
        <label>Name (unique) *<input value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-custom-btn" /></label>
        <label>Button Label *<input value={form.label} onChange={e => set('label', e.target.value)} placeholder="My Action" /></label>
        <label>Type
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Placement
          <select value={form.placement} onChange={e => set('placement', e.target.value)}>
            {PLACEMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label>Linked API Config
          <select value={form.api_config_id || ''} onChange={e => set('api_config_id', e.target.value)}>
            <option value="">— Select API —</option>
            {apiConfigs.map(c => <option key={c.id} value={c.id}>[{c.system}] {c.name}</option>)}
          </select>
        </label>
        <label>Sort Order<input type="number" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} /></label>
        <label className="full-width">Confirm Message
          <input value={form.confirm_message || ''} onChange={e => set('confirm_message', e.target.value)}
            placeholder='Confirm action on "{{row.po_channel_name}}"?' />
        </label>
        <label className="full-width">Input Mappings (JSON)
          <span className="field-desc">Maps API parameters to row fields. Use <code>{"{{row.field}}"}</code> syntax.</span>
          <textarea rows={4} className="code-area" value={rawInputMappings} onChange={e => setRawInputMappings(e.target.value)} />
        </label>
        <label className="full-width">Display Config (JSON)
          <span className="field-desc">
            Supports: <code>variant</code> (primary|success|danger|warning|default), <code>icon</code>, <code>confirmRequired</code>
          </span>
          <textarea rows={4} className="code-area" value={rawDisplayConfig} onChange={e => setRawDisplayConfig(e.target.value)} />
        </label>
      </div>
      <div className="section-actions">
        <button className="btn btn-primary" onClick={handleSave}>Save Component</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function DynamicComponents() {
  const { state, notify, loadUiComponents } = useApp();
  const components = state.uiComponents;
  const apiConfigs = state.apiConfigs;
  const [editing, setEditing] = useState(null);

  async function handleSave(form) {
    try {
      if (form.id) {
        await updateUiComponent(form.id, form);
        notify('Component updated', 'success');
      } else {
        await createUiComponent(form);
        notify('Component created — it will appear on the dashboard', 'success');
      }
      setEditing(null);
      loadUiComponents();
    } catch (err) {
      notify('Save failed: ' + err.message, 'error');
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete component "${c.label}"?`)) return;
    try {
      await deleteUiComponent(c.id);
      notify('Deleted', 'success');
      loadUiComponents();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function toggleActive(c) {
    try {
      await updateUiComponent(c.id, { is_active: !c.is_active });
      loadUiComponents();
    } catch (err) { notify(err.message, 'error'); }
  }

  const grouped = PLACEMENTS.reduce((acc, p) => {
    acc[p.value] = components.filter(c => c.placement === p.value);
    return acc;
  }, {});

  return (
    <div className="settings-section">
      <div className="section-title-row">
        <h3>UI Components</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Add Component</button>
      </div>
      <p className="section-hint">
        Define dynamic buttons and panels that appear on the main dashboard. Each component calls a configured
        API and can receive row context data as parameters.
      </p>

      {editing && (
        <ComponentForm
          component={editing}
          apiConfigs={apiConfigs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {PLACEMENTS.map(p => {
        const comps = grouped[p.value] || [];
        return (
          <div key={p.value} className="comp-placement-group">
            <h4 className="comp-placement-title">{p.label}</h4>
            {comps.length === 0
              ? <p className="empty-hint">No components for this placement.</p>
              : comps.map(c => {
                const dc = c.display_config || {};
                const linkedApi = apiConfigs.find(a => a.id === c.api_config_id);
                return (
                  <div key={c.id} className={`comp-card ${!c.is_active ? 'inactive' : ''}`}>
                    <div className="comp-card-preview">
                      <button className={`btn-action btn-${dc.variant || 'default'} preview-btn`} disabled>
                        {dc.icon || ''} {c.label}
                      </button>
                    </div>
                    <div className="comp-card-meta">
                      <span className="comp-name">{c.name}</span>
                      <span className="comp-api">{linkedApi ? `→ ${linkedApi.name}` : 'No API linked'}</span>
                    </div>
                    <div className="comp-card-actions">
                      <label className="toggle-label">
                        <input type="checkbox" checked={!!c.is_active} onChange={() => toggleActive(c)} />
                        Active
                      </label>
                      <button className="btn-icon" title="Edit" onClick={() => setEditing(c)}>✏</button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(c)}>🗑</button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        );
      })}
    </div>
  );
}
