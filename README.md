# DataTablePro

A production-ready, configurable server-side data table module for PHP 8 applications. Built with **no PHP framework** and **no JS plugins** — just clean PHP 8, PostgreSQL, Bootstrap 5, and jQuery.

Drop it into any existing PHP app with 4 files and 3 lines of code.

---

## Features

- **Server-Side Processing** — Pagination, sorting, multi-column searching via AJAX
- **Rowspan / Colspan** — Dynamic cell merging with a JSON metadata protocol
- **Grouped Mode** — Auto-group rows by any column with rowspan + summary rows
- **Export** — PDF (branded, styled), Excel (.xlsx), and CSV with one click
- **Configurable** — One config array drives the entire table: columns, types, formatters, grouping
- **Type-Driven Rendering** — Column types (`id`, `name`, `email`, `status`, `date`) auto-format cells
- **URL State** — Page, search, sort, and mode persist in the URL hash (bookmarkable)
- **Keyboard Shortcuts** — `/` to focus search, `Esc` to blur
- **Toast Notifications** — Success/error feedback for exports
- **Secure** — Prepared statements, column whitelisting, LIKE wildcard escaping, XSS prevention

---

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Backend  | PHP 8 (no framework), PDO      |
| Database | PostgreSQL                     |
| Frontend | Bootstrap 5.3, jQuery 3.7      |
| Export   | SheetJS (Excel/CSV), jsPDF (PDF) |

---

## Quick Start

### 1. Database Setup

```bash
# Create the database
createdb table_demo

# Run the schema + sample data
psql -d table_demo -f database/setup.sql
```

Update credentials in `config/Database.php` if needed:

```php
private const DB_HOST = 'localhost';
private const DB_PORT = '5432';
private const DB_NAME = 'table_demo';
private const DB_USER = 'postgres';
private const DB_PASS = '';
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
│   └── Database.php              # PDO singleton (PostgreSQL)
├── controllers/
│   └── UserController.php        # Demo controller (4 methods)
├── models/
│   ├── DataTable.php             # Generic data table engine
│   └── UserModel.php             # Demo: users table config + court schedule
├── views/
│   └── users/
│       └── index.php             # Demo page using DataTableWidget
├── helpers/
│   ├── DataTableWidget.php       # HTML widget renderer
│   └── Response.php              # JSON response helper
├── public/
│   ├── index.php                 # Router / entry point
│   ├── .htaccess                 # URL rewriting
│   └── assets/
│       ├── css/datatable.css     # Table styles
│       └── js/datatable.js       # Frontend controller
├── database/
│   └── setup.sql                 # Schema + 35 sample rows
└── .htaccess                     # Root redirect to public/
```

---

## Drop-In Integration Guide

Copy **4 files** into your existing app, then wire them up:

```
models/DataTable.php           → your models directory
helpers/DataTableWidget.php    → your helpers directory
public/assets/js/datatable.js  → your public JS directory
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
        ['key' => 'status',     'label' => 'Status',   'sortable' => true, 'searchable' => false, 'type' => 'status'],
    ],
    'default_sort'  => 'product_id',
    'default_order' => 'asc',
    'has_actions'   => true,
    'group_by'      => 'category',       // optional: enable grouped mode
    'group_label'   => 'Category',       // optional: group column label
    'formatters'    => [                  // optional: transform values
        'price'  => fn($v) => '$' . number_format((float)$v, 2),
        'status' => fn($v) => ucfirst((string)$v),
    ],
];
```

### Step 2 — Handle AJAX (One Line)

In your controller or route handler:

```php
// Data endpoint
DataTable::handleRequest($config, $yourPdo);

// Export endpoint
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
    'brand_name'        => 'MyApp',
    'css_path'          => '/assets/css/datatable.css',
    'js_path'           => '/assets/js/datatable.js',
]);
?>
<!DOCTYPE html>
<html>
<head>
    <?= $widget->renderHeadAssets() ?>
</head>
<body>
    <!-- Your existing navbar, sidebar, etc. -->

    <?= $widget->render() ?>

    <?= $widget->renderFooterAssets() ?>
</body>
</html>
```

That's it. Pagination, sorting, searching, export, and grouped mode all work automatically.

---

## Configuration Reference

### Table Config (`DataTable`)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table` | string | yes | Database table name |
| `primary_key` | string | yes | Primary key column |
| `columns` | array | yes | Column definitions (see below) |
| `default_sort` | string | no | Default sort column (default: `'id'`) |
| `default_order` | string | no | `'asc'` or `'desc'` (default: `'asc'`) |
| `has_actions` | bool | no | Show View/Edit/Delete buttons |
| `group_by` | string | no | Column key for grouped mode |
| `group_label` | string | no | Display label for group column |
| `formatters` | array | no | `['column' => fn($value, $row) => formatted]` |

### Column Definition

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `key` | string | yes | Database column name |
| `label` | string | yes | Display header text |
| `sortable` | bool | no | Allow sorting on this column |
| `searchable` | bool | no | Include in search queries |
| `type` | string | no | Rendering hint: `id`, `name`, `email`, `status`, `date` |

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
| `brand_name` | string | `'DataTablePro'` | Brand name in PDF export footer |
| `css_path` | string | `'/assets/css/datatable.css'` | Path to CSS file |
| `js_path` | string | `'/assets/js/datatable.js'` | Path to JS file |

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
| `skip` | bool | `true` = cell covered by another cell's rowspan/colspan — don't render `<td>` |
| `rowspan` | int | HTML rowspan (only set if > 1) |
| `colspan` | int | HTML colspan (only set if > 1) |
| `class` | string | CSS classes for the `<td>` |
| `html` | bool | `true` = render value as raw HTML |

### How It Works

When a cell has `rowspan: 3`, the next 2 rows must have `{"skip": true}` at that column index. The browser fills the visual space; the `skip` marker tells JS not to emit a `<td>`.

```json
[
    [{"value": "Mumbai", "rowspan": 3}, {"value": "Raj Patel"}, ...],
    [{"skip": true},                    {"value": "Priya Shah"}, ...],
    [{"skip": true},                    {"value": "Amit Kumar"}, ...],
    [{"value": "Mumbai — 3 row(s)", "colspan": 7, "class": "summary-row"}]
]
```

---

## API Endpoints

### `GET /users/data`

Returns paginated table data.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Page number |
| `per_page` | int | `10` | Rows per page (5, 10, 25, 50, 100) |
| `search` | string | `''` | Search term (matches searchable columns) |
| `sort_column` | string | `'id'` | Column to sort by |
| `sort_order` | string | `'asc'` | `asc` or `desc` |
| `mode` | string | `'normal'` | `normal` or `grouped` |

**Response (normal mode):**

```json
{
    "columns": [
        {"key": "id", "label": "ID", "sortable": true, "type": "id"},
        {"key": "name", "label": "Name", "sortable": true, "type": "name"}
    ],
    "primary_key": "id",
    "has_actions": true,
    "data": [
        {"id": 1, "name": "Raj Patel", "email": "raj@example.com", ...}
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
            {"value": "raj@example.com"},
            ...
        ],
        [{"skip": true}, {"value": "Priya Shah"}, ...],
        ...
    ],
    "mode": "grouped"
}
```

### `GET /users/export`

Returns all matching records (no pagination) for client-side export.

### `GET /users/demo-merged`

Returns hardcoded court schedule data demonstrating complex rowspan + colspan.

---

## Column Types

Column `type` controls how cells render in the frontend:

| Type | Rendering |
|------|-----------|
| `id` | `#123` with muted styling |
| `name` | Bold text |
| `email` | Clickable `mailto:` link |
| `status` | Colored badge with dot (active=green, inactive=gray, pending=orange) |
| `date` | Date-styled text |
| *(none)* | Plain escaped text |

---

## Security

- **SQL Injection** — All queries use PDO prepared statements
- **Column Whitelisting** — Sort columns validated against explicit allowlist
- **LIKE Escaping** — `%`, `_`, `\` escaped before ILIKE queries
- **XSS Prevention** — `htmlspecialchars()` in PHP, `escapeHtml()` in JS
- **Input Validation** — Page size constrained to allowed values, sort order to ASC/DESC
- **Table Name Validation** — Regex check prevents injection via table name
- **Security Headers** — `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Bootstrap 5.3 requires no IE support.

---

## License

MIT
