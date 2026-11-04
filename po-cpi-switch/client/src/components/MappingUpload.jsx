import React, { useRef, useState } from 'react';
import { uploadMappingFile } from '../api/index.js';
import { useApp } from '../contexts/AppContext.jsx';

export default function MappingUpload({ onUploaded }) {
  const { state } = useApp();
  const fileRef = useRef(null);
  const [loading, setLoading]   = useState(false);
  const [replace, setReplace]   = useState(true);
  const [result, setResult]     = useState(null);
  const [fileName, setFileName] = useState('');

  const { systemMappings, activeSystemMappingId } = state;
  const activeMapping = systemMappings.find(m => m.id === activeSystemMappingId);

  const general   = state.settingsGrouped?.['General'] || [];
  const title     = general.find(s => s.key === 'upload_title')?.value     || 'PO Interface ↔ CPI iFlow Mapping';
  const hint      = general.find(s => s.key === 'upload_hint')?.value      || 'Select your CSV or Excel mapping file (.csv, .xlsx, .xls)';
  const btnLabel  = general.find(s => s.key === 'upload_btn_label')?.value || 'Import Mapping Metadata';

  function handleFileChange(e) {
    setFileName(e.target.files[0]?.name || '');
    setResult(null);
  }

  async function handleUpload() {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('replace', String(replace));
      if (activeSystemMappingId) fd.append('system_mapping_id', activeSystemMappingId);
      const data = await uploadMappingFile(fd);
      setResult({ ok: true, message: `Imported ${data.inserted} of ${data.total} rows.` });
      if (onUploaded) onUploaded();
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #6c757d)', whiteSpace: 'nowrap' }}>
        {title}:
      </span>
      {activeMapping && (
        <span style={{
          fontSize: 12, padding: '2px 8px', borderRadius: 4,
          background: 'var(--accent-subtle, #e8f0fe)',
          border: '1px solid var(--accent, #0066cc)',
          color: 'var(--accent, #0066cc)', whiteSpace: 'nowrap', fontWeight: 500
        }}>
          {activeMapping.name}
        </span>
      )}
      <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
        📂 Select File
      </button>
      <span className={`upload-filename${fileName ? ' has-file' : ''}`} title={fileName}>
        {fileName || 'No file selected'}
      </span>
      <label className="upload-option">
        <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
        Replace existing
      </label>
      <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={loading || !fileName}>
        {loading ? 'Importing…' : btnLabel}
      </button>
      {result && (
        <span className={`upload-result ${result.ok ? 'ok' : 'err'}`}>{result.message}</span>
      )}
      <input
        type="file" ref={fileRef} accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }} onChange={handleFileChange}
      />
    </div>
  );
}
