import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../contexts/AppContext.jsx';

export default function Layout({ children }) {
  const { state, dispatch, setActiveSystemMappingId } = useApp();
  const { notification, settingsGrouped, tokenStatus, systemMappings, poSystems, cpiTenants, activeSystemMappingId } = state;

  const appTitle = settingsGrouped?.['General']?.find(s => s.key === 'app_title')?.value || 'PI/CPI Switch Panel';

  let poLabel = '—', cpiLabel = '—';
  const activeMapping = systemMappings.find(m => m.id === activeSystemMappingId);
  if (activeMapping) {
    const aType = activeMapping.system_a_type || 'po';
    const aId   = activeMapping.system_a_id   || activeMapping.po_system_id;
    const bType = activeMapping.system_b_type || 'cpi';
    const bId   = activeMapping.system_b_id   || activeMapping.cpi_tenant_id;
    const po  = aType === 'po' ? poSystems.find(p => p.id === aId)  : poSystems.find(p => p.id === bId);
    const cpi = aType === 'cpi' ? cpiTenants.find(c => c.id === aId) : cpiTenants.find(c => c.id === bId);
    if (po)  poLabel  = po.sid  || po.name;
    if (cpi) cpiLabel = cpi.name;
  } else {
    poLabel  = settingsGrouped?.['PO Connection']?.find(s => s.key === 'po_sid')?.value  || '—';
    cpiLabel = settingsGrouped?.['CPI Connection']?.find(s => s.key === 'cpi_tenant_name')?.value || '—';
  }

  function dismiss() { dispatch({ type: 'SET_NOTIFICATION', payload: null }); }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">⇄</span>
          <span className="topbar-title">{appTitle}</span>
          <span className="topbar-sys">
            <span className="sys-badge po-badge">PI: {poLabel}</span>
            <span className="sys-badge cpi-badge">CPI: {cpiLabel}</span>
          </span>
        </div>
        <nav className="topbar-nav">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="nav-icon">⇄</span> Dashboard
          </NavLink>
          <NavLink to="/metadata" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="nav-icon">📋</span> Interface Metadata
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="nav-icon">⚙</span> Settings
          </NavLink>
          {systemMappings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
                {(() => {
                  const m = systemMappings.find(x => x.id === activeSystemMappingId);
                  const aType = m?.system_a_type || 'po';
                  const bType = m?.system_b_type || 'cpi';
                  return (aType === 'cpi' && bType === 'cpi') ? 'Tenant Mapping:' : 'System Mapping:';
                })()}
              </label>
              <select
                value={activeSystemMappingId || ''}
                onChange={e => setActiveSystemMappingId(e.target.value || null)}
                style={{
                  fontSize: 12, padding: '3px 8px', borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                {systemMappings.map(m => (
                  <option key={m.id} value={m.id} style={{ background: '#333', color: '#fff' }}>
                    {m.name}{m.is_default ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>
        <div className="topbar-right">
          {tokenStatus && (
            <span className={`token-badge ${tokenStatus.status === 'valid' ? 'valid' : tokenStatus.status === 'none' ? 'none' : 'expired'}`}
              title={tokenStatus.message}>
              {tokenStatus.status === 'valid' ? '🔐 Token OK' : tokenStatus.status === 'none' ? '🔓 No Token' : '⚠ Token Expired'}
            </span>
          )}
        </div>
      </header>

      <main className="main-content">
        {notification && (
          <div className={`notification notification-${notification.type}`} onClick={dismiss} title="Click to dismiss">
            <span className="notification-msg">{notification.message}</span>
            <button className="notification-close" onClick={dismiss}>✕</button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
