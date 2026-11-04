# PI/CPI Switch Panel

A web-based operations dashboard for monitoring and managing SAP Process Orchestration (PO/PI) channels and SAP Cloud Integration (CPI) iFlows side by side. Designed for migration projects where both systems run in parallel — and supports multiple system pairs simultaneously.

---

## Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Configuration](#configuration)
   - [Environment Variables](#environment-variables)
   - [Multi-System Management](#multi-system-management)
   - [General Settings — Performance & Refresh](#general-settings--performance--refresh)
   - [General Settings — Application & Display](#general-settings--application--display)
7. [CSV Mapping — Defining Your Fields](#csv-mapping--defining-your-fields)
8. [Interface Metadata — Importing Mappings](#interface-metadata--importing-mappings)
9. [Running the Application](#running-the-application)
10. [Dashboard Usage](#dashboard-usage)
11. [API Reference](#api-reference)
12. [Data Storage](#data-storage)
13. [Troubleshooting](#troubleshooting)

---

## Features

| Feature | Description |
|---|---|
| **Multi-system management** | Define multiple PO/PI systems and CPI tenants; combine them into named system mappings |
| **Flexible mapping types** | A system mapping can pair PO↔CPI, CPI↔CPI, or PO↔PO — all combinations supported |
| **System mapping switcher** | Dropdown in the topbar lets you switch between system mappings instantly; each has its own data and status cache |
| **Dynamic mapping label** | Topbar label reads "System Mapping:" for PO↔CPI pairs and "Tenant Mapping:" for CPI↔CPI pairs |
| **Interface Metadata page** | Dedicated page for uploading and reviewing the CSV/Excel interface mapping file — separate from the operational dashboard |
| **Per-mapping status cache** | Each system mapping stores its own last refresh results independently |
| **Per-mapping last sync time** | "Last Sync" timestamp is tied to the active mapping and only shown when that mapping has data loaded |
| **Dual-system dashboard** | View PO/PI channels and CPI iFlows in a single table |
| **Channel status** | Real-time STARTED / STOPPED / ERROR badge for PO channels |
| **iFlow status** | STARTED / STOPPED / ERROR / Not Deployed badge for CPI iFlows |
| **Last message time** | Most recent MPL timestamp from both PO and CPI |
| **Channel start / stop** | One-click start or stop a PO sender channel |
| **iFlow deploy / undeploy** | One-click deploy or undeploy a CPI iFlow |
| **Bulk refresh with progress** | Refresh all rows in parallel; the button shows "↻ Refreshing…" and a progress bar below displays `45% (23/50)` |
| **Strict system resolution** | Status queries always use the credentials from the selected system mapping — never silently fall back to another system |
| **Configurable refresh schedule** | Background auto-refresh runs on a configured interval; on-load/switch refresh is a separate opt-in toggle |
| **Shared status cache** | Last refresh results stored server-side so all users see the same state on load |
| **Dynamic field definitions** | All data fields are defined by your CSV column layout — no hardcoded field list |
| **CSV / Excel import** | Upload a mapping file via the Interface Metadata page |
| **Configurable columns** | Show / hide and reorder dashboard columns |
| **Configurable date/time format** | Choose from European, US, ISO, or date-only formats |
| **Configurable API endpoints** | Override any built-in API endpoint or add custom ones |
| **Concurrency control** | Two settings (`parallel_rows` × `parallel_batches`) control how fast the dashboard refreshes |
| **Instant settings navigation** | All settings data is pre-loaded on startup — switching between settings tabs is instant |
| **Pluggable storage backend** | Switch between JSON file storage and PostgreSQL with a single env var |

---

## Technology Stack

### Backend

| Component | Package | Version |
|---|---|---|
| Runtime | Node.js | 18+ |
| HTTP framework | Express.js | 4.x |
| HTTP client | axios | 1.x |
| XML parsing | @xmldom/xmldom + xpath | 0.8.x / 0.0.34 |
| File upload | multer | 1.x |
| Excel / CSV parsing | xlsx | 0.18.x |
| ID generation | uuid | 9.x |
| PostgreSQL client | pg | 8.x |
| Environment loading | dotenv | 16.x |
| Dev auto-reload | nodemon | 3.x |
| Dev parallel runner | concurrently | 8.x |

### Frontend

| Component | Package | Version |
|---|---|---|
| UI library | React | 18.x |
| Build tool | Vite | 5.x |
| Routing | React Router DOM | 6.x |
| HTTP client | axios | 1.x |
| State management | React Context + useReducer | (built-in) |

### Data

- **File backend** (default): Plain JSON file at `data/app.json` — loaded into memory on startup, flushed on every write. No external services required.
- **PostgreSQL backend**: JSONB document store — each collection is a table with a single `doc JSONB NOT NULL` column. Selected with `DATA_BACKEND=pg`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (React)                         │
│                                                              │
│  Topbar: [⇄ Dashboard] [📋 Interface Metadata] [⚙ Settings] │
│          [System Mapping: N75 ↔ DEMO1 ▼]                    │
│                                                              │
│  Dashboard        → InterfaceTable, refresh controls         │
│  Interface Meta   → MappingUpload, CSV field table           │
│  Settings         → Systems & Mapping, CSV Mapping, ...      │
│                                                              │
│  AppContext (state): mappings, systemMappings, poSystems,    │
│    cpiTenants, activeSystemMappingId, lastRefreshTimes, ...  │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTP (dev: port 5173 → proxy 3001)
                       │  HTTP (prod: served by Express)
┌──────────────────────▼──────────────────────────────────────┐
│               Express API Server (port 3001)                  │
│                                                              │
│  /api/settings       — read / write app settings             │
│  /api/mapping        — CRUD + CSV/Excel upload               │
│  /api/systems/po     — PO system CRUD                        │
│  /api/systems/cpi    — CPI tenant CRUD                       │
│  /api/systems/mappings — system mapping CRUD                 │
│  /api/po             — PO/PI calls (SOAP + HTTP)             │
│  /api/cpi            — CPI calls (OData + OAuth2)            │
│  /api/ui-config      — API configs + UI components           │
│  /api/status/batch   — parallel multi-row status refresh     │
│  /api/status/cache   — per-mapping server-side status cache  │
│  /api/status/backend — current storage backend info          │
└───────────┬──────────────┬───────────────────────────────────┘
            │              │
     ┌──────▼──────┐  ┌────▼──────────────────┐
     │  store.js   │  │   SAP Systems          │
     │  (router)   │  │                        │
     └──┬───────┬──┘  │  SAP PO / PI           │
        │       │     │  ChannelAdmin Servlet   │
  ┌─────▼──┐ ┌──▼──┐  │  AdapterMessage        │
  │ store- │ │store│  │  Monitoring            │
  │ file.js│ │-pg  │  │                        │
  │ (JSON) │ │.js  │  │  SAP CPI (BTP)         │
  └────────┘ └─────┘  │  OData API v1          │
                       │  OAuth2 tokens         │
                       └────────────────────────┘
```

**Key design decisions:**

- All SAP credentials stay on the backend — the browser never sees passwords.
- `csv_column_map` is the single source of truth for all data fields. Whatever columns you define in **Settings → CSV Mapping** are what appears across the dashboard, edit modal, and filters.
- A global semaphore in `routes/status.js` caps the total number of live SAP API calls. The cap is `parallel_rows × parallel_batches × 10`.
- The frontend dispatches status results row-by-row as each chunk completes, so the table updates progressively rather than waiting for a full refresh.
- `resolveCredentials` in `routes/status.js` resolves PO/CPI credentials strictly from the selected system mapping — it never falls back to a different system if one is explicitly selected. This ensures queries always go to the intended SAP system.
- Status cache documents are keyed per system mapping (`sm_<id>`) so each mapping's last refresh results are stored independently.
- All settings data (API configs, UI components, system mappings) is pre-loaded into `AppContext` at app startup, making settings tab navigation instant with no per-tab API calls.
- `store.js` is a one-line router: it exports either `store-file.js` or `store-pg.js` based on `DATA_BACKEND`. All callers use the same async API (`find`, `findOne`, `insert`, `upsert`, `update`, `remove`, `count`).

---

## Prerequisites

1. **Node.js 18 or later** — [https://nodejs.org](https://nodejs.org)
2. **SAP PO/PI** access (for each PO system you configure):
   - A service user with authorisation to call:
     - `ChannelAdminServlet` (start/stop channels)
     - `AdapterMessageMonitoring/basic` (SOAP — last message time)
   - The system's HTTP port (default `50000`) or HTTPS port (default `50001`) reachable from the machine running this app
   - For channels that need to be started/stopped: the channel's **Automation Mode** must be set to **All Users** in the PI channel configuration. Channels set to `Manual` will return a `WrongAutomationModeException` even though SAP responds with HTTP 200.
3. **SAP CPI (Integration Suite)** access (for each CPI tenant you configure):
   - An OAuth2 service key with `client_id`, `client_secret`, and `token_url`
   - The CPI host URL (e.g. `mytenant.integrationsuite.cfapps.eu10.hana.ondemand.com`)
4. **PostgreSQL 12+** _(optional — only required if using `DATA_BACKEND=pg`)_

---

## Installation

### Step 1 — Clone or copy the project

```bash
git clone <repo-url> po-cpi-switch
cd po-cpi-switch
```

### Step 2 — Install backend dependencies

```bash
npm install
```

### Step 3 — Install frontend dependencies

```bash
cd client
npm install
cd ..
```

### Step 4 — Create a `.env` file

A `.env` file is included at the project root. Edit it to match your environment:

```env
# Server
PORT=3001

# Storage backend: "file" (default) or "pg" (PostgreSQL)
DATA_BACKEND=file

# Required when DATA_BACKEND=pg
# DATABASE_URL=postgres://user:password@host:5432/dbname
```

The file is optional for the file backend — all values have defaults.

---

## Configuration

All connection settings and UI preferences are managed through the **Settings** page in the UI and persisted to the active storage backend.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | TCP port the Express server listens on |
| `DATA_BACKEND` | `file` | Storage backend — `file` or `pg` |
| `DATABASE_URL` | — | PostgreSQL connection string (required when `DATA_BACKEND=pg`) |

The active backend is visible at the bottom of **Settings → General** (read-only).

---

### Multi-System Management

The application supports multiple SAP systems and can monitor several PO↔CPI (or CPI↔CPI, PO↔PO) pairs simultaneously. Configure this in **Settings → Systems & Mapping**.

#### PO/PI Systems

Add one entry for each SAP PO/PI system you want to connect to.

| Field | Description |
|---|---|
| Display Name | Human-readable label (e.g. `N75 Production`) |
| System ID (SID) | SAP System ID — e.g. `N75` |
| Host | Full URL or hostname of the SAP PO/PI system |
| HTTP Port | Default `50000` |
| HTTPS Port | Default `50001` |
| Use HTTPS | Toggle to use HTTPS instead of HTTP |
| Username | Service user for channel admin calls |
| Password | Password for the service user |

> TLS certificate verification is disabled for PO calls because internal SAP systems commonly use self-signed or internal-CA certificates.

Use the **Test** button on each PO system entry to verify connectivity before creating a system mapping.

#### CPI Tenants

Add one entry for each SAP CPI (Integration Suite) tenant.

| Field | Description |
|---|---|
| Tenant Name | Display label (e.g. `DEMO1`) |
| Host | Full Integration Suite host URL |
| OAuth2 Token URL | Full URL of the OAuth2 token endpoint |
| Client ID | OAuth2 client ID |
| Client Secret | OAuth2 client secret |

OAuth2 tokens are cached in memory and refreshed automatically when they expire.

#### System Mappings

A system mapping pairs one PO/PI system with one CPI tenant (or any two systems of supported types) and gives the pair a name.

| Field | Description |
|---|---|
| Name | Auto-generated as `SID ↔ TenantName` (e.g. `N75 ↔ DEMO1`) — editable |
| Side A type | `PI/PO` or `CPI` |
| Side A system | Select from your configured PO systems or CPI tenants |
| Side B type | `PI/PO` or `CPI` |
| Side B system | Select from your configured PO systems or CPI tenants |
| Default | Mark one mapping as the default — it is selected automatically when the app loads |

**Supported mapping combinations:**

| Type | Use case |
|---|---|
| PO ↔ CPI | Standard migration monitoring — PO on one side, CPI on the other |
| CPI ↔ CPI | Compare two CPI tenants (e.g. Dev vs Prod) |
| PO ↔ PO | Compare two PO/PI systems |

Each system mapping maintains its own:
- Interface metadata (uploaded CSV rows)
- Status cache (last refresh results per mapping)
- Last sync timestamp

> **Important:** When a system mapping is selected, status queries use **only** the credentials from that mapping. There is no fallback to another system. If a mapping's PO system does not have the queried channels, the status will show "Not Found" — not data from a different system.

---

### General Settings — Performance & Refresh

Configured in **Settings → General → Performance & Refresh**.

| Setting | Key | Default | Description |
|---|---|---|---|
| Refresh on Load / Mapping Switch | `auto_refresh_on_load` | `false` | When ON: triggers a full status refresh immediately when the dashboard opens or you switch to a different system mapping. When OFF: restores status from cache; refreshes only happen on schedule or manually. |
| Refresh Schedule (sec) | `refresh_interval` | `0` | Background auto-refresh interval in seconds. Set to `0` to disable scheduled refresh. |
| Rows per Batch | `parallel_rows` | `20` | How many rows are sent in a single batch request to the backend. |
| Parallel Batches | `parallel_batches` | `1` | How many batch requests run simultaneously. Total rows in flight = `parallel_rows × parallel_batches`. |
| Max Payload Size (MB) | `max_payload_mb` | `50` | Maximum HTTP body size when saving the status cache. Increase only if you see "Payload too large" errors. |

**Refresh behaviour summary:**

| Configuration | On load / mapping switch | Background |
|---|---|---|
| `auto_refresh_on_load` = OFF (default) | Restores last known status from cache | Runs on schedule if `refresh_interval` > 0 |
| `auto_refresh_on_load` = ON | Triggers a full refresh immediately | Also runs on schedule |

**Concurrency tuning guide:**

| Load | parallel_rows | parallel_batches | Total in flight |
|---|---|---|---|
| Conservative (safe) | 10 | 1 | 10 |
| Balanced | 20 | 2 | 40 |
| Aggressive (fast) | 25 | 4 | 100 |

Increase these gradually. Setting them too high can cause SAP to reject requests with HTTP 429 or timeouts.

---

### General Settings — Application & Display

| Setting | Key | Default | Description |
|---|---|---|---|
| Application Title | `app_title` | `PI/CPI Switch Panel` | Title shown in the browser tab and topbar |
| Import Section Title | `upload_title` | `PO Interface ↔ CPI iFlow Mapping` | Heading above the file import controls on the Interface Metadata page |
| Import Section Hint | `upload_hint` | `Select your CSV or Excel mapping file…` | Sub-line shown below the import title |
| Import Button Label | `upload_btn_label` | `Import Mapping Metadata` | Label on the import/upload action button |
| Date/Time Format | `date_format` | `DD/MM/YYYY HH:mm` | Format used for all datetime columns in the dashboard |

**Available date/time formats:**

| Format | Example |
|---|---|
| `DD/MM/YYYY HH:mm` | `25/12/2024 14:30` (European) |
| `MM/DD/YYYY HH:mm` | `12/25/2024 14:30` (US) |
| `YYYY-MM-DD HH:mm` | `2024-12-25 14:30` (ISO) |
| `DD/MM/YYYY` | `25/12/2024` (date only) |
| `MM/DD/YYYY` | `12/25/2024` (date only, US) |

---

## CSV Mapping — Defining Your Fields

The application has **no predefined field list**. Every field that appears in the dashboard, edit modal, and Interface Metadata table comes from your CSV column map.

### Setting up columns

1. Go to **Settings → CSV Mapping**.
2. For each column in your CSV/Excel file, add an entry with:
   - **Label** — the human-readable name (e.g. `ICO Name`). The internal field key is auto-generated from this (e.g. `ico_name`).
   - **Enabled** — whether this column is imported and stored.
3. The order of rows here determines the column order (position is assigned automatically top-to-bottom).
4. Save.

### Field key rules

The field key (internal storage key) is derived from the label automatically:
- Lowercased
- Non-alphanumeric characters replaced with `_`
- Leading/trailing underscores stripped
- Capped at 48 characters

You can override the auto-generated key by typing directly in the field key input — once you do, the auto-sync from the label stops.

### Using your fields

After saving the column map:

- **Interface Metadata** page shows these fields as table columns when viewing loaded rows.
- **Dashboard Columns** (Settings → Dashboard) offers these fields as sources for display columns.
- **Filter** on the dashboard searches across enabled text fields automatically.
- **Edit row modal** shows all fields for any row.

> Changing the column map does not retroactively update already-imported rows. Re-import your CSV after changing field definitions.

---

## Interface Metadata — Importing Mappings

Interface metadata is managed from the dedicated **Interface Metadata** page (second item in the top navigation bar). This page is intentionally separate from the operational dashboard — in a future release it will be access-controlled so only authorised users can upload data.

### File format

The file can have **any columns in any order** — the column layout is configured in **Settings → CSV Mapping**. There are no required column names or positions. Common fields include:

| Typical field | Example value |
|---|---|
| Interface / ICO identifier | `OrderCreation_FileToProxy` |
| Sender Party | `ACME` |
| Sender Service | `LS_ECC` |
| Channel Name | `FileSend_Channel` |
| CPI iFlow ID | `OrderCreation_CPI` |
| CPI Package ID | `IntegrationPackage_01` |

- The first row can optionally be a header row (toggle **File has header row** in Settings → CSV Mapping).
- Both `.csv` and `.xlsx` / `.xls` files are supported.

### How to import

1. Select the correct **system mapping** from the topbar dropdown.
2. Go to **Interface Metadata** in the top navigation.
3. Click **📂 Select File** and choose your mapping file.
4. Click **Import Mapping Metadata**.
5. A success message appears and the table below immediately shows the imported rows with all CSV fields.

Each system mapping stores its metadata independently — switching mappings shows only the rows belonging to that mapping.

### Viewing loaded rows

Below the upload controls, the Interface Metadata page shows a scrollable table of all currently loaded interface rows for the selected system mapping. The columns match exactly the fields defined in **Settings → CSV Mapping** — no runtime status columns are shown here, only the CSV data.

> Importing with **Replace existing** checked replaces all rows for the selected system mapping. Uncheck it to append rows instead.

---

## Running the Application

### Development mode (hot reload on both sides)

```bash
# From the project root — starts both backend (nodemon) and Vite dev server
npm run dev:all
```

- Backend API: `http://localhost:3001`
- Frontend dev server: `http://localhost:5173` (proxies `/api` to `3001`)

To start them separately:

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
npm run dev:client
```

### Production mode

```bash
# Step 1 — build the React app
npm run build

# Step 2 — start the backend (it serves the built frontend)
npm start
```

Open `http://localhost:3001` in a browser.

### Using PostgreSQL

1. Set `DATA_BACKEND=pg` and `DATABASE_URL=postgres://user:password@host:5432/dbname` in `.env`.
2. Start the server — tables are created automatically on first run (`CREATE TABLE IF NOT EXISTS`).
3. No migration script is needed; `initTables()` handles schema creation.

---

## Dashboard Usage

### Navigation

The topbar contains three navigation items:

| Item | Purpose |
|---|---|
| **⇄ Dashboard** | Live status view — channel states, iFlow states, last message times |
| **📋 Interface Metadata** | Upload and review the CSV/Excel mapping file for the active system mapping |
| **⚙ Settings** | System configuration, API endpoints, column layout, CSV mapping |

To the right of the nav links, a **System Mapping** dropdown lets you switch between configured system mappings. The label reads "System Mapping:" for PO↔CPI pairs and "Tenant Mapping:" for CPI↔CPI pairs.

### Dashboard toolbar

The toolbar beneath the topbar contains (right-aligned):

- **Last Sync** — timestamp of the last successful refresh for the active mapping (only shown when data is loaded)
- **↻ Refresh All** — triggers a full status refresh for all rows
- **🔐 Refresh Token** — forces a new CPI OAuth2 token fetch

While a refresh is running:
- The button label changes to **↻ Refreshing…**
- A progress bar appears below the toolbar showing `45% (23/50 rows)`

### Refresh behaviour

By default, the dashboard restores status from the server-side cache when you open it or switch mappings. A full refresh only runs when:
- You click **↻ Refresh All** manually
- The background schedule fires (configured via **Refresh Schedule** in Settings → General)
- **Refresh on Load / Mapping Switch** is turned ON in Settings → General

To change this, go to **Settings → General → Performance & Refresh** and toggle the **Refresh on Load / Mapping Switch** setting.

### Start / Stop a PO Channel

1. Find the interface row in the table.
2. Click **▶ Start** or **■ Stop** in the PO Actions column.
3. Confirm the action in the dialog.
4. If the channel cannot be started (e.g. wrong automation mode), an error toast explains the reason.

> **Common error:** `Channel cannot be started because it is configured for manual start only.`  
> **Fix:** In PI channel configuration, change **Automation Mode** from `Manual` to `All Users`.

### Deploy / Undeploy a CPI iFlow

1. Find the interface row.
2. Click **↑ Deploy** or **↓ Undeploy** in the CPI Actions column.
3. Confirm the action. The row status refreshes automatically after 1.5 seconds.

### Filter

Type in the filter box above the table to search across all text fields simultaneously (ICO name, sender service, channel name, iFlow ID, etc.).

### Dashboard column types

| Type | Rendered as |
|---|---|
| `text` | Plain text |
| `mono` | Monospace font — good for technical IDs and names |
| `badge` | Coloured status pill — STARTED (green), STOPPED (grey), ERROR (red) |
| `datetime` | Formatted timestamp using the date format from Settings |

---

## API Reference

All endpoints are under `/api`. The Vite dev server proxies these to `http://localhost:3001`.

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | All settings as a flat array |
| `GET` | `/api/settings/grouped` | Settings grouped by `group_name` |
| `PUT` | `/api/settings` | Bulk update settings (`{ key: value, ... }`) |
| `PUT` | `/api/settings/:key` | Update a single setting by key |
| `POST` | `/api/settings` | Add a new setting |
| `DELETE` | `/api/settings/:key` | Delete a setting by key |

### Systems

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/systems/po` | All configured PO/PI systems |
| `POST` | `/api/systems/po` | Create a PO/PI system |
| `PUT` | `/api/systems/po/:id` | Update a PO/PI system |
| `DELETE` | `/api/systems/po/:id` | Delete a PO/PI system (blocked if used by a mapping) |
| `GET` | `/api/systems/po/:id/test` | Test connectivity to a PO/PI system |
| `GET` | `/api/systems/cpi` | All configured CPI tenants |
| `POST` | `/api/systems/cpi` | Create a CPI tenant |
| `PUT` | `/api/systems/cpi/:id` | Update a CPI tenant |
| `DELETE` | `/api/systems/cpi/:id` | Delete a CPI tenant (blocked if used by a mapping) |
| `GET` | `/api/systems/mappings` | All system mappings |
| `POST` | `/api/systems/mappings` | Create a system mapping |
| `PUT` | `/api/systems/mappings/:id` | Update a system mapping |
| `PATCH` | `/api/systems/mappings/:id/set-default` | Mark a mapping as the default |
| `DELETE` | `/api/systems/mappings/:id` | Delete a system mapping |

### Mappings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/mapping?system_mapping_id=<id>` | Interface mappings for a system mapping |
| `POST` | `/api/mapping/upload` | Upload CSV / Excel file (`multipart/form-data`, include `system_mapping_id`) |
| `PUT` | `/api/mapping/:id` | Update a single mapping row |
| `DELETE` | `/api/mapping/:id` | Delete a mapping row |
| `DELETE` | `/api/mapping` | Clear all mappings |

### Status

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/status/batch` | Fetch status for multiple rows in one call |
| `GET` | `/api/status/cache?sm_id=<id>` | Get the status cache for a system mapping |
| `PUT` | `/api/status/cache` | Save the full status cache after a refresh |
| `PATCH` | `/api/status/cache/row/:id` | Update a single row in the cache |
| `GET` | `/api/status/backend` | Returns the active storage backend (`file` or `pg`) |

Batch request body:
```json
{
  "ids": ["uuid1", "uuid2"],
  "apiCols": [
    {
      "api_config_id": "po-get-channel-state",
      "input_mappings": { "senderParty": "{{row.po_sender_party}}" }
    }
  ],
  "system_mapping_id": "<uuid>"
}
```

The `system_mapping_id` field tells the backend which PO system and CPI tenant to use for credential resolution. Without it, the backend falls back to the legacy global settings.

### PO / PI

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/po/test` | Test connectivity to the default PO host |
| `GET` | `/api/po/channels` | All interface mappings (PO view) |
| `GET` | `/api/po/channel/:id/status` | Channel state for one mapping |
| `POST` | `/api/po/channel/:id/start` | Start a PO channel |
| `POST` | `/api/po/channel/:id/stop` | Stop a PO channel |
| `GET` | `/api/po/channel/:id/lastmessage` | Last message time for one channel |
| `POST` | `/api/po/call/:apiConfigId` | Execute a PO API config with custom params |

### CPI

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cpi/token/status` | Current OAuth2 token state |
| `POST` | `/api/cpi/token/refresh` | Force a token refresh |
| `GET` | `/api/cpi/iflows` | All interface mappings (CPI view) |
| `GET` | `/api/cpi/iflow/:id/status` | Runtime status for one iFlow |
| `POST` | `/api/cpi/iflow/:id/deploy` | Deploy a CPI iFlow |
| `DELETE` | `/api/cpi/iflow/:id/undeploy` | Undeploy a CPI iFlow |
| `GET` | `/api/cpi/iflow/:id/lastmpl` | Last MPL entry for one iFlow |
| `POST` | `/api/cpi/call/:apiConfigId` | Execute a CPI API config with custom params |

### UI Configuration

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ui-config/apis` | All API configurations |
| `POST` | `/api/ui-config/apis` | Create an API configuration |
| `PUT` | `/api/ui-config/apis/:id` | Update an API configuration |
| `DELETE` | `/api/ui-config/apis/:id` | Delete an API configuration |
| `GET` | `/api/ui-config/components` | All UI action buttons |
| `POST` | `/api/ui-config/components` | Create a UI component |
| `PUT` | `/api/ui-config/components/:id` | Update a UI component |
| `DELETE` | `/api/ui-config/components/:id` | Delete a UI component |

---

## Data Storage

The application supports two storage backends selected by the `DATA_BACKEND` environment variable.

### Collections

| Collection | Description |
|---|---|
| `settings` | Connection parameters, general settings, CSV column map, dashboard columns |
| `po_systems` | Configured PO/PI system entries (host, port, credentials, SID) |
| `cpi_tenants` | Configured CPI tenant entries (host, OAuth2 credentials) |
| `system_mappings` | Named pairs of PO/CPI systems with flexible type support |
| `api_configs` | Built-in and custom SAP API endpoint definitions |
| `ui_components` | Action buttons (Start, Stop, Deploy, Undeploy, …) shown per row |
| `interface_mappings` | The ICO-to-iFlow mapping rows imported from CSV/Excel, keyed per system mapping |
| `status_cache` | Per-system-mapping cache of the last dashboard refresh results |

### System mapping document structure

```json
{
  "id": "uuid",
  "name": "N75 ↔ DEMO1",
  "system_a_type": "po",
  "system_a_id": "<po_system_uuid>",
  "system_b_type": "cpi",
  "system_b_id": "<cpi_tenant_uuid>",
  "is_default": true
}
```

Legacy fields `po_system_id` and `cpi_tenant_id` are preserved for backward compatibility and migrated automatically on startup.

### Status cache document structure

```json
{
  "id": "sm_<system_mapping_uuid>",
  "last_refresh_time": "2026-11-04T10:23:00.000Z",
  "rows": {
    "<interface_mapping_uuid>": {
      "po-get-channel-state": { "state": "STARTED" },
      "cpi-iflow-status":     { "status": "STARTED" }
    }
  }
}
```

The `id` is `sm_<system_mapping_id>` for named mappings, or `singleton` for legacy single-system mode.

### File backend (`DATA_BACKEND=file`, default)

- Data lives in **`data/app.json`**.
- Loaded into memory on startup; every write flushes the full state to disk immediately.
- **Backup:** Copy `data/app.json` to preserve your full configuration and mappings.
- **Reset:** Delete `data/app.json` and restart — the server recreates it with factory defaults.

### PostgreSQL backend (`DATA_BACKEND=pg`)

- Each collection maps to a table with a single `doc JSONB NOT NULL` column.
- Tables are created automatically on startup (`CREATE TABLE IF NOT EXISTS`).
- Requires `DATABASE_URL` in `.env` (e.g. `postgres://user:pass@localhost:5432/pocpi`).
- The masked `DATABASE_URL` is visible at the bottom of **Settings → General**.
- **Backup:** Use standard `pg_dump`. **Reset:** `TRUNCATE` the relevant tables or drop and restart.

### Switching backends

Change `DATA_BACKEND` in `.env` and restart the server. Data is **not** migrated automatically between backends — export from one and re-import to the other if needed.

---

## Troubleshooting

### Dashboard shows data from the wrong SAP system

Each system mapping uses credentials from its own configured PO/PI system and CPI tenant — there is no fallback to another system when a specific mapping is selected. If status queries are returning results you don't expect:

1. Go to **Settings → Systems & Mapping** and verify that the system mapping's Side A and Side B point to the correct systems.
2. Ensure the interface metadata for that mapping was uploaded with the correct CSV file (the one matching that system's actual interfaces).
3. If channels don't exist on the selected system, status will show **Not Found** — this is correct behaviour.

### Status shows "Not Found" for all channels after switching mappings

The selected system mapping points to a system that does not have the channels in the loaded interface metadata. Either:
- Upload the correct CSV for this mapping via **Interface Metadata**
- Or check that the mapping's Side A/B systems are set correctly in **Settings → Systems & Mapping**

### "PO host not configured" on the dashboard

Go to **Settings → Systems & Mapping**, ensure at least one PO system is configured and linked to a system mapping, and that the system mapping is set as default.

For legacy single-system mode (no system mappings): go to **Settings → PO Connection** and fill in **PO Host**, **Username**, and **Password**, then save.

### Channel status shows a loading spinner but never resolves

- Verify the PO system's host and port in **Settings → Systems & Mapping**.
- Use the **Test** button on the PO system entry to check reachability.
- Ensure the service user has authorisation for `ChannelAdminServlet` and `AdapterMessageMonitoring`.

### Channel start returns "OK" but the status never changes

The channel's Automation Mode in SAP PI is set to `Manual`. Only dialog users can start such channels.

**Fix (SAP side):** Open the channel in PI/ESR → Communication Channel → change **Automation Mode** to `All Users` → activate.

### CPI iFlow status shows "Not Deployed"

The iFlow exists in the design-time repository but has not been deployed to the runtime. Click **↑ Deploy** to deploy it.

### CPI status shows "Not Found"

The iFlow ID in the mapping row does not match any iFlow in the CPI tenant. Use the ✏ edit icon to correct the iFlow ID field.

### Refresh fires every time I open the dashboard or switch mappings

By default, the dashboard only restores from cache on load. If a full refresh is triggering automatically, **Refresh on Load / Mapping Switch** is turned ON. Disable it in **Settings → General → Performance & Refresh**.

### Last Sync timestamp does not update

The "Last Sync" label is tied to the active system mapping and only appears once that mapping has data loaded (mappings.length > 0). It updates after each successful **↻ Refresh All** or after a background schedule refresh.

### Refresh is slow with 500+ rows

Tune the concurrency settings in **Settings → General → Performance & Refresh**:

- Increase **Rows per Batch** (e.g. `25`)
- Increase **Parallel Batches** (e.g. `4`)

Total rows in flight = `parallel_rows × parallel_batches`. Increase gradually — SAP systems will reject requests if too many arrive simultaneously.

### OAuth2 token errors for CPI

- Verify the CPI tenant's **Token URL**, **Client ID**, and **Client Secret** in **Settings → Systems & Mapping**.
- Click **🔐 Refresh Token** in the dashboard toolbar to force a new token fetch.
- Ensure the OAuth2 client has the `AuthGroup_IntegrationDeveloper` role (or equivalent) in the BTP cockpit.

### Backend fails to start: "DB init failed"

**File backend:** The `data/` directory could not be created or `data/app.json` is malformed. Delete `data/app.json` and restart.

**PostgreSQL backend:** The `DATABASE_URL` is missing, incorrect, or the database server is unreachable. Check the connection string in `.env` and verify PostgreSQL is running.

### PostgreSQL: tables not created

Tables are created automatically on startup via `CREATE TABLE IF NOT EXISTS`. If tables are missing, check that the database user has `CREATE` privilege on the target schema, and look for errors in the server startup log.
