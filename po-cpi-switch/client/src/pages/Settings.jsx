import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import SystemsMapping from '../components/settings/SystemsMapping.jsx';
import APIConfigs from '../components/settings/APIConfigs.jsx';
import DynamicComponents from '../components/settings/DynamicComponents.jsx';
import CSVMapping from '../components/settings/CSVMapping.jsx';
import DashboardColumns from '../components/settings/DashboardColumns.jsx';
import GeneralSettings from '../components/settings/GeneralSettings.jsx';
import { getSettingsGrouped, saveSettings, addSetting } from '../api/index.js';

const TABS = [
  { id: 'general',    label: '🔧 General' },
  { id: 'systems',    label: '🖧 Systems & Mapping' },
  { id: 'csv',        label: '📄 CSV Mapping' },
  { id: 'dashboard',  label: '📊 Dashboard' },
  { id: 'apis',       label: '🔌 API Configurations' },
  { id: 'components', label: '🧩 UI Components' },
];

export default function Settings() {
  const [tab, setTab] = useState('general');
  const { loadSettings } = useApp();

  useEffect(() => { loadSettings(); }, []);

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-body">
        {tab === 'general'    && <GeneralSettings />}
        {tab === 'systems'    && <SystemsMapping />}
        {tab === 'csv'        && <CSVMapping />}
        {tab === 'dashboard'  && <DashboardColumns />}
        {tab === 'apis'       && <APIConfigs />}
        {tab === 'components' && <DynamicComponents />}
      </div>
    </div>
  );
}
