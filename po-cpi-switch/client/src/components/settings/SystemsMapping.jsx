import React, { useEffect, useState, useCallback } from 'react';
import * as api from '../../api/index.js';
import { useApp } from '../../contexts/AppContext.jsx';

const MASK = '••••••••';

// ── Helpers ──────────────────────────────────────────────────────────────

function Field({ label, desc, type = 'text', value, onChange, readOnly, monospace, style }) {
  return (
    <label className={type === 'boolean' ? 'label-checkbox' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10, ...style }}>
      <span className="field-label">{label}</span>
      {desc && <span className="field-desc">{desc}</span>}
      {type === 'boolean' ? (
        <input type="checkbox" checked={value === 'true' || value === true} onChange={e => onChange(String(e.target.checked))} disabled={readOnly} />
      ) : type === 'password' ? (
        <input type="password" value={value || ''} onChange={e => onChange(e.target.value)} readOnly={readOnly} style={monospace ? { fontFamily: 'monospace' } : {}} />
      ) : (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} readOnly={readOnly} style={monospace ? { fontFamily: 'monospace' } : {}} />
      )}
    </label>
  );
}

function CollapsibleCard({ title, subtitle, badge, children, defaultOpen = false, onDelete, deleteDisabled, deleteTitle }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sys-card" style={{ border: '1px solid var(--border-color, #dee2e6)', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
      <div
        className="sys-card-header"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2, #f8f9fa)', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted, #6c757d)' }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 600, flex: 1 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--text-muted, #6c757d)' }}>{subtitle}</span>}
        {badge && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'var(--accent, #0066cc)', color: '#fff' }}>{badge}</span>}
        {onDelete && (
          <button
            className="btn btn-danger btn-sm"
            style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
            title={deleteTitle || 'Delete'}
            disabled={deleteDisabled}
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            Delete
          </button>
        )}
      </div>
      {open && (
        <div style={{ padding: '12px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── PO Systems ────────────────────────────────────────────────────────────

function PoSystemForm({ system, onSave, onCancel }) {
  const [vals, setVals] = useState({
    name: system?.name || '',
    sid: system?.sid || '',
    host: system?.host || '',
    port: system?.port || '50000',
    https_port: system?.https_port || '50001',
    username: system?.username || '',
    password: system?.id ? MASK : '',
    use_https: system?.use_https || 'false'
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  function set(k, v) { setVals(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!vals.name || !vals.host) return;
    setSaving(true);
    try {
      await onSave(vals);
    } finally { setSaving(false); }
  }

  async function handleTest() {
    if (!system?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testPoSystem(system.id);
      setTestResult(r);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally { setTesting(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Display Name *" value={vals.name} onChange={v => set('name', v)} style={{ flex: 1 }} />
          <Field label="SID" value={vals.sid} onChange={v => set('sid', v)} style={{ flex: '0 0 90px' }} />
        </div>
        <Field label="Host / IP *" value={vals.host} onChange={v => set('host', v)} monospace />
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="HTTP Port" value={vals.port} onChange={v => set('port', v)} style={{ flex: 1 }} />
          <Field label="HTTPS Port" value={vals.https_port} onChange={v => set('https_port', v)} style={{ flex: 1 }} />
        </div>
        <Field label="Username" value={vals.username} onChange={v => set('username', v)} />
        <Field label="Password" type="password" value={vals.password} onChange={v => set('password', v)} />
        <Field label="Use HTTPS" type="boolean" value={vals.use_https} onChange={v => set('use_https', v)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !vals.name || !vals.host}>
          {saving ? 'Saving…' : (system?.id ? 'Save Changes' : 'Add PO System')}
        </button>
        {system?.id && (
          <button className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        )}
        {onCancel && <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>}
      </div>
      {testResult && (
        <div style={{ marginTop: 8, fontSize: 12, color: testResult.ok ? 'var(--success, #198754)' : 'var(--danger, #dc3545)' }}>
          {testResult.ok ? `Connected to ${testResult.host}:${testResult.port}` : `Failed: ${testResult.error}`}
        </div>
      )}
    </div>
  );
}

// ── CPI Tenants ───────────────────────────────────────────────────────────

function CpiTenantForm({ tenant, onSave, onCancel }) {
  const [vals, setVals] = useState({
    name: tenant?.name || '',
    host: tenant?.host || '',
    token_url: tenant?.token_url || '',
    client_id: tenant?.client_id || '',
    client_secret: tenant?.id ? MASK : ''
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setVals(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!vals.name || !vals.host) return;
    setSaving(true);
    try { await onSave(vals); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Field label="Display Name *" value={vals.name} onChange={v => set('name', v)} />
        <Field label="Host (without https://) *" value={vals.host} onChange={v => set('host', v)} monospace />
        <Field label="OAuth2 Token URL" value={vals.token_url} onChange={v => set('token_url', v)} monospace />
        <Field label="Client ID" value={vals.client_id} onChange={v => set('client_id', v)} />
        <Field label="Client Secret" type="password" value={vals.client_secret} onChange={v => set('client_secret', v)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !vals.name || !vals.host}>
          {saving ? 'Saving…' : (tenant?.id ? 'Save Changes' : 'Add CPI Tenant')}
        </button>
        {onCancel && <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

// ── System Mapping Card ───────────────────────────────────────────────────

function SideBadge({ type, id, poSystems, cpiTenants }) {
  const isPo = type === 'po';
  const sys  = isPo ? poSystems.find(p => p.id === id) : cpiTenants.find(c => c.id === id);
  const bg   = isPo ? 'rgba(0,100,200,0.06)'  : 'rgba(0,180,130,0.06)';
  const bdr  = isPo ? 'rgba(0,100,200,0.2)'   : 'rgba(0,180,130,0.2)';
  return (
    <div style={{ flex: 1, padding: '6px 10px', borderRadius: 5, background: bg, border: `1px solid ${bdr}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, #6c757d)', marginBottom: 2 }}>{isPo ? 'PI / PO' : 'CPI'}</div>
      <div style={{ fontWeight: 600 }}>{sys?.name || '—'}</div>
      {isPo && sys?.sid && <div style={{ fontSize: 11, color: 'var(--text-muted, #6c757d)' }}>SID: {sys.sid}</div>}
      {sys?.host && <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted, #6c757d)' }}>{sys.host}</div>}
    </div>
  );
}

function MappingCard({ mapping, poSystems, cpiTenants, onSetDefault, onDelete, onEdit }) {
  const aType = mapping.system_a_type || 'po';
  const aId   = mapping.system_a_id   || mapping.po_system_id;
  const bType = mapping.system_b_type || 'cpi';
  const bId   = mapping.system_b_id   || mapping.cpi_tenant_id;
  return (
    <div style={{
      border: `2px solid ${mapping.is_default ? 'var(--accent, #0066cc)' : 'var(--border-color, #dee2e6)'}`,
      borderRadius: 8, padding: '12px 14px', marginBottom: 10,
      background: mapping.is_default ? 'var(--accent-subtle, #e8f0fe)' : 'var(--surface-1, #fff)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, flex: 1, fontSize: 15 }}>{mapping.name}</span>
        {mapping.is_default && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--accent, #0066cc)', color: '#fff', fontWeight: 600 }}>DEFAULT</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
        <SideBadge type={aType} id={aId} poSystems={poSystems} cpiTenants={cpiTenants} />
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: 'var(--text-muted, #6c757d)' }}>⇄</div>
        <SideBadge type={bType} id={bId} poSystems={poSystems} cpiTenants={cpiTenants} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!mapping.is_default && (
          <button className="btn btn-secondary btn-sm" onClick={() => onSetDefault(mapping.id)} style={{ fontSize: 11 }}>Set as Default</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(mapping)} style={{ fontSize: 11 }}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(mapping.id)} style={{ fontSize: 11 }}>Delete</button>
      </div>
    </div>
  );
}

function autoMappingName(aType, aId, bType, bId, poSystems, cpiTenants) {
  function label(type, id) {
    if (type === 'po') { const s = poSystems.find(p => p.id === id); return s ? (s.sid || s.name) : ''; }
    const t = cpiTenants.find(c => c.id === id); return t ? t.name : '';
  }
  const a = label(aType, aId), b = label(bType, bId);
  if (a && b) return `${a} ↔ ${b}`;
  return a || b || '';
}

function MappingForm({ mapping, poSystems, cpiTenants, onSave, onCancel }) {
  const initAType = mapping?.system_a_type || (mapping?.po_system_id  ? 'po'  : 'po');
  const initAId   = mapping?.system_a_id   || mapping?.po_system_id   || (poSystems[0]?.id  || '');
  const initBType = mapping?.system_b_type || (mapping?.cpi_tenant_id ? 'cpi' : 'cpi');
  const initBId   = mapping?.system_b_id   || mapping?.cpi_tenant_id  || (cpiTenants[0]?.id || '');

  const [vals, setVals] = useState({
    name:          mapping?.name || autoMappingName(initAType, initAId, initBType, initBId, poSystems, cpiTenants),
    system_a_type: initAType,
    system_a_id:   initAId,
    system_b_type: initBType,
    system_b_id:   initBId,
    is_default:    mapping?.is_default || false
  });
  const [nameEdited, setNameEdited] = useState(!!mapping?.id);
  const [saving, setSaving] = useState(false);

  function set(k, v) {
    setVals(p => {
      const next = { ...p, [k]: v };
      if (k === 'system_a_type') next.system_a_id = v === 'po' ? (poSystems[0]?.id || '') : (cpiTenants[0]?.id || '');
      if (k === 'system_b_type') next.system_b_id = v === 'po' ? (poSystems[0]?.id || '') : (cpiTenants[0]?.id || '');
      if (['system_a_type','system_a_id','system_b_type','system_b_id'].includes(k) && !nameEdited)
        next.name = autoMappingName(next.system_a_type, next.system_a_id, next.system_b_type, next.system_b_id, poSystems, cpiTenants);
      return next;
    });
  }

  function handleNameChange(v) { setNameEdited(true); setVals(p => ({ ...p, name: v })); }

  async function handleSave() {
    if (!vals.name || !vals.system_a_id || !vals.system_b_id) return;
    setSaving(true);
    try { await onSave(vals); }
    finally { setSaving(false); }
  }

  function SystemSide({ sideLabel, typeKey, idKey }) {
    const type    = vals[typeKey];
    const systems = type === 'po' ? poSystems : cpiTenants;
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        <span className="field-label">{sideLabel} *</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={type} onChange={e => set(typeKey, e.target.value)} style={{ flex: '0 0 110px' }}>
            <option value="po">PI / PO</option>
            <option value="cpi">CPI</option>
          </select>
          <select value={vals[idKey]} onChange={e => set(idKey, e.target.value)} style={{ flex: 1 }}>
            <option value="">Select system…</option>
            {systems.map(s => <option key={s.id} value={s.id}>{s.name}{s.sid ? ` (${s.sid})` : ''}</option>)}
          </select>
        </div>
      </label>
    );
  }

  return (
    <div className="settings-section" style={{ padding: 14, border: '1px solid var(--border-color, #dee2e6)', borderRadius: 6, marginBottom: 12 }}>
      <h4 style={{ margin: '0 0 12px' }}>{mapping?.id ? 'Edit Mapping' : 'New System Mapping'}</h4>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
        <span className="field-label">Mapping Name *</span>
        <input type="text" value={vals.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. N75 ↔ DEMO1" />
      </label>
      <SystemSide sideLabel="System A" typeKey="system_a_type" idKey="system_a_id" />
      <SystemSide sideLabel="System B" typeKey="system_b_type" idKey="system_b_id" />
      <label className="label-checkbox" style={{ marginBottom: 10 }}>
        <span className="field-label">Set as default mapping</span>
        <span className="field-desc">The default mapping is automatically selected on the Dashboard.</span>
        <input type="checkbox" checked={!!vals.is_default} onChange={e => set('is_default', e.target.checked)} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !vals.name || !vals.system_a_id || !vals.system_b_id}>
          {saving ? 'Saving…' : (mapping?.id ? 'Save Changes' : 'Create Mapping')}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function SystemsMapping() {
  const { state, notify, loadSystemMappings } = useApp();
  const { poSystems, cpiTenants, systemMappings } = state;
  const loading = poSystems.length === 0 && cpiTenants.length === 0 && systemMappings.length === 0;

  const [addingPo, setAddingPo] = useState(false);
  const [addingCpi, setAddingCpi] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);

  const reload = useCallback(() => loadSystemMappings(), [loadSystemMappings]);

  // ── PO System handlers ──
  async function handleAddPo(vals) {
    try {
      await api.createPoSystem(vals);
      notify('PO system added', 'success');
      setAddingPo(false);
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleSavePo(id, vals) {
    try {
      await api.updatePoSystem(id, vals);
      notify('PO system saved', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleDeletePo(id) {
    if (!window.confirm('Delete this PO system?')) return;
    try {
      await api.deletePoSystem(id);
      notify('PO system deleted', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  // ── CPI Tenant handlers ──
  async function handleAddCpi(vals) {
    try {
      await api.createCpiTenant(vals);
      notify('CPI tenant added', 'success');
      setAddingCpi(false);
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleSaveCpi(id, vals) {
    try {
      await api.updateCpiTenant(id, vals);
      notify('CPI tenant saved', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleDeleteCpi(id) {
    if (!window.confirm('Delete this CPI tenant?')) return;
    try {
      await api.deleteCpiTenant(id);
      notify('CPI tenant deleted', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  // ── System Mapping handlers ──
  async function handleAddMapping(vals) {
    try {
      await api.createSystemMapping(vals);
      notify('System mapping created', 'success');
      setAddingMapping(false);
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleEditMapping(vals) {
    try {
      await api.updateSystemMapping(editingMapping.id, vals);
      notify('System mapping updated', 'success');
      setEditingMapping(null);
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleSetDefault(id) {
    try {
      await api.setDefaultSystemMapping(id);
      notify('Default mapping updated', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  async function handleDeleteMapping(id) {
    if (!window.confirm('Delete this system mapping? Interface mappings using it will lose their system association.')) return;
    try {
      await api.deleteSystemMapping(id);
      notify('System mapping deleted', 'success');
      reload();
    } catch (err) { notify(err.response?.data?.error || err.message, 'error'); }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* ── Left panel: PO Systems + CPI Tenants ── */}
      <div style={{ flex: '2 1 0', minWidth: 0 }}>

        {/* PO Systems */}
        <div className="settings-section" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>PO / PI Systems</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setAddingPo(true); }}>+ Add System</button>
          </div>
          <p className="section-hint" style={{ margin: '0 0 10px' }}>
            SAP PO or PI systems. Each system stores its own connection settings and credentials.
          </p>

          {addingPo && (
            <div style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, marginBottom: 10 }}>
              <h4 style={{ margin: '0 0 10px' }}>New PO System</h4>
              <PoSystemForm onSave={handleAddPo} onCancel={() => setAddingPo(false)} />
            </div>
          )}

          {poSystems.length === 0 && !addingPo && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No PO systems yet. Add one to get started.
            </div>
          )}

          {poSystems.map(sys => (
            <CollapsibleCard
              key={sys.id}
              title={sys.name}
              subtitle={sys.sid ? `SID: ${sys.sid}` : null}
              badge={sys.host ? sys.host.split('.')[0] : null}
              onDelete={() => handleDeletePo(sys.id)}
              deleteTitle="Delete this PO system"
            >
              <PoSystemForm system={sys} onSave={vals => handleSavePo(sys.id, vals)} />
            </CollapsibleCard>
          ))}
        </div>

        {/* CPI Tenants */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>CPI Tenants</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setAddingCpi(true)}>+ Add Tenant</button>
          </div>
          <p className="section-hint" style={{ margin: '0 0 10px' }}>
            SAP Cloud Integration tenants. Each tenant has its own OAuth2 credentials.
          </p>

          {addingCpi && (
            <div style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, marginBottom: 10 }}>
              <h4 style={{ margin: '0 0 10px' }}>New CPI Tenant</h4>
              <CpiTenantForm onSave={handleAddCpi} onCancel={() => setAddingCpi(false)} />
            </div>
          )}

          {cpiTenants.length === 0 && !addingCpi && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No CPI tenants yet. Add one to get started.
            </div>
          )}

          {cpiTenants.map(tenant => (
            <CollapsibleCard
              key={tenant.id}
              title={tenant.name}
              subtitle={tenant.host ? tenant.host.split('.')[0] : null}
              onDelete={() => handleDeleteCpi(tenant.id)}
              deleteTitle="Delete this CPI tenant"
            >
              <CpiTenantForm tenant={tenant} onSave={vals => handleSaveCpi(tenant.id, vals)} />
            </CollapsibleCard>
          ))}
        </div>
      </div>

      {/* ── Right panel: System Mappings ── */}
      <div style={{ flex: '3 1 0', minWidth: 0 }}>
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>System Mappings</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setAddingMapping(true); setEditingMapping(null); }}>
              + Add Mapping
            </button>
          </div>
          <p className="section-hint" style={{ margin: '0 0 14px' }}>
            Pair a PO/PI system with a CPI tenant. The default mapping is shown automatically on the Dashboard.
            Interface data uploaded is linked to the selected mapping.
          </p>

          {(addingMapping || editingMapping) && (
            <MappingForm
              mapping={editingMapping}
              poSystems={poSystems}
              cpiTenants={cpiTenants}
              onSave={editingMapping ? handleEditMapping : handleAddMapping}
              onCancel={() => { setAddingMapping(false); setEditingMapping(null); }}
            />
          )}

          {systemMappings.length === 0 && !addingMapping && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border-color)', borderRadius: 6 }}>
              No system mappings yet. Add PO systems and CPI tenants first, then create a mapping.
            </div>
          )}

          {systemMappings.map(m => (
            <MappingCard
              key={m.id}
              mapping={m}
              poSystems={poSystems}
              cpiTenants={cpiTenants}
              onSetDefault={handleSetDefault}
              onDelete={handleDeleteMapping}
              onEdit={(m) => { setEditingMapping(m); setAddingMapping(false); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
