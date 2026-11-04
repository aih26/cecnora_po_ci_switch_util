import React from 'react';

const STATUS_MAP = {
  // PO channel states
  active:        { label: 'Active',      cls: 'status-active' },
  inactive:      { label: 'Inactive',    cls: 'status-inactive' },
  error:         { label: 'Error',       cls: 'status-error' },
  // CPI iflow states
  STARTED:       { label: 'Started',     cls: 'status-active' },
  STOPPED:       { label: 'Stopped',     cls: 'status-inactive' },
  STARTING:      { label: 'Starting',    cls: 'status-pending' },
  STOPPING:      { label: 'Stopping',    cls: 'status-pending' },
  ERROR:         { label: 'Error',       cls: 'status-error' },
  // Special deployment states (resolved via fallback check)
  UNDEPLOYED:    { label: 'Undeployed',  cls: 'status-not-deployed' },
  NOT_FOUND:     { label: 'Not Found',   cls: 'status-not-found' },
  // Generic
  unknown:       { label: '—',           cls: 'status-unknown' },
  loading:       { label: '...',         cls: 'status-loading' }
};

export default function StatusBadge({ value, undeployed, notFound }) {
  if (undeployed) return <span className="status-badge status-not-deployed">Undeployed</span>;
  if (notFound)   return <span className="status-badge status-not-found">Not Found</span>;
  if (!value)     return <span className="status-badge status-unknown">—</span>;
  const key = String(value).trim();
  const def = STATUS_MAP[key] || { label: key, cls: 'status-custom' };
  return <span className={`status-badge ${def.cls}`}>{def.label}</span>;
}

