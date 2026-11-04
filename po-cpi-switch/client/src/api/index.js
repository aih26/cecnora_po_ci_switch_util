import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings = () => api.get('/settings').then(r => r.data);
export const getSettingsGrouped = () => api.get('/settings/grouped').then(r => r.data);
export const saveSettings = (values) => api.put('/settings', values).then(r => r.data);
export const addSetting = (body) => api.post('/settings', body).then(r => r.data);
export const deleteSetting = (key) => api.delete(`/settings/${key}`).then(r => r.data);

// ── Mappings ─────────────────────────────────────────────────────────────
export const getMappings = (systemMappingId) =>
  api.get('/mapping', { params: systemMappingId ? { system_mapping_id: systemMappingId } : {} }).then(r => r.data);
export const uploadMappingFile = (formData) => api.post('/mapping/upload', formData).then(r => r.data);
export const updateMapping = (id, body) => api.put(`/mapping/${id}`, body).then(r => r.data);
export const deleteMapping = (id) => api.delete(`/mapping/${id}`).then(r => r.data);
export const clearMappings = () => api.delete('/mapping').then(r => r.data);

// ── PO ────────────────────────────────────────────────────────────────────
export const getPoChannelStatus = (id) => api.get(`/po/channel/${id}/status`).then(r => r.data);
export const getPoLastMessage = (id) => api.get(`/po/channel/${id}/lastmessage`).then(r => r.data);
export const startPoChannel = (id) => api.post(`/po/channel/${id}/start`).then(r => r.data);
export const stopPoChannel = (id) => api.post(`/po/channel/${id}/stop`).then(r => r.data);
export const callPoApi = (apiConfigId, params) => api.post(`/po/call/${apiConfigId}`, params).then(r => r.data);
export const testPoConnection = () => api.get('/po/test').then(r => r.data);

// ── CPI ───────────────────────────────────────────────────────────────────
export const getCpiTokenStatus = () => api.get('/cpi/token/status').then(r => r.data);
export const refreshCpiToken = () => api.post('/cpi/token/refresh').then(r => r.data);
export const getCpiIflowStatus = (id) => api.get(`/cpi/iflow/${id}/status`).then(r => r.data);
export const getCpiLastMpl = (id) => api.get(`/cpi/iflow/${id}/lastmpl`).then(r => r.data);
export const deployCpiIflow = (id) => api.post(`/cpi/iflow/${id}/deploy`).then(r => r.data);
export const undeployCpiIflow = (id) => api.delete(`/cpi/iflow/${id}/undeploy`).then(r => r.data);
export const callCpiApi = (apiConfigId, params) => api.post(`/cpi/call/${apiConfigId}`, params).then(r => r.data);

// ── Status (batch) ───────────────────────────────────────────────────────
export const batchStatus = (ids, apiCols, systemMappingId) =>
  api.post('/status/batch', { ids, apiCols, system_mapping_id: systemMappingId || null }).then(r => r.data);
export const getStatusCache = (systemMappingId) =>
  api.get('/status/cache', { params: systemMappingId ? { sm_id: systemMappingId } : {} }).then(r => r.data);
export const saveStatusCache = (last_refresh_time, rows, systemMappingId) =>
  api.put('/status/cache', { last_refresh_time, rows, system_mapping_id: systemMappingId || null }).then(r => r.data);
export const saveStatusCacheRow = (id, apis, systemMappingId) =>
  api.patch(`/status/cache/row/${id}`, { apis, system_mapping_id: systemMappingId || null }).then(r => r.data);

// ── UI Config ─────────────────────────────────────────────────────────────
export const getApiConfigs = () => api.get('/ui-config/apis').then(r => r.data);
export const createApiConfig = (body) => api.post('/ui-config/apis', body).then(r => r.data);
export const updateApiConfig = (id, body) => api.put(`/ui-config/apis/${id}`, body).then(r => r.data);
export const deleteApiConfig = (id) => api.delete(`/ui-config/apis/${id}`).then(r => r.data);
export const getUiComponents = () => api.get('/ui-config/components').then(r => r.data);
export const createUiComponent = (body) => api.post('/ui-config/components', body).then(r => r.data);
export const updateUiComponent = (id, body) => api.put(`/ui-config/components/${id}`, body).then(r => r.data);
export const deleteUiComponent = (id) => api.delete(`/ui-config/components/${id}`).then(r => r.data);

// ── Backend info ──────────────────────────────────────────────────────────
export const getBackendInfo = () => api.get('/status/backend').then(r => r.data);

// ── Systems ───────────────────────────────────────────────────────────────
export const getPoSystems = () => api.get('/systems/po').then(r => r.data);
export const createPoSystem = (body) => api.post('/systems/po', body).then(r => r.data);
export const updatePoSystem = (id, body) => api.put(`/systems/po/${id}`, body).then(r => r.data);
export const deletePoSystem = (id) => api.delete(`/systems/po/${id}`).then(r => r.data);
export const testPoSystem = (id) => api.get(`/systems/po/${id}/test`).then(r => r.data);

export const getCpiTenants = () => api.get('/systems/cpi').then(r => r.data);
export const createCpiTenant = (body) => api.post('/systems/cpi', body).then(r => r.data);
export const updateCpiTenant = (id, body) => api.put(`/systems/cpi/${id}`, body).then(r => r.data);
export const deleteCpiTenant = (id) => api.delete(`/systems/cpi/${id}`).then(r => r.data);

export const getSystemMappings = () => api.get('/systems/mappings').then(r => r.data);
export const createSystemMapping = (body) => api.post('/systems/mappings', body).then(r => r.data);
export const updateSystemMapping = (id, body) => api.put(`/systems/mappings/${id}`, body).then(r => r.data);
export const setDefaultSystemMapping = (id) => api.patch(`/systems/mappings/${id}/set-default`).then(r => r.data);
export const deleteSystemMapping = (id) => api.delete(`/systems/mappings/${id}`).then(r => r.data);
