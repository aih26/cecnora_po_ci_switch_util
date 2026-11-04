import React, { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import InterfaceTable from '../components/InterfaceTable.jsx';
import * as api from '../api/index.js';

function formatLastSync(iso, fmt = 'DD/MM/YYYY HH:mm') {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const dd   = String(d.getDate()).padStart(2, '0');
    const MM   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const HH   = String(d.getHours()).padStart(2, '0');
    const mm   = String(d.getMinutes()).padStart(2, '0');
    const ss   = String(d.getSeconds()).padStart(2, '0');
    const datePart = fmt.replace('DD', dd).replace('MM', MM).replace('YYYY', yyyy).replace('HH', HH).replace('mm', mm);
    return datePart.includes(':') ? datePart + ':' + ss : datePart + ' ' + HH + ':' + mm + ':' + ss;
  } catch { return null; }
}

export default function Dashboard() {
  const {
    state, loadMappings, loadUiComponents, loadTokenStatus,
    refreshAllStatus, notify, loadSystemMappings, setActiveSystemMappingId,
    loadStatusCache
  } = useApp();
  const { mappings, uiComponents, settingsGrouped, refreshProgress, lastRefreshTimes,
          systemMappings, activeSystemMappingId } = state;
  const intervalRef         = useRef(null);
  const autoRefreshedForRef = useRef(null);

  const refreshInterval = parseInt(
    (settingsGrouped?.['General'] || []).find(s => s.key === 'refresh_interval')?.value || '0', 10
  );
  const dateFormat = (settingsGrouped?.['General'] || []).find(s => s.key === 'date_format')?.value || 'DD/MM/YYYY HH:mm';
  const autoRefreshOnLoad = (settingsGrouped?.['General'] || []).find(s => s.key === 'auto_refresh_on_load')?.value === 'true';

  // Load system mappings on mount, then set active to the default one
  useEffect(() => {
    loadSystemMappings().then(({ sysMaps }) => {
      if (!sysMaps.length) return;
      const defaultMap = sysMaps.find(m => m.is_default) || sysMaps[0];
      setActiveSystemMappingId(defaultMap.id);
    });
    loadUiComponents();
    loadTokenStatus();
  }, []);

  // When active system mapping changes, reload mappings
  useEffect(() => {
    if (activeSystemMappingId === null) return;
    loadMappings(activeSystemMappingId);
  }, [activeSystemMappingId]);

  // Auto-refresh (or cache restore) when mappings + settings ready — per-mapping, respects auto_refresh_on_load
  useEffect(() => {
    if (!mappings.length) return;
    if (!Object.keys(settingsGrouped).length) return;
    const key = activeSystemMappingId || 'all';
    if (autoRefreshedForRef.current === key) return;
    autoRefreshedForRef.current = key;
    if (autoRefreshOnLoad) {
      refreshAllStatus(mappings, undefined, activeSystemMappingId);
    } else {
      loadStatusCache(activeSystemMappingId);
    }
  }, [mappings, settingsGrouped, activeSystemMappingId, autoRefreshOnLoad]);

  // Periodic auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => refreshAllStatus(), refreshInterval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refreshInterval, refreshAllStatus]);

  async function handleRefreshAll() {
    try {
      await refreshAllStatus(mappings, undefined, activeSystemMappingId);
      await loadTokenStatus();
    } catch (err) {
      notify('Refresh failed: ' + err.message, 'error');
    }
  }

  async function handleRefreshToken() {
    try {
      await api.refreshCpiToken();
      await loadTokenStatus();
      notify('CPI token refreshed', 'success');
    } catch (err) {
      notify('Token refresh failed: ' + err.message, 'error');
    }
  }

  const lastRefreshTime = lastRefreshTimes[activeSystemMappingId || 'all'] || null;

  const pct = refreshProgress.total > 0
    ? Math.round((refreshProgress.done / refreshProgress.total) * 100)
    : 0;

  return (
    <div className="dashboard">
      {/* ── Controls bar: refresh only ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
        padding: '6px 14px', borderBottom: '1px solid var(--border-color, #dee2e6)',
        background: 'var(--surface-1, #fff)', minHeight: 42
      }}>
        <div style={{ flex: 1 }} />
        {mappings.length > 0 && lastRefreshTime && (
          <span className="last-refresh-time" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
            Last Sync: {formatLastSync(lastRefreshTime, dateFormat)}
          </span>
        )}
        <button className="btn btn-primary btn-sm" onClick={handleRefreshAll}
          disabled={!mappings.length || refreshProgress.active}>
          {refreshProgress.active ? '↻ Refreshing…' : '↻ Refresh All'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleRefreshToken} title="Re-fetch CPI OAuth2 token">
          🔐 Refresh Token
        </button>
      </div>

      {refreshProgress.active && (
        <div className="refresh-banner">
          <div className="refresh-banner-bar">
            <div className="refresh-banner-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #6c757d)', padding: '1px 8px', whiteSpace: 'nowrap' }}>
            {pct}% ({refreshProgress.done}/{refreshProgress.total})
          </span>
        </div>
      )}

      {mappings.length === 0 ? (
        <div className="empty-dashboard">
          <div className="empty-icon">⇄</div>
          <h2>No interfaces loaded</h2>
          <p>Go to <strong>Interface Metadata</strong> to upload a PO ↔ CPI mapping file for this system mapping.</p>
          {systemMappings.length === 0 && (
            <p className="hint">First configure your systems in <strong>Settings → Systems &amp; Mapping</strong>.</p>
          )}
        </div>
      ) : (
        <InterfaceTable
          mappings={mappings}
          uiComponents={uiComponents}
          onRefreshRow={loadMappings}
        />
      )}
    </div>
  );
}
