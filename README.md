# DataTablePro

![PHP 8+](https://img.shields.io/badge/PHP-8.0+-777BB4?logo=php&logoColor=white)
![Bootstrap 5](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)
![jQuery](https://img.shields.io/badge/jQuery-3.7-0769AD?logo=jquery&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

A production-ready, configurable server-side data table module for PHP 8 applications. Built with **no PHP framework** and **no JS plugins** — just clean PHP 8, PostgreSQL, Bootstrap 5, and jQuery.

Drop it into any existing PHP app with 4 files and 3 lines of code.

---

## Features

### Core
- **Server-Side Processing** — Pagination, sorting, multi-column searching via AJAX
- **Rowspan / Colspan** — Dynamic cell merging with a JSON metadata protocol
- **Grouped Mode** — Auto-group rows by any column with rowspan + summary rows
- **Export** — PDF (branded, styled), Excel (.xlsx), and CSV with one click
- **Configurable** — One config array drives the entire table: columns, types, formatters, grouping
- **Type-Driven Rendering** — Column types (`id`, `name`, `email`, `status`, `date`) auto-format cells

### UI Enhancements
- **Dark Mode** — Toggle with localStorage persistence; respects `prefers-color-scheme`
- **Column Show/Hide** — Toggle column visibility from a dropdown; persists in localStorage
- **Search Highlighting** — Matched search terms highlighted with `<mark>` tags (XSS-safe)
- **Smart Column Filters** — Per-column: dropdown for enums, date-range picker for dates, text for others
- **Loading Skeleton** — Animated shimmer rows on initial load; overlay spinner on subsequent loads
- **Row Selection + Bulk Actions** — Checkbox per row, select-all, sticky bulk action bar
- **Configurable Action Buttons** — Define View/Edit/Delete (or custom) actions via config array

### Accessibility & UX
- **ARIA Attributes** — `aria-sort` on headers, `aria-label` on inputs/buttons, `aria-current="page"` on pagination
- **Keyboard Shortcuts** — `/` to focus search, `Esc` to blur
- **URL State** — Page, search, sort, filters, and mode persist in the URL hash (bookmarkable)
- **Toast Notifications** — Success/error feedback for exports and actions
- **Print Styles** — Clean print layout with toolbar/footer hidden
- **Responsive** — Mobile-friendly toolbar and pagination

### Security & Robustness
- **Prepared Statements** — All queries use PDO parameterized queries with `EMULATE_PREPARES => false`
- **Column Whitelisting** — Sort/filter columns validated against explicit allowlist
- **SRI Hashes** — CDN scripts use `integrity` + `crossorigin` attributes
- **Security Headers** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- **Environment Variables** — Database credentials loaded from `$_ENV` / `getenv()`, not hardcoded
- **Input Guards** — Search capped at 200 chars, per_page constrained to allowlist, page clamped to valid range, filter count limited to 20, date values validated with `strtotime()`
- **Error Isolation** — Formatter exceptions caught and logged without crashing the response
- **Export Limits** — Configurable `max_export_rows` (default 10,000) prevents full-table dumps

---

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Backend  | PHP 8.1+ (no framework), PDO   |
| Database | PostgreSQL 12+                 |
| Frontend | Bootstrap 5.3, jQuery 3.7      |
| Export   | SheetJS (Excel/CSV), jsPDF (PDF) |

---

## Quick Start

### 1. Database Setup

```bash
createdb table_demo
psql -d table_demo -f database/setup.sql
```

Configure credentials via environment variables (or edit defaults in `config/Database.php`):

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=table_demo
export DB_USER=postgres
export DB_PASS=
```

### 2. Start the Server

```bash
php -S localhost:8000 -t public
```

### 3. Open

Visit `http://localhost:8000` — the user management demo loads automatically.

---

## Project Structure

```
Table/
├── config/
│   └── Database.php              # PDO singleton, env-based credentials
├── controllers/
│   └── UserController.php        # Demo controller (data, export, demo)
├── models/
│   ├── DataTable.php             # Generic data table engine (~560 lines)
│   └── UserModel.php             # Demo config: users table + court schedule
├── views/
│   └── users/
│       └── index.php             # Demo page using DataTableWidget
├── helpers/
│   ├── DataTableWidget.php       # HTML widget renderer with SRI
│   └── Response.php              # JSON response helper
├── public/
│   ├── index.php                 # Router, autoloader, security headers
│   ├── .htaccess                 # URL rewriting (Apache)
│   └── assets/
│       ├── css/datatable.css     # All styles including dark mode (~1070 lines)
│       └── js/datatable.js       # Frontend controller (~1430 lines)
├── database/
│   └── setup.sql                 # Schema + 35 sample rows
└── .htaccess                     # Root redirect to public/
```

---

## Drop-In Integration Guide

Copy **4 files** into your existing application:

```
models/DataTable.php            → your models directory
helpers/DataTableWidget.php     → your helpers directory
public/assets/js/datatable.js   → your public JS directory
public/assets/css/datatable.css → your public CSS directory
```

### Step 1 — Define Your Table Config

```php
$config = [
    'table'        => 'products',
    'primary_key'  => 'product_id',
    'columns'      => [
        ['key' => 'product_id', 'label' => 'ID',       'sortable' => true, 'searchable' => false, 'type' => 'id'],
        ['key' => 'name',       'label' => 'Name',     'sortable' => true, 'searchable' => true,  'type' => 'name'],
        ['key' => 'email',      'label' => 'Contact',  'sortable' => true, 'searchable' => true,  'type' => 'email'],
        ['key' => 'price',      'label' => 'Price',    'sortable' => true, 'searchable' => false],
        ['key' => 'category',   'label' => 'Category', 'sortable' => true, 'searchable' => true],
        ['key' => 'status',     'label' => 'Status',   'sortable' => true, 'searchable' => false,
         'type' => 'status', 'filterable' => true, 'filter_options' => ['Active', 'Inactive', 'Pending']],
        ['key' => 'created_at', 'label' => 'Created',  'sortable' => true, 'searchable' => false,
         'type' => 'date', 'filterable' => true],
    ],
    'default_sort'  => 'product_id',
    'default_order' => 'asc',
    'has_actions'   => true,
    'actions'       => [
        ['key' => 'view',   'label' => 'View',   'icon' => 'bi-eye',    'class' => 'btn-view'],
        ['key' => 'edit',   'label' => 'Edit',   'icon' => 'bi-pencil', 'class' => 'btn-edit'],
        ['key' => 'delete', 'label' => 'Delete', 'icon' => 'bi-trash3', 'class' => 'btn-delete'],
    ],
    'group_by'       => 'category',
    'group_label'    => 'Category',
    'max_export_rows' => 10000,
    'formatters'     => [
        'price'  => fn($v) => '$' . number_format((float)$v, 2),
        'status' => fn($v) => ucfirst((string)$v),
    ],
];
```

### Step 2 — Handle AJAX (One Line)

In your controller or route handler:

```php
// Data endpoint (pagination, search, sort, filters, grouped mode)
DataTable::handleRequest($config, $yourPdo);

// Export endpoint (returns all matching rows up to max_export_rows)
DataTable::handleRequest($config, $yourPdo, 'export');
```

### Step 3 — Render the Widget

In your view/template:

```php
<?php
$widget = new DataTableWidget([
    'data_url'          => '/admin/products/data',
    'export_url'        => '/admin/products/export',
    'title'             => 'Product Catalog',
    'subtitle'          => 'Manage your product inventory',
    'default_sort'      => 'product_id',
    'default_page_size' => 25,
    'show_mode_toggle'  => true,
    'show_export'       => true,
    'show_dark_mode'    => true,
    'show_column_toggle' => true,
    'brand_name'        => 'MyApp',
    'css_path'          => '/assets/css/datatable.css',
    'js_path'           => '/assets/js/datatable.js',
]);
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <?= $widget->renderHeadAssets() ?>
</head>
<body>
    <?= $widget->render() ?>
    <?= $widget->renderFooterAssets() ?>
</body>
</html>
```

That's it. All features work automatically.

---

## Configuration Reference

### Table Config (`DataTable`)

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `table` | string | **yes** | — | Database table name |
| `primary_key` | string | **yes** | — | Primary key column |
| `columns` | array | **yes** | — | Column definitions (see below) |
| `default_sort` | string | no | `'id'` | Default sort column |
| `default_order` | string | no | `'asc'` | `'asc'` or `'desc'` |
| `has_actions` | bool | no | `false` | Show action buttons column |
| `actions` | array | no | `[]` | Action button definitions (see below) |
| `group_by` | string | no | — | Column key for grouped mode |
| `group_label` | string | no | — | Display label for group column |
| `max_export_rows` | int | no | `10000` | Maximum rows returned by export endpoint |
| `formatters` | array | no | `[]` | `['column' => fn($value, $row) => formatted]` |

### Column Definition

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `key` | string | **yes** | Database column name |
| `label` | string | **yes** | Display header text |
| `sortable` | bool | no | Allow sorting on this column |
| `searchable` | bool | no | Include in global search queries |
| `filterable` | bool | no | Show per-column filter (defaults to `searchable` value) |
| `type` | string | no | Rendering hint: `id`, `name`, `email`, `status`, `date` |
| `filter_options` | array | no | Dropdown options for exact-match filter (e.g. `['Active', 'Inactive']`) |

### Action Button Definition

| Key | Type | Description |
|-----|------|-------------|
| `key` | string | Action identifier (e.g. `'view'`, `'edit'`, `'delete'`) |
| `label` | string | Tooltip/aria-label text |
| `icon` | string | Bootstrap Icons class (e.g. `'bi-eye'`, `'bi-pencil'`) |
| `class` | string | CSS class for hover styling (e.g. `'btn-view'`, `'btn-edit'`) |

### Widget Options (`DataTableWidget`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data_url` | string | `''` | AJAX endpoint for table data |
| `export_url` | string | `''` | AJAX endpoint for export data |
| `demo_url` | string | `''` | AJAX endpoint for demo merged table |
| `title` | string | `''` | Page title above the table |
| `subtitle` | string | `''` | Subtitle text |
| `default_sort` | string | `'id'` | Default sort column |
| `default_order` | string | `'asc'` | Default sort direction |
| `default_page_size` | int | `10` | Default rows per page |
| `page_sizes` | array | `[5,10,25,50,100]` | Page size options |
| `show_mode_toggle` | bool | `true` | Show Normal/Grouped toggle |
| `show_export` | bool | `true` | Show Export dropdown |
| `show_dark_mode` | bool | `true` | Show dark mode toggle button |
| `show_column_toggle` | bool | `true` | Show column visibility dropdown |
| `brand_name` | string | `'DataTablePro'` | Brand name in PDF export footer |
| `css_path` | string | `'/assets/css/datatable.css'` | Path to CSS file |
| `js_path` | string | `'/assets/js/datatable.js'` | Path to JS file |

---

## JavaScript API

The frontend exposes `window.DataTablePro` for programmatic control:

### Methods

```javascript
// Refresh the table (re-fetch current page)
DataTablePro.refresh();

// Get array of selected row IDs (checkbox selection)
DataTablePro.getSelectedIds();
// → ['1', '5', '12']

// Get current table state
DataTablePro.getState();
// → { page: 1, perPage: 10, search: '', sort: 'id', order: 'asc', mode: 'normal', filters: {} }
```

### Callbacks

```javascript
// Handle action button clicks (view, edit, delete, or custom)
DataTablePro.onAction = function (action, id, row) {
    switch (action) {
        case 'view':
            window.location.href = '/users/' + id;
            break;
        case 'edit':
            window.location.href = '/users/' + id + '/edit';
            break;
        case 'delete':
            if (confirm('Delete user #' + id + '?')) {
                fetch('/users/' + id, { method: 'DELETE' })
                    .then(function () { DataTablePro.refresh(); });
            }
            break;
    }
};

// Handle bulk action bar clicks
DataTablePro.onBulkAction = function (action, ids) {
    console.log('Bulk ' + action + ' for IDs:', ids);
    // action = 'delete' or 'export'
};
```

---

## Smart Column Filters

Filters are rendered automatically based on column configuration:

| Column Config | Filter Type | Behavior |
|---------------|-------------|----------|
| `filter_options: ['Active', 'Inactive']` | Dropdown `<select>` | Exact match (no wildcards) |
| `type: 'date'` + `filterable: true` | Date range (from/to) | SQL `BETWEEN` on `::date` |
| Any other filterable column | Text input | ILIKE `%term%` partial match |

Filters combine with global search using `AND` logic. Column filters persist in the URL hash.

---

## API Endpoints

### `GET /users/data`

Returns paginated table data.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Page number (auto-clamped to valid range) |
| `per_page` | int | `10` | Rows per page (must be 5, 10, 25, 50, or 100) |
| `search` | string | `''` | Global search term (max 200 chars, matches searchable columns) |
| `sort_column` | string | config default | Column to sort by (validated against sortable whitelist) |
| `sort_order` | string | config default | `asc` or `desc` |
| `mode` | string | `'normal'` | `normal` or `grouped` |
| `filters` | object | `{}` | Per-column filters: `{"status":"Active","created_at":{"from":"2024-01-01","to":"2024-12-31"}}` |

**Response (normal mode):**

```json
{
    "columns": [
        {"key": "id", "label": "ID", "sortable": true, "searchable": false, "filterable": false, "type": "id"},
        {"key": "name", "label": "Name", "sortable": true, "searchable": true, "filterable": true, "type": "name"},
        {"key": "status", "label": "Status", "sortable": true, "searchable": false, "filterable": true,
         "type": "status", "filter_options": ["Active", "Inactive"]}
    ],
    "primary_key": "id",
    "has_actions": true,
    "actions": [
        {"key": "view", "label": "View", "icon": "bi-eye", "class": "btn-view"}
    ],
    "data": [
        {"id": 1, "name": "Raj Patel", "email": "raj@example.com", "status": "Active", "created_at": "05 Jan 2024"}
    ],
    "total_records": 35,
    "filtered_records": 35,
    "current_page": 1,
    "per_page": 10,
    "total_pages": 4,
    "mode": "normal"
}
```

**Response (grouped mode):**

```json
{
    "columns": [...],
    "data": [
        [
            {"value": "Mumbai", "rowspan": 5, "class": "fw-bold align-middle"},
            {"value": "Raj Patel"},
            {"value": "raj@example.com"}
        ],
        [{"skip": true}, {"value": "Priya Shah"}, {"value": "priya@example.com"}],
        [{"value": "Mumbai — 5 row(s)", "colspan": 7, "class": "bg-light fw-semibold text-center small text-muted"}]
    ],
    "mode": "grouped"
}
```

**Error Response:**

```json
{
    "error": "Unable to fetch data. Please try again later.",
    "data": [],
    "total_records": 0,
    "filtered_records": 0,
    "current_page": 1,
    "per_page": 10,
    "total_pages": 0
}
```

### `GET /users/export`

Returns all matching records (up to `max_export_rows`) for client-side export. Same filter/search/sort params as `/users/data`.

### `GET /users/demo-merged`

Returns hardcoded court schedule data demonstrating complex rowspan + colspan.

---

## Column Types

Column `type` controls how cells render in the frontend:

| Type | Rendering | Example |
|------|-----------|---------|
| `id` | `#123` with muted monospace styling | `#42` |
| `name` | Bold text | **Raj Patel** |
| `email` | Clickable `mailto:` link | [raj@example.com](mailto:raj@example.com) |
| `status` | Colored badge with dot | Active (green), Inactive (gray), Pending (orange) |
| `date` | Date-styled monospace text | 05 Jan 2024 |
| *(none)* | Plain escaped text | Mumbai |

Status badge auto-detects these values: `active/enabled/online/confirmed` (green), `inactive/disabled/offline` (gray), `pending/waiting/draft` (orange).

---

## Rowspan / Colspan Protocol

The grouped mode and demo table use a cell-metadata JSON protocol for merged cells:

### Cell Object

```json
{
    "value": "Mumbai",
    "rowspan": 5,
    "colspan": 1,
    "class": "fw-bold align-middle",
    "skip": false,
    "html": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `value` | string | Cell display text |
| `skip` | bool | `true` = cell covered by another cell's rowspan/colspan |
| `rowspan` | int | HTML rowspan (only set if > 1) |
| `colspan` | int | HTML colspan (only set if > 1) |
| `class` | string | CSS classes for the `<td>` |
| `html` | bool | `true` = render value as raw HTML (use with caution) |

When a cell has `rowspan: 3`, the next 2 rows must have `{"skip": true}` at that column index.

---

## Dark Mode

Dark mode is initialized immediately (before DOM ready) to prevent FOUC. The toggle:

1. Checks `localStorage.getItem('dtpro-theme')` for a saved preference
2. Falls back to `window.matchMedia('(prefers-color-scheme: dark)')`
3. Sets `data-bs-theme` attribute on `<html>` element
4. All CSS uses CSS custom properties that respond to `[data-bs-theme="dark"]`

Disable with `show_dark_mode => false` in widget options.

---

## Security

### SQL Injection Protection
- All user values bound via PDO prepared statements
- `EMULATE_PREPARES => false` ensures real server-side parameterization
- Column names validated against whitelist arrays (never interpolated from user input)
- Table name validated with `/^[a-zA-Z_][a-zA-Z0-9_.]*$/` regex
- LIKE wildcards (`%`, `_`, `\`) escaped before ILIKE queries

### XSS Prevention
- PHP: all output escaped with `htmlspecialchars(ENT_QUOTES | ENT_HTML5, 'UTF-8')`
- JS: all data passed through `escapeHtml()` before DOM insertion
- Search highlighting escapes first, then wraps matches in `<mark>` (never raw HTML)
- Separate `escaped` vs `highlighted` variables prevent markup in `mailto:` hrefs

### HTTP Security
- `X-Content-Type-Options: nosniff` on all responses
- `X-Frame-Options: SAMEORIGIN` prevents clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cache-Control: no-store` on JSON responses
- CDN assets use Subresource Integrity (SRI) hashes

### Input Validation
- `per_page` constrained to `[5, 10, 25, 50, 100]` (rejects invalid values)
- `sort_order` constrained to `ASC` or `DESC`
- `sort_column` validated against sortable column whitelist
- `page` clamped to `[1, total_pages]` (out-of-bounds pages auto-corrected)
- Search terms capped at 200 characters
- Filter count limited to 20 per request
- Date filter values validated with regex AND `strtotime()` (rejects `2024-13-45`)
- Autoloader validates class names with `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Router blocks path traversal (`..`) and null bytes

### Credentials
- Database credentials loaded from environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`)
- Safe defaults for local development (`localhost`, `5432`, `table_demo`, `postgres`, empty)
- Connection errors logged but never exposed to the client

### Error Handling
- `display_errors` disabled; `log_errors` enabled
- Formatter exceptions caught and logged (original value preserved)
- All endpoints return structured JSON error responses
- Stack traces never exposed to the client
- Export limited to configurable `max_export_rows` (default 10,000)

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Page exceeds total pages | Clamped to last page server-side; JS re-fetches if needed |
| Search term > 200 characters | Truncated to 200 (both PHP and JS) |
| Invalid `per_page` value | Defaults to 10 |
| Invalid `sort_column` | Falls back to config default |
| Malformed date filter (`2024-13-45`) | Silently ignored (fails `strtotime()` validation) |
| Formatter throws exception | Logs error, preserves original value |
| All columns hidden | Prevented — last visible column cannot be unchecked |
| Export with no matching data | Shows info toast "No data to export" (no empty file) |
| Network timeout (30s) | Shows specific timeout error message |
| localStorage full/disabled | Writes wrapped in try-catch; features degrade gracefully |
| Rapid pagination clicks | Previous AJAX request aborted before new one fires |
| Hash change from saveState | Guard flag prevents infinite re-fetch loop |
| > 20 filter columns | Filter array rejected (returns unfiltered data) |
| Missing config keys | `InvalidArgumentException` with specific message at construction time |
| Empty columns array | `InvalidArgumentException` at construction time |

---

## Browser Support

Works in all modern browsers: Chrome, Firefox, Safari, Edge. Bootstrap 5.3 requires no IE support.

---

## License

MIT
