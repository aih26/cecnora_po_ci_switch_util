const store = require('./store');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_COL_MAP = [
  { colIndex: 1, label: 'ICO Name',       enabled: true },
  { colIndex: 2, label: 'Sender Party',   enabled: true },
  { colIndex: 3, label: 'Sender Service', enabled: true },
  { colIndex: 4, label: 'Channel Name',   enabled: true },
  { colIndex: 5, label: 'iFlow ID',       enabled: true },
  { colIndex: 6, label: 'iFlow Name',     enabled: true },
  { colIndex: 7, label: 'Package ID',     enabled: true },
];

const DEFAULT_DASHBOARD_COLS = [
  { id:'dc_po_party',   label:'Sender Party',   side:'po',  source:'mapping', field:'po_sender_party',   type:'text',     enabled:true },
  { id:'dc_po_svc',     label:'Sender Service', side:'po',  source:'mapping', field:'po_sender_service', type:'text',     enabled:true },
  { id:'dc_po_ch',      label:'Channel Name',   side:'po',  source:'mapping', field:'po_channel_name',   type:'mono',     enabled:true },
  { id:'dc_po_iface',   label:'Interface/ICO',  side:'po',  source:'mapping', field:'po_interface_name', fallback:'po_ico_name', type:'mono', enabled:true },
  {
    id:'dc_po_status',  label:'Status',         side:'po',  source:'api',
    api_config_id:'po-get-channel-state', response_field:'state',
    input_mappings:{ channelObjectId:'{{row.po_channel_object_id}}' },
    type:'badge', enabled:true
  },
  {
    id:'dc_po_lastmsg', label:'Last Msg',        side:'po',  source:'api',
    api_config_id:'po-last-message', response_field:'lastTime',
    input_mappings:{ senderParty:'{{row.po_sender_party}}', senderService:'{{row.po_sender_service}}' },
    type:'datetime', enabled:true
  },
  { id:'dc_cpi_iflow',  label:'iFlow Name',     side:'cpi', source:'mapping', field:'cpi_iflow_name', fallback:'cpi_iflow_id', type:'mono', enabled:true },
  {
    id:'dc_cpi_status', label:'Status',         side:'cpi', source:'api',
    api_config_id:'cpi-iflow-status', response_field:'status',
    input_mappings:{ iflowId:'{{row.cpi_iflow_id}}' },
    type:'badge', enabled:true
  },
  {
    id:'dc_cpi_mpl',    label:'Last MPL',       side:'cpi', source:'api',
    api_config_id:'cpi-last-mpl', response_field:'lastTime',
    input_mappings:{ iflowId:'{{row.cpi_iflow_id}}' },
    type:'datetime', enabled:true
  },
];

async function initDb() {
  await store.initTables();
  await seedSettings();
  await migrateParallelRows();
  await migrateCsvCustomFields();
  await migrateColMap();
  await migrateDashboardCols();
  await migrateMaxPayload();
  await migrateRefreshSettings();
  await seedApiConfigs();
  await seedDefaultComponents();
  await migrateSystemMappingToFlexible();
  await migrateToMultiSystem();
}

async function seedSettings() {
  if (await store.count('settings') > 0) return;

  const settings = [
    // PO Connection
    { key: 'po_host',       label: 'PO Host',            type: 'text',     group_name: 'PO Connection',  description: 'SAP PO/PI hostname or IP address', sort_order: 1, value: null },
    { key: 'po_port',       label: 'PO HTTP Port',        type: 'text',     group_name: 'PO Connection',  description: 'HTTP port (default 50000)', sort_order: 2, value: '50000' },
    { key: 'po_https_port', label: 'PO HTTPS Port',       type: 'text',     group_name: 'PO Connection',  description: 'HTTPS port (default 50001)', sort_order: 3, value: '50001' },
    { key: 'po_sid',        label: 'System ID (SID)',      type: 'text',     group_name: 'PO Connection',  description: 'SAP System Identifier (e.g. PI1)', sort_order: 4, value: null },
    { key: 'po_username',   label: 'Username',             type: 'text',     group_name: 'PO Connection',  description: 'Service user for channel admin API', sort_order: 5, value: null },
    { key: 'po_password',   label: 'Password',             type: 'password', group_name: 'PO Connection',  description: 'Password for PO service user', sort_order: 6, value: null },
    { key: 'po_use_https',  label: 'Use HTTPS',            type: 'boolean',  group_name: 'PO Connection',  description: 'Use HTTPS for PO API calls', sort_order: 7, value: 'false' },
    // CPI Connection
    { key: 'cpi_host',          label: 'CPI Host',           type: 'text',     group_name: 'CPI Connection', description: 'Integration Suite host (e.g. mytenantid.integrationsuite.cfapps.eu10.hana.ondemand.com)', sort_order: 1, value: null },
    { key: 'cpi_tenant_name',   label: 'Tenant Name',         type: 'text',     group_name: 'CPI Connection', description: 'Display name for this tenant', sort_order: 2, value: null },
    { key: 'cpi_token_url',     label: 'OAuth2 Token URL',    type: 'text',     group_name: 'CPI Connection', description: 'OAuth2 token endpoint URL', sort_order: 3, value: null },
    { key: 'cpi_client_id',     label: 'Client ID',           type: 'text',     group_name: 'CPI Connection', description: 'OAuth2 client ID', sort_order: 4, value: null },
    { key: 'cpi_client_secret', label: 'Client Secret',       type: 'password', group_name: 'CPI Connection', description: 'OAuth2 client secret', sort_order: 5, value: null },
    // General
    { key: 'app_title',        label: 'Application Title',     type: 'text',    group_name: 'General',      description: 'Title shown in header', sort_order: 1, value: 'PI/CPI Switch Panel' },
    { key: 'refresh_interval', label: 'Auto-Refresh (sec)',     type: 'number',  group_name: 'General',      description: 'Status auto-refresh in seconds (0 = disabled)', sort_order: 2, value: '0' },
    { key: 'parallel_rows',    label: 'Rows per Batch',         type: 'number',  group_name: 'General',      description: 'How many rows to send in each batch request', sort_order: 3, value: '20' },
    { key: 'parallel_batches', label: 'Parallel Batches',        type: 'number',  group_name: 'General',      description: 'How many batch requests run simultaneously (rows × batches = total in flight)', sort_order: 4, value: '1' },
    { key: 'max_payload_mb',   label: 'Max Payload Size (MB)',    type: 'number',  group_name: 'General',      description: 'Maximum size in MB for a single API request body (status cache save). Increase if you see payload errors with large mapping sets. Default: 50. No restart needed — takes effect immediately.', sort_order: 5, value: '50' },
    { key: 'upload_title',     label: 'Import Section Title',    type: 'text',    group_name: 'General',      description: 'Heading shown above the file import controls', sort_order: 6, value: 'PO Interface ↔ CPI iFlow Mapping' },
    { key: 'upload_hint',      label: 'Import Section Hint',     type: 'text',    group_name: 'General',      description: 'Sub-line shown below the import title', sort_order: 7, value: 'Select your CSV or Excel mapping file (.csv, .xlsx, .xls)' },
    { key: 'upload_btn_label', label: 'Import Button Label',     type: 'text',    group_name: 'General',      description: 'Label on the import button', sort_order: 8, value: 'Import Mapping Metadata' },
    { key: 'date_format',      label: 'Date/Time Format',        type: 'text',    group_name: 'General',      description: 'Format for datetime columns in the dashboard', sort_order: 9, value: 'DD/MM/YYYY HH:mm' },
    { key: 'csv_has_header',      label: 'File has header row',         type: 'boolean', group_name: 'CSV Mapping', description: 'First row is a header row', sort_order: 1, value: 'true' },
    { key: 'csv_column_map',      label: 'Column Map (JSON)',            type: 'json',    group_name: 'CSV Mapping', description: 'Array of {colIndex,label,enabled} entries', sort_order: 2, value: JSON.stringify(DEFAULT_COL_MAP) },
    { key: 'csv_custom_fields',   label: 'Custom Field Definitions',     type: 'json',    group_name: 'CSV Mapping', description: 'User-defined field definitions [{key,label}]', sort_order: 3, value: '[]' },
    { key: 'dashboard_columns',   label: 'Dashboard Columns (JSON)',type: 'json',    group_name: 'Dashboard',          description: 'Column config for the main dashboard table', sort_order: 1, value: JSON.stringify(DEFAULT_DASHBOARD_COLS) },
  ];

  for (const s of settings) {
    await store.insertIfNotExists('settings', { key: s.key }, s);
  }
}

async function migrateParallelRows() {
  await store.insertIfNotExists('settings', { key: 'parallel_rows' }, {
    key: 'parallel_rows', label: 'Rows per Batch', type: 'number',
    group_name: 'General', description: 'How many rows to send in each batch request', sort_order: 3, value: '20'
  });
  await store.insertIfNotExists('settings', { key: 'parallel_batches' }, {
    key: 'parallel_batches', label: 'Parallel Batches', type: 'number',
    group_name: 'General', description: 'How many batch requests run simultaneously (rows × batches = total in flight)', sort_order: 4, value: '1'
  });
  await store.insertIfNotExists('settings', { key: 'upload_title' }, {
    key: 'upload_title', label: 'Import Section Title', type: 'text',
    group_name: 'General', description: 'Heading shown above the file import controls', sort_order: 5, value: 'PO Interface ↔ CPI iFlow Mapping'
  });
  await store.insertIfNotExists('settings', { key: 'upload_hint' }, {
    key: 'upload_hint', label: 'Import Section Hint', type: 'text',
    group_name: 'General', description: 'Sub-line shown below the import title', sort_order: 6, value: 'Select your CSV or Excel mapping file (.csv, .xlsx, .xls)'
  });
  await store.insertIfNotExists('settings', { key: 'upload_btn_label' }, {
    key: 'upload_btn_label', label: 'Import Button Label', type: 'text',
    group_name: 'General', description: 'Label on the import button', sort_order: 7, value: 'Import Mapping Metadata'
  });
  await store.insertIfNotExists('settings', { key: 'date_format' }, {
    key: 'date_format', label: 'Date/Time Format', type: 'text',
    group_name: 'General', description: 'Format for datetime columns in the dashboard', sort_order: 8, value: 'DD/MM/YYYY HH:mm'
  });
  for (const k of ['batch_chunk_size', 'batch_chunk_concurrency', 'batch_concurrency']) {
    if (await store.findOne('settings', { key: k })) await store.remove('settings', { key: k });
  }
}

async function migrateCsvCustomFields() {
  await store.insertIfNotExists('settings', { key: 'csv_custom_fields' }, {
    key: 'csv_custom_fields', label: 'Custom Field Definitions', type: 'json',
    group_name: 'CSV Mapping', description: 'User-defined field definitions', sort_order: 3, value: '[]'
  });
}

async function migrateColMap() {
  await store.insertIfNotExists('settings', { key: 'csv_has_header' }, {
    key: 'csv_has_header', label: 'File has header row', type: 'boolean',
    group_name: 'CSV Mapping', description: 'First row is a header row', sort_order: 1, value: 'true'
  });
  await store.insertIfNotExists('settings', { key: 'csv_column_map' }, {
    key: 'csv_column_map', label: 'Column Map (JSON)', type: 'json',
    group_name: 'CSV Mapping', description: 'Column mapping configuration', sort_order: 2,
    value: JSON.stringify(DEFAULT_COL_MAP)
  });
}

async function migrateDashboardCols() {
  await store.insertIfNotExists('settings', { key: 'dashboard_columns' }, {
    key: 'dashboard_columns', label: 'Dashboard Columns (JSON)', type: 'json',
    group_name: 'Dashboard', description: 'Column config for the main dashboard table', sort_order: 1,
    value: JSON.stringify(DEFAULT_DASHBOARD_COLS)
  });
}

async function migrateMaxPayload() {
  await store.insertIfNotExists('settings', { key: 'max_payload_mb' }, {
    key: 'max_payload_mb', label: 'Max Payload Size (MB)', type: 'number',
    group_name: 'General',
    description: 'Maximum size in MB for a single API request body (status cache save). Increase if you see payload errors with large mapping sets. Default: 50. No restart needed — takes effect immediately.',
    sort_order: 5, value: '50'
  });
}

async function migrateRefreshSettings() {
  await store.insertIfNotExists('settings', { key: 'auto_refresh_on_load' }, {
    key: 'auto_refresh_on_load', label: 'Auto-Refresh on Load', type: 'boolean',
    group_name: 'General',
    description: 'Automatically trigger a full status refresh when the dashboard opens or when you switch to a different system mapping.',
    sort_order: 11, value: 'true'
  });
}

async function seedApiConfigs() {
  if (await store.count('api_configs') > 0) return;

  const configs = [
    {
      id: 'po-get-channel-state',
      name: 'PO Get Channel State',
      description: 'Retrieves the current state (active/inactive) of a sender channel via the Channel Admin SOAP service.',
      system: 'PO', method: 'POST',
      url_template: '{{po_scheme}}://{{po_host}}:{{po_port}}/AdapterFramework/ChannelAdminService',
      content_type: 'text/xml; charset=utf-8', auth_type: 'basic',
      soap_action: 'urn:getState',
      request_template: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cha="urn:AdapterFramework/7.0">
  <soapenv:Header/>
  <soapenv:Body>
    <cha:getState>
      <cha:channelObjectId>{{channelObjectId}}</cha:channelObjectId>
    </cha:getState>
  </soapenv:Body>
</soapenv:Envelope>`,
      response_mappings: [
        { name: 'state', path: '//*[local-name()="state"]/text()', type: 'xpath', description: 'Channel state (active/inactive/error)' }
      ],
      is_builtin: true
    },
    {
      id: 'po-start-channel',
      name: 'PO Start Channel',
      description: 'Starts a communication channel via the Channel Admin SOAP service.',
      system: 'PO', method: 'POST',
      url_template: '{{po_scheme}}://{{po_host}}:{{po_port}}/AdapterFramework/ChannelAdminService',
      content_type: 'text/xml; charset=utf-8', auth_type: 'basic',
      soap_action: 'urn:start',
      request_template: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cha="urn:AdapterFramework/7.0">
  <soapenv:Header/>
  <soapenv:Body>
    <cha:start>
      <cha:channelObjectId>{{channelObjectId}}</cha:channelObjectId>
    </cha:start>
  </soapenv:Body>
</soapenv:Envelope>`,
      response_mappings: [{ name: 'result', path: '//*[local-name()="startResponse"]/text()', type: 'xpath', description: 'Result' }],
      is_builtin: true
    },
    {
      id: 'po-stop-channel',
      name: 'PO Stop Channel',
      description: 'Stops a communication channel via the Channel Admin SOAP service.',
      system: 'PO', method: 'POST',
      url_template: '{{po_scheme}}://{{po_host}}:{{po_port}}/AdapterFramework/ChannelAdminService',
      content_type: 'text/xml; charset=utf-8', auth_type: 'basic',
      soap_action: 'urn:stop',
      request_template: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cha="urn:AdapterFramework/7.0">
  <soapenv:Header/>
  <soapenv:Body>
    <cha:stop>
      <cha:channelObjectId>{{channelObjectId}}</cha:channelObjectId>
    </cha:stop>
  </soapenv:Body>
</soapenv:Envelope>`,
      response_mappings: [{ name: 'result', path: '//*[local-name()="stopResponse"]/text()', type: 'xpath', description: 'Result' }],
      is_builtin: true
    },
    {
      id: 'po-last-message',
      name: 'PO Last Message Time',
      description: 'Gets the last message processing time for a channel from the Adapter Message Monitoring SOAP service.',
      system: 'PO', method: 'POST',
      url_template: '{{po_scheme}}://{{po_host}}:{{po_port}}/AdapterMessageMonitoring/basic',
      content_type: 'text/xml; charset=utf-8', auth_type: 'basic',
      soap_action: 'getMessageList',
      request_template: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mon="urn:AdapterMessageMonitoringVi">
  <soapenv:Header/>
  <soapenv:Body>
    <mon:getMessageList>
      <mon:maxMessages>1</mon:maxMessages>
      <mon:SenderParty>{{senderParty}}</mon:SenderParty>
      <mon:SenderService>{{senderService}}</mon:SenderService>
      <mon:ReceiverParty></mon:ReceiverParty>
      <mon:ReceiverService></mon:ReceiverService>
      <mon:Interface></mon:Interface>
      <mon:Namespace></mon:Namespace>
      <mon:QualityOfService>EO</mon:QualityOfService>
      <mon:Status>success</mon:Status>
    </mon:getMessageList>
  </soapenv:Body>
</soapenv:Envelope>`,
      response_mappings: [
        { name: 'lastTime', path: '//*[local-name()="TimeStamp"][1]/text()', type: 'xpath', description: 'Last processed message timestamp' },
        { name: 'status',   path: '//*[local-name()="Status"][1]/text()',    type: 'xpath', description: 'Last message status' }
      ],
      is_builtin: true
    },
    {
      id: 'cpi-iflow-status',
      name: 'CPI iFlow Runtime Status',
      description: 'Gets the deployment and runtime status of an integration flow.',
      system: 'CPI', method: 'GET',
      url_template: "https://{{cpi_host}}/api/v1/IntegrationRuntimeArtifacts(Id='{{iflowId}}',Type='IntegrationFlow')",
      content_type: 'application/json', auth_type: 'oauth2',
      request_template: '',
      response_mappings: [
        { name: 'status',     path: '$.d.Status',      type: 'jsonpath', description: 'Runtime status (STARTED/STOPPED/ERROR)' },
        { name: 'version',    path: '$.d.Version',     type: 'jsonpath', description: 'Deployed version' },
        { name: 'deployedOn', path: '$.d.DeployedOn',  type: 'jsonpath', description: 'Deployment timestamp' }
      ],
      is_builtin: true
    },
    {
      id: 'cpi-deploy-iflow',
      name: 'CPI Deploy iFlow',
      description: 'Deploys an integration flow to the runtime node.',
      system: 'CPI', method: 'POST',
      url_template: "https://{{cpi_host}}/api/v1/DeployIntegrationDesigntimeArtifact?Id='{{iflowId}}'&Version='active'",
      content_type: 'application/json', auth_type: 'oauth2',
      request_template: '',
      response_mappings: [{ name: 'taskId', path: '$.d.TaskId', type: 'jsonpath', description: 'Async task ID' }],
      is_builtin: true
    },
    {
      id: 'cpi-undeploy-iflow',
      name: 'CPI Undeploy iFlow',
      description: 'Removes an integration flow from the runtime node.',
      system: 'CPI', method: 'DELETE',
      url_template: "https://{{cpi_host}}/api/v1/IntegrationRuntimeArtifacts(Id='{{iflowId}}',Type='IntegrationFlow')",
      content_type: 'application/json', auth_type: 'oauth2',
      request_template: '',
      response_mappings: [],
      is_builtin: true
    },
    {
      id: 'cpi-last-mpl',
      name: 'CPI Last MPL Entry',
      description: 'Gets the most recent message processing log entry for an iFlow.',
      system: 'CPI', method: 'GET',
      url_template: "https://{{cpi_host}}/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '{{iflowId}}'&$top=1&$orderby=LogStart desc&$select=MessageGuid,Status,LogStart,LogEnd,IntegrationFlowName",
      content_type: 'application/json', auth_type: 'oauth2',
      request_template: '',
      response_mappings: [
        { name: 'lastTime', path: '$.d.results[0].LogStart',   type: 'jsonpath', description: 'Last message start time' },
        { name: 'status',   path: '$.d.results[0].Status',     type: 'jsonpath', description: 'Last message status' },
        { name: 'guid',     path: '$.d.results[0].MessageGuid', type: 'jsonpath', description: 'Message GUID' }
      ],
      is_builtin: true
    },
    {
      id: 'cpi-oauth-token',
      name: 'CPI OAuth2 Token Endpoint',
      description: 'OAuth2 client_credentials token fetch. Uses cpi_token_url, cpi_client_id, cpi_client_secret settings.',
      system: 'CPI', method: 'POST',
      url_template: '{{cpi_token_url}}',
      content_type: 'application/x-www-form-urlencoded', auth_type: 'basic',
      request_template: 'grant_type=client_credentials',
      response_mappings: [
        { name: 'access_token', path: '$.access_token', type: 'jsonpath', description: 'Bearer token' },
        { name: 'expires_in',   path: '$.expires_in',   type: 'jsonpath', description: 'TTL in seconds' }
      ],
      is_builtin: true
    }
  ];

  for (const c of configs) {
    await store.insertIfNotExists('api_configs', { id: c.id }, c);
  }
}

async function seedDefaultComponents() {
  if (await store.count('ui_components') > 0) return;

  const components = [
    {
      id: uuidv4(), name: 'po-start-btn', label: 'Start', type: 'action-button', placement: 'row-po',
      api_config_id: 'po-start-channel',
      input_mappings: { channelObjectId: '{{row.po_channel_object_id}}' },
      display_config: { variant: 'success', icon: '▶', confirmRequired: true },
      confirm_message: 'Start channel "{{row.po_channel_name}}"?',
      is_active: true, sort_order: 1
    },
    {
      id: uuidv4(), name: 'po-stop-btn', label: 'Stop', type: 'action-button', placement: 'row-po',
      api_config_id: 'po-stop-channel',
      input_mappings: { channelObjectId: '{{row.po_channel_object_id}}' },
      display_config: { variant: 'danger', icon: '■', confirmRequired: true },
      confirm_message: 'Stop channel "{{row.po_channel_name}}"?',
      is_active: true, sort_order: 2
    },
    {
      id: uuidv4(), name: 'cpi-deploy-btn', label: 'Deploy', type: 'action-button', placement: 'row-cpi',
      api_config_id: 'cpi-deploy-iflow',
      input_mappings: { iflowId: '{{row.cpi_iflow_id}}' },
      display_config: { variant: 'primary', icon: '↑', confirmRequired: true },
      confirm_message: 'Deploy iFlow "{{row.cpi_iflow_name}}"?',
      is_active: true, sort_order: 1
    },
    {
      id: uuidv4(), name: 'cpi-undeploy-btn', label: 'Undeploy', type: 'action-button', placement: 'row-cpi',
      api_config_id: 'cpi-undeploy-iflow',
      input_mappings: { iflowId: '{{row.cpi_iflow_id}}' },
      display_config: { variant: 'warning', icon: '↓', confirmRequired: true },
      confirm_message: 'Undeploy iFlow "{{row.cpi_iflow_name}}"?',
      is_active: true, sort_order: 2
    }
  ];

  for (const c of components) {
    await store.insertIfNotExists('ui_components', { name: c.name }, c);
  }
}

async function migrateSystemMappingToFlexible() {
  const mappings = await store.find('system_mappings');
  for (const m of mappings) {
    if (m.system_a_type) continue; // already migrated
    if (!m.po_system_id && !m.cpi_tenant_id) continue;
    await store.update('system_mappings', { id: m.id }, {
      system_a_type: 'po',
      system_a_id:   m.po_system_id  || '',
      system_b_type: 'cpi',
      system_b_id:   m.cpi_tenant_id || ''
    });
  }
}

async function migrateToMultiSystem() {
  const [poCount, cpiCount, sysMapCount] = await Promise.all([
    store.count('po_systems'),
    store.count('cpi_tenants'),
    store.count('system_mappings')
  ]);
  if (poCount > 0 || cpiCount > 0 || sysMapCount > 0) return;

  const settingsList = await store.find('settings');
  const s = {};
  settingsList.forEach(r => { s[r.key] = r.value; });
  if (!s.po_host && !s.cpi_host) return;

  let poSystem = null, cpiTenant = null;

  if (s.po_host) {
    poSystem = await store.insert('po_systems', {
      name: s.po_sid ? `PI ${s.po_sid}` : 'Default PO System',
      sid: s.po_sid || '',
      host: s.po_host,
      port: s.po_port || '50000',
      https_port: s.po_https_port || '50001',
      username: s.po_username || '',
      password: s.po_password || '',
      use_https: s.po_use_https || 'false'
    });
    console.log(`  Migrated PO system: ${poSystem.name}`);
  }

  if (s.cpi_host) {
    cpiTenant = await store.insert('cpi_tenants', {
      name: s.cpi_tenant_name || 'Default CPI Tenant',
      host: s.cpi_host,
      token_url: s.cpi_token_url || '',
      client_id: s.cpi_client_id || '',
      client_secret: s.cpi_client_secret || ''
    });
    console.log(`  Migrated CPI tenant: ${cpiTenant.name}`);
  }

  if (poSystem && cpiTenant) {
    const sysMapping = await store.insert('system_mappings', {
      name: `${poSystem.sid || 'PO'} ↔ ${cpiTenant.name}`,
      system_a_type: 'po',
      system_a_id:   poSystem.id,
      system_b_type: 'cpi',
      system_b_id:   cpiTenant.id,
      is_default: true
    });
    console.log(`  Created default system mapping: ${sysMapping.name}`);
    const tagged = await store.update('interface_mappings', {}, { system_mapping_id: sysMapping.id });
    if (tagged) console.log(`  Tagged ${tagged} interface mapping(s) with system_mapping_id`);
  }
}

module.exports = { initDb };
