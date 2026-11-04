import React, { useEffect } from 'react';
import MappingUpload from '../components/MappingUpload.jsx';
import { useApp } from '../contexts/AppContext.jsx';

export default function InterfaceMetadata() {
  const { state, loadMappings, loadSystemMappings, setActiveSystemMappingId } = useApp();
  const { systemMappings, activeSystemMappingId, mappings, settingsGrouped } = state;

  const activeMapping = systemMappings.find(m => m.id === activeSystemMappingId);

  // If navigated here directly (no Dashboard pass), ensure system mappings + interface rows are loaded
  useEffect(() => {
    if (systemMappings.length === 0) {
      loadSystemMappings().then(({ sysMaps }) => {
        if (!sysMaps.length) return;
        const def = sysMaps.find(m => m.is_default) || sysMaps[0];
        setActiveSystemMappingId(def.id);
      });
    }
  }, []);

  useEffect(() => {
    if (activeSystemMappingId && mappings.length === 0) {
      loadMappings(activeSystemMappingId);
    }
  }, [activeSystemMappingId]);

  // Derive CSV columns from settings
  const csvCols = (() => {
    const raw = (settingsGrouped['CSV Mapping'] || []).find(s => s.key === 'csv_column_map')?.value;
    if (!raw) return [];
    try {
      return JSON.parse(raw)
        .filter(c => c.fieldName && c.enabled !== false)
        .sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0));
    } catch { return []; }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Upload header ── */}
      <div style={{
        borderBottom: '1px solid var(--border-color, #dee2e6)',
        background: 'var(--surface-1, #fff)', flexShrink: 0
      }}>
        {systemMappings.length === 0 ? (
          <div style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-muted, #6c757d)' }}>
            No system mappings configured yet.
            Go to <strong>Settings → Systems &amp; Mapping</strong> to set one up first.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #6c757d)', whiteSpace: 'nowrap' }}>
              Interface Metadata:
            </span>
            {activeMapping ? (
              <span style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                background: 'var(--accent-subtle, #e8f0fe)',
                border: '1px solid var(--accent, #0066cc)',
                color: 'var(--accent, #0066cc)', whiteSpace: 'nowrap'
              }}>
                {activeMapping.name}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted, #6c757d)' }}>
                Select a system mapping from the top bar
              </span>
            )}
            <div style={{ flex: 1 }} />
            {mappings.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted, #6c757d)', whiteSpace: 'nowrap' }}>
                {mappings.length} row{mappings.length !== 1 ? 's' : ''}
              </span>
            )}
            <MappingUpload
              onUploaded={() => loadMappings(activeSystemMappingId)}
            />
          </div>
        )}
      </div>

      {/* ── Interface table ── */}
      {mappings.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, color: 'var(--text-muted, #6c757d)'
        }}>
          <div style={{ fontSize: 32 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>No interfaces loaded</div>
          <div style={{ fontSize: 13 }}>
            {activeMapping
              ? 'Upload a CSV or Excel file using the toolbar above.'
              : 'Select a system mapping from the top bar first.'}
          </div>
        </div>
      ) : csvCols.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted, #6c757d)', fontSize: 14
        }}>
          Configure CSV column mapping in <strong style={{ marginLeft: 4 }}>Settings → CSV Mapping</strong> to define which fields to show.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 13,
            tableLayout: 'auto'
          }}>
            <thead>
              <tr style={{ background: 'var(--surface-2, #f8f9fa)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={thStyle}>#</th>
                {csvCols.map(c => (
                  <th key={c.fieldName} style={thStyle}>{c.label || c.fieldName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color, #dee2e6)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2, #f8f9fa)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...tdStyle, color: 'var(--text-muted, #6c757d)', width: 40, textAlign: 'right' }}>
                    {i + 1}
                  </td>
                  {csvCols.map(c => (
                    <td key={c.fieldName} style={tdStyle}>
                      {row[c.fieldName] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '7px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12,
  borderBottom: '2px solid var(--border-color, #dee2e6)',
  whiteSpace: 'nowrap', color: 'var(--text-secondary, #495057)'
};

const tdStyle = {
  padding: '6px 12px', verticalAlign: 'middle',
  fontFamily: 'monospace', fontSize: 12, maxWidth: 260,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
};
