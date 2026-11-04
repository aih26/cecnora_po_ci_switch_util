import React, { createContext, useContext, useReducer, useCallback } from 'react';
import * as api from '../api/index.js';

const AppContext = createContext(null);

const DEFAULT_DASH_COLS = [
  { id:'dc_po_party',   label:'Sender Party',   side:'po',  source:'mapping', field:'po_sender_party',   type:'text',     enabled:true },
  { id:'dc_po_svc',     label:'Sender Service', side:'po',  source:'mapping', field:'po_sender_service', type:'text',     enabled:true },
  { id:'dc_po_ch',      label:'Channel Name',   side:'po',  source:'mapping', field:'po_channel_name',   type:'mono',     enabled:true },
  { id:'dc_po_iface',   label:'Interface/ICO',  side:'po',  source:'mapping', field:'po_interface_name', fallback:'po_ico_name', type:'mono', enabled:true },
  { id:'dc_po_status',  label:'Status',         side:'po',  source:'api', api_config_id:'po-get-channel-state', response_field:'state',    input_mappings:{channelObjectId:'{{row.po_channel_object_id}}'}, type:'badge',    enabled:true },
  { id:'dc_po_lastmsg', label:'Last Msg',       side:'po',  source:'api', api_config_id:'po-last-message',      response_field:'lastTime', input_mappings:{senderParty:'{{row.po_sender_party}}',senderService:'{{row.po_sender_service}}'}, type:'datetime', enabled:true },
  { id:'dc_cpi_iflow',  label:'iFlow Name',     side:'cpi', source:'mapping', field:'cpi_iflow_name', fallback:'cpi_iflow_id', type:'mono', enabled:true },
  { id:'dc_cpi_status', label:'Status',         side:'cpi', source:'api', api_config_id:'cpi-iflow-status', response_field:'status',   input_mappings:{iflowId:'{{row.cpi_iflow_id}}'}, type:'badge',    enabled:true },
  { id:'dc_cpi_mpl',    label:'Last MPL',       side:'cpi', source:'api', api_config_id:'cpi-last-mpl',     response_field:'lastTime', input_mappings:{iflowId:'{{row.cpi_iflow_id}}'}, type:'datetime', enabled:true },
];

const PARALLEL_ROWS_DEFAULT = 20;

const initialState = {
  settings: [],
  settingsGrouped: {},
  mappings: [],
  rowStatus: {},
  apiConfigs: [],
  uiComponents: [],
  dashboardColumns: DEFAULT_DASH_COLS,
  tokenStatus: null,
  notification: null,
  refreshProgress: { active: false, done: 0, total: 0 },
  lastRefreshTime: null,
  lastRefreshTimes: {},
  // multi-system
  systemMappings: [],
  poSystems: [],
  cpiTenants: [],
  activeSystemMappingId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS':         return { ...state, settings: action.payload };
    case 'SET_SETTINGS_GROUPED': return { ...state, settingsGrouped: action.payload };
    case 'SET_MAPPINGS':         return { ...state, mappings: action.payload };
    case 'SET_API_CONFIGS':      return { ...state, apiConfigs: action.payload };
    case 'SET_UI_COMPONENTS':    return { ...state, uiComponents: action.payload };
    case 'SET_DASH_COLS':        return { ...state, dashboardColumns: action.payload };
    case 'SET_TOKEN_STATUS':     return { ...state, tokenStatus: action.payload };
    case 'SET_NOTIFICATION':     return { ...state, notification: action.payload };
    case 'SET_REFRESH_PROGRESS': return { ...state, refreshProgress: action.payload };
    case 'SET_LAST_REFRESH': {
      const key = action.mappingId !== undefined ? (action.mappingId || 'all') : 'all';
      return { ...state, lastRefreshTime: action.payload, lastRefreshTimes: { ...state.lastRefreshTimes, [key]: action.payload } };
    }
    case 'SET_SYSTEM_MAPPINGS':  return { ...state, systemMappings: action.payload };
    case 'SET_PO_SYSTEMS':       return { ...state, poSystems: action.payload };
    case 'SET_CPI_TENANTS':      return { ...state, cpiTenants: action.payload };
    case 'SET_ACTIVE_MAPPING_ID': return { ...state, activeSystemMappingId: action.payload };
    case 'SET_ROW_STATUS': return {
      ...state,
      rowStatus: { ...state.rowStatus, [action.id]: { ...state.rowStatus[action.id], ...action.payload } }
    };
    case 'SET_ROW_LOADING': return {
      ...state,
      rowStatus: { ...state.rowStatus, [action.id]: { ...state.rowStatus[action.id], loading: action.payload } }
    };
    case 'SET_ALL_ROW_STATUS': {
      const next = { ...state.rowStatus };
      Object.entries(action.payload).forEach(([id, status]) => {
        next[id] = { ...next[id], loading: false, apis: status };
      });
      return { ...state, rowStatus: next };
    }
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const notify = useCallback((message, type = 'info') => {
    const id = Date.now();
    dispatch({ type: 'SET_NOTIFICATION', payload: { message, type, id } });
    if (type !== 'error') {
      setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', payload: null }), 5000);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const grouped = await api.getSettingsGrouped();
      dispatch({ type: 'SET_SETTINGS_GROUPED', payload: grouped });
      const raw = (grouped['Dashboard'] || []).find(s => s.key === 'dashboard_columns')?.value;
      if (raw) {
        try { dispatch({ type: 'SET_DASH_COLS', payload: JSON.parse(raw) }); }
        catch { /* keep default */ }
      }
    } catch (err) { notify('Failed to load settings: ' + err.message, 'error'); }
  }, [notify]);

  const loadSystemMappings = useCallback(async () => {
    try {
      const [sysMaps, poSystems, cpiTenants] = await Promise.all([
        api.getSystemMappings(),
        api.getPoSystems(),
        api.getCpiTenants()
      ]);
      dispatch({ type: 'SET_SYSTEM_MAPPINGS', payload: sysMaps });
      dispatch({ type: 'SET_PO_SYSTEMS', payload: poSystems });
      dispatch({ type: 'SET_CPI_TENANTS', payload: cpiTenants });
      return { sysMaps, poSystems, cpiTenants };
    } catch (err) {
      notify('Failed to load system mappings: ' + err.message, 'error');
      return { sysMaps: [], poSystems: [], cpiTenants: [] };
    }
  }, [notify]);

  const setActiveSystemMappingId = useCallback((id) => {
    dispatch({ type: 'SET_ACTIVE_MAPPING_ID', payload: id });
    dispatch({ type: 'SET_MAPPINGS', payload: [] });
  }, []);

  const loadMappings = useCallback(async (systemMappingId) => {
    try {
      const id = systemMappingId !== undefined ? systemMappingId : state.activeSystemMappingId;
      const data = await api.getMappings(id);
      dispatch({ type: 'SET_MAPPINGS', payload: data });
      return data;
    } catch (err) { notify('Failed to load mappings: ' + err.message, 'error'); return []; }
  }, [notify, state.activeSystemMappingId]);

  const loadApiConfigs = useCallback(async () => {
    try {
      const data = await api.getApiConfigs();
      dispatch({ type: 'SET_API_CONFIGS', payload: data });
    } catch (err) { notify('Failed to load API configs: ' + err.message, 'error'); }
  }, [notify]);

  const loadUiComponents = useCallback(async () => {
    try {
      const data = await api.getUiComponents();
      dispatch({ type: 'SET_UI_COMPONENTS', payload: data });
    } catch { /* ignore */ }
  }, []);

  const loadTokenStatus = useCallback(async () => {
    try {
      const data = await api.getCpiTokenStatus();
      dispatch({ type: 'SET_TOKEN_STATUS', payload: data });
    } catch { /* ignore */ }
  }, []);

  const loadStatusCache = useCallback(async (systemMappingId) => {
    try {
      const { last_refresh_time, rows } = await api.getStatusCache(systemMappingId);
      if (last_refresh_time) dispatch({ type: 'SET_LAST_REFRESH', mappingId: systemMappingId, payload: last_refresh_time });
      if (rows && Object.keys(rows).length) {
        dispatch({ type: 'SET_ALL_ROW_STATUS', payload: rows });
      }
    } catch { /* ignore — cache may not exist yet */ }
  }, []);

  const refreshAllStatus = useCallback(async (mappingsArg, dashColsOverride, systemMappingIdArg) => {
    const list = mappingsArg || state.mappings;
    if (!list.length) return;

    const dashCols = dashColsOverride || state.dashboardColumns || DEFAULT_DASH_COLS;
    const apiColsMap = new Map();
    dashCols.filter(c => c.enabled && c.source === 'api').forEach(c => {
      if (!apiColsMap.has(c.api_config_id))
        apiColsMap.set(c.api_config_id, { api_config_id: c.api_config_id, input_mappings: c.input_mappings || {} });
    });
    const apiCols = [...apiColsMap.values()];
    if (!apiCols.length) return;

    const general = state.settingsGrouped?.['General'] || [];
    const PARALLEL_ROWS    = Math.max(1, parseInt(general.find(s => s.key === 'parallel_rows')?.value    || String(PARALLEL_ROWS_DEFAULT), 10));
    const PARALLEL_BATCHES = Math.max(1, parseInt(general.find(s => s.key === 'parallel_batches')?.value || '1', 10));

    // Determine system_mapping_id for this refresh
    const systemMappingId = systemMappingIdArg !== undefined
      ? systemMappingIdArg
      : state.activeSystemMappingId;

    const chunks = [];
    for (let i = 0; i < list.length; i += PARALLEL_ROWS) {
      chunks.push(list.slice(i, i + PARALLEL_ROWS));
    }

    list.forEach(m => dispatch({ type: 'SET_ROW_LOADING', id: m.id, payload: true }));
    dispatch({ type: 'SET_REFRESH_PROGRESS', payload: { active: true, done: 0, total: list.length } });

    let done = 0;
    const allResults = {};

    async function processChunk(chunk) {
      try {
        const result = await api.batchStatus(chunk.map(m => m.id), apiCols, systemMappingId);
        Object.assign(allResults, result);
        dispatch({ type: 'SET_ALL_ROW_STATUS', payload: result });
      } catch {
        chunk.forEach(m => dispatch({ type: 'SET_ROW_LOADING', id: m.id, payload: false }));
      } finally {
        done += chunk.length;
        dispatch({ type: 'SET_REFRESH_PROGRESS', payload: { active: true, done, total: list.length } });
      }
    }

    const queue = [...chunks];
    let inFlight = 0;
    await new Promise(resolve => {
      function pump() {
        while (inFlight < PARALLEL_BATCHES && queue.length) {
          inFlight++;
          processChunk(queue.shift()).finally(() => {
            inFlight--;
            if (queue.length > 0) pump();
            else if (inFlight === 0) resolve();
          });
        }
        if (inFlight === 0 && queue.length === 0) resolve();
      }
      pump();
    });

    dispatch({ type: 'SET_REFRESH_PROGRESS', payload: { active: false, done: list.length, total: list.length } });
    const ts = new Date().toISOString();
    dispatch({ type: 'SET_LAST_REFRESH', mappingId: systemMappingId, payload: ts });
    api.saveStatusCache(ts, allResults, systemMappingId).catch(() => {});
  }, [state.mappings, state.dashboardColumns, state.settingsGrouped, state.activeSystemMappingId]);

  const refreshRowStatus = useCallback(async (mapping) => {
    const dashCols = state.dashboardColumns || DEFAULT_DASH_COLS;
    const apiColsMap = new Map();
    dashCols.filter(c => c.enabled && c.source === 'api').forEach(c => {
      if (!apiColsMap.has(c.api_config_id))
        apiColsMap.set(c.api_config_id, { api_config_id: c.api_config_id, input_mappings: c.input_mappings || {} });
    });
    const apiCols = [...apiColsMap.values()];
    if (!apiCols.length) return;

    dispatch({ type: 'SET_ROW_LOADING', id: mapping.id, payload: true });
    try {
      const result = await api.batchStatus([mapping.id], apiCols, mapping.system_mapping_id);
      const rowApis = result[mapping.id] || {};
      dispatch({ type: 'SET_ROW_STATUS', id: mapping.id, payload: { loading: false, apis: rowApis } });
      api.saveStatusCacheRow(mapping.id, rowApis, mapping.system_mapping_id).catch(() => {});
    } catch (err) {
      dispatch({ type: 'SET_ROW_LOADING', id: mapping.id, payload: false });
      notify('Row refresh failed: ' + err.message, 'error');
    }
  }, [state.dashboardColumns, notify]);

  return (
    <AppContext.Provider value={{
      state, dispatch, notify,
      loadSettings, loadMappings, loadApiConfigs, loadUiComponents, loadTokenStatus,
      loadStatusCache, refreshRowStatus, refreshAllStatus,
      loadSystemMappings, setActiveSystemMappingId
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
