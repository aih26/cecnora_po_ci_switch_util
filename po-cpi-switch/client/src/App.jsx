import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import InterfaceMetadata from './pages/InterfaceMetadata.jsx';

function AppInner() {
  const { loadSettings, loadTokenStatus, loadStatusCache, loadApiConfigs, loadUiComponents, loadSystemMappings } = useApp();
  useEffect(() => {
    loadSettings();
    loadTokenStatus();
    loadStatusCache();
    loadApiConfigs();
    loadUiComponents();
    loadSystemMappings();
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/metadata" element={<InterfaceMetadata />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </BrowserRouter>
  );
}
