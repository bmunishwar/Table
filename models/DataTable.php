<?php

declare(strict_types=1);

/**
 * Generic server-side DataTable engine.
 *
 * Works with any PostgreSQL table and any existing PDO connection.
 * Configure once — get pagination, sorting, searching, column filters,
 * grouped rowspan/colspan, and export for free.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  QUICK START — drop into any PHP application
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  1. Define your table config:
 *
 *     $config = [
 *         'table'        => 'products',
 *         'primary_key'  => 'product_id',
 *         'columns'      => [
 *             ['key' => 'product_id', 'label' => 'ID',    'sortable' => true, 'searchable' => false, 'type' => 'id'],
 *             ['key' => 'name',      'label' => 'Name',  'sortable' => true, 'searchable' => true,  'type' => 'name'],
 *             ['key' => 'price',     'label' => 'Price', 'sortable' => true, 'searchable' => false, 'filterable' => true],
 *             ['key' => 'category',  'label' => 'Category', 'sortable' => true, 'searchable' => true],
 *         ],
 *         'default_sort'  => 'product_id',
 *         'default_order' => 'asc',
 *         'has_actions'   => true,
 *         'group_by'      => 'category',       // optional
 *         'group_label'   => 'Category',        // optional
 *         'formatters'    => [                   // optional
 *             'price' => fn($v) => '$' . number_format((float)$v, 2),
 *         ],
 *     ];
 *
 *  2. Handle AJAX requests (one line in your route/controller):
 *
 *     DataTable::handleRequest($config, $yourPdo);
 *     // — or for export:
 *     DataTable::handleRequest($config, $yourPdo, 'export');
 *
 *  3. Render the widget in your view:
 *
 *     $widget = new DataTableWidget([
 *         'data_url'   => '/admin/products/data',
 *         'export_url' => '/admin/products/export',
 *         'title'      => 'Product Catalog',
 *     ]);
 *     echo $widget->renderHeadAssets();   // in <head>
 *     echo $widget->render();             // in <body>
 *     echo $widget->renderFooterAssets(); // before </body>
 */
class DataTable
{
    private PDO $db;
    private array $config;

    private array $sortableKeys   = [];
    private array $searchableKeys = [];
    private array $filterableKeys = [];
    private array $allKeys        = [];
    private array $exactFilterKeys = [];

    public function __construct(array $config, ?PDO $pdo = null)
    {
        $this->db     = $pdo ?? Database::getConnection();
        $this->config = $config;

        // Validate required config keys
        if (!isset($config['table']) || !is_string($config['table']) || $config['table'] === '') {
            throw new \InvalidArgumentException('Config "table" must be a non-empty string.');
        }
        if (!isset($config['primary_key']) || !is_string($config['primary_key']) || $config['primary_key'] === '') {
            throw new \InvalidArgumentException('Config "primary_key" must be a non-empty string.');
        }
        if (!isset($config['columns']) || !is_array($config['columns']) || empty($config['columns'])) {
            throw new \InvalidArgumentException('Config "columns" must be a non-empty array.');
        }
        foreach ($config['columns'] as $i => $c) {
            if (!isset($c['key']) || !is_string($c['key']) || $c['key'] === '') {
                throw new \InvalidArgumentException("Column at index {$i} must have a non-empty string \"key\".");
            }
            if (!isset($c['label']) || !is_string($c['label']) || $c['label'] === '') {
                throw new \InvalidArgumentException("Column at index {$i} must have a non-empty string \"label\".");
            }
        }

        foreach ($config['columns'] as $col) {
            $this->allKeys[] = $col['key'];
            if (!empty($col['sortable'])) {
                $this->sortableKeys[] = $col['key'];
            }
            if (!empty($col['searchable'])) {
                $this->searchableKeys[] = $col['key'];
            }
            $filterable = $col['filterable'] ?? ($col['searchable'] ?? true);
            if ($filterable) {
                $this->filterableKeys[] = $col['key'];
            }
            if (!empty($col['filter_options'])) {
                $this->exactFilterKeys[] = $col['key'];
            }
        }
    }

    /**
     * One-liner for AJAX endpoints. Reads $_GET, runs the query, sends JSON.
     */
    public static function handleRequest(array $config, ?PDO $pdo = null, ?string $forceAction = null): void
    {
        $dt = new self($config, $pdo);

        $action     = $forceAction ?? (string) ($_GET['action'] ?? 'data');
        $page       = max(1, (int) ($_GET['page'] ?? 1));
        $perPage    = (int) ($_GET['per_page'] ?? 10);
        $search     = trim((string) ($_GET['search'] ?? ''));
        if (mb_strlen($search) > 200) {
            $search = mb_substr($search, 0, 200);
        }
        $sortColumn = (string) ($_GET['sort_column'] ?? $config['default_sort'] ?? 'id');
        $sortOrder  = (string) ($_GET['sort_order'] ?? $config['default_order'] ?? 'asc');
        $mode       = (string) ($_GET['mode'] ?? 'normal');

        $filtersRaw = $_GET['filters'] ?? [];
        if (is_string($filtersRaw)) {
            $filtersRaw = json_decode($filtersRaw, true) ?: [];
        }
        $filters = is_array($filtersRaw) ? $filtersRaw : [];

        $allowedPerPage = [5, 10, 25, 50, 100];
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $status = 200;
        $startTime = hrtime(true);
        try {
            if ($action === 'export') {
                $result = [
                    'columns' => $dt->getColumnDefs(),
                    'data'    => $dt->getAllData($search, $sortColumn, $sortOrder, $filters),
                ];
            } elseif ($mode === 'grouped' && !empty($config['group_by'])) {
                $result = $dt->getGroupedData($page, $perPage, $search, $sortColumn, $sortOrder, $filters);
            } else {
                $result = $dt->getData($page, $perPage, $search, $sortColumn, $sortOrder, $filters);
            }
        } catch (\Throwable $e) {
            error_log('[DataTable] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            $status = 500;
            $result = [
                'error'            => 'Unable to fetch data. Please try again later.',
                'data'             => [],
                'total_records'    => 0,
                'filtered_records' => 0,
                'current_page'     => 1,
                'per_page'         => $perPage,
                'total_pages'      => 0,
            ];
        }

        $elapsed = (hrtime(true) - $startTime) / 1e6;
        header(sprintf('Server-Timing: query;dur=%.1f', $elapsed));

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }

    public function getColumnDefs(): array
    {
        $defs = [];
        foreach ($this->config['columns'] as $col) {
            $def = [
                'key'        => $col['key'],
                'label'      => $col['label'],
                'sortable'   => !empty($col['sortable']),
                'searchable' => in_array($col['key'], $this->searchableKeys, true),
                'filterable' => in_array($col['key'], $this->filterableKeys, true),
            ];
            if (!empty($col['type'])) {
                $def['type'] = $col['type'];
            }
            if (!empty($col['filter_options'])) {
                $def['filter_options'] = $col['filter_options'];
            }
            $defs[] = $def;
        }
        return $defs;
    }

    public function getData(
        int    $page,
        int    $perPage,
        string $search,
        string $sortColumn,
        string $sortOrder,
        array  $filters = []
    ): array {
        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $table   = $this->safeTable();

        $sortColumn = $this->validateSortColumn($sortColumn);
        $sortOrder  = $this->validateSortOrder($sortOrder);

        [$whereClause, $bindings] = $this->buildCombinedWhereClause($search, $filters);
        $selectCols = $this->buildSelectColumns();

        $totalRecords = $this->countRows($table, '', []);
        $hasFilters   = ($search !== '' || !empty($this->sanitizeFilters($filters)));
        $filteredRecords = $hasFilters
            ? $this->countRows($table, $whereClause, $bindings)
            : $totalRecords;

        $totalPages = $filteredRecords > 0 ? (int) ceil($filteredRecords / $perPage) : 0;

        if ($page > $totalPages && $totalPages > 0) {
            $page = $totalPages;
        }

        $offset = ($page - 1) * $perPage;

        $sql  = "SELECT {$selectCols} FROM {$table} {$whereClause} ORDER BY {$sortColumn} {$sortOrder} LIMIT :limit OFFSET :offset";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $rows = $this->applyFormatters($rows);

        return [
            'columns'          => $this->getColumnDefs(),
            'primary_key'      => $this->config['primary_key'] ?? null,
            'has_actions'      => !empty($this->config['has_actions']),
            'actions'          => $this->config['actions'] ?? [],
            'data'             => $rows,
            'total_records'    => $totalRecords,
            'filtered_records' => $filteredRecords,
            'current_page'     => $page,
            'per_page'         => $perPage,
            'total_pages'      => $totalPages,
            'mode'             => 'normal',
        ];
    }

    public function getGroupedData(
        int    $page,
        int    $perPage,
        string $search,
        string $sortColumn,
        string $sortOrder,
        array  $filters = []
    ): array {
        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $table   = $this->safeTable();

        $groupByKey = $this->config['group_by'] ?? $this->allKeys[0] ?? null;
        if (!$groupByKey || !in_array($groupByKey, $this->allKeys, true)) {
            return $this->getData($page, $perPage, $search, $sortColumn, $sortOrder, $filters);
        }

        $sortColumn = $this->validateSortColumn($sortColumn, $groupByKey);
        $sortOrder  = $this->validateSortOrder($sortOrder);

        [$whereClause, $bindings] = $this->buildCombinedWhereClause($search, $filters);
        $selectCols = $this->buildSelectColumns();

        $totalRecords = $this->countRows($table, '', []);
        $hasFilters   = ($search !== '' || !empty($this->sanitizeFilters($filters)));
        $filteredRecords = $hasFilters
            ? $this->countRows($table, $whereClause, $bindings)
            : $totalRecords;

        $sql  = "SELECT {$selectCols} FROM {$table} {$whereClause} ORDER BY {$groupByKey} ASC, {$sortColumn} {$sortOrder}";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->execute();
        $allRows = $stmt->fetchAll();

        $allRows = $this->applyFormatters($allRows);

        $groups = [];
        foreach ($allRows as $row) {
            $groups[$row[$groupByKey]][] = $row;
        }

        $comparator = $this->buildComparator($sortColumn, $sortOrder === 'ASC');
        foreach ($groups as &$groupRows) {
            usort($groupRows, $comparator);
        }
        unset($groupRows);

        uasort($groups, function ($gA, $gB) use ($comparator) {
            return $comparator($gA[0], $gB[0]);
        });

        $nonGroupKeys = [];
        foreach ($this->config['columns'] as $col) {
            if ($col['key'] !== $groupByKey) {
                $nonGroupKeys[] = $col['key'];
            }
        }

        $mergedRows = [];
        $colCount   = count($this->config['columns']);

        foreach ($groups as $groupValue => $rows) {
            $count = count($rows);

            foreach ($rows as $index => $row) {
                $metaRow = [];

                if ($index === 0) {
                    $cell = ['value' => (string) $groupValue, 'class' => 'fw-bold align-middle'];
                    if ($count > 1) {
                        $cell['rowspan'] = $count;
                    }
                    $metaRow[] = $cell;
                } else {
                    $metaRow[] = ['skip' => true];
                }

                foreach ($nonGroupKeys as $key) {
                    $metaRow[] = ['value' => (string) ($row[$key] ?? '')];
                }

                $mergedRows[] = $metaRow;
            }

            $mergedRows[] = [
                [
                    'value'   => "{$groupValue} \u{2014} {$count} row(s)",
                    'colspan' => $colCount,
                    'class'   => 'bg-light fw-semibold text-center small text-muted',
                ],
            ];
        }

        $totalMergedRows = count($mergedRows);
        $totalPages      = $totalMergedRows > 0 ? (int) ceil($totalMergedRows / $perPage) : 0;
        $offset          = ($page - 1) * $perPage;
        $pagedRows       = array_slice($mergedRows, $offset, $perPage);

        return [
            'columns'          => $this->getColumnDefs(),
            'primary_key'      => $this->config['primary_key'] ?? null,
            'has_actions'      => false,
            'data'             => array_values($pagedRows),
            'total_records'    => $totalRecords,
            'filtered_records' => $totalMergedRows,
            'current_page'     => $page,
            'per_page'         => $perPage,
            'total_pages'      => $totalPages,
            'mode'             => 'grouped',
            'sort_column'      => $sortColumn,
            'sort_order'       => strtolower($sortOrder),
        ];
    }

    public function getAllData(string $search, string $sortColumn, string $sortOrder, array $filters = []): array
    {
        $table      = $this->safeTable();
        $sortColumn = $this->validateSortColumn($sortColumn);
        $sortOrder  = $this->validateSortOrder($sortOrder);
        $selectCols = $this->buildSelectColumns();
        $maxExport  = (int) ($this->config['max_export_rows'] ?? 10000);

        [$whereClause, $bindings] = $this->buildCombinedWhereClause($search, $filters);

        $sql  = "SELECT {$selectCols} FROM {$table} {$whereClause} ORDER BY {$sortColumn} {$sortOrder} LIMIT :export_limit";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->bindValue(':export_limit', $maxExport, PDO::PARAM_INT);
        $stmt->execute();

        return $this->applyFormatters($stmt->fetchAll());
    }

    // ---- Private helpers ----

    private function safeTable(): string
    {
        $table = $this->config['table'];
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_.]*$/', $table)) {
            throw new \RuntimeException('Invalid table name.');
        }
        return $table;
    }

    private function buildSelectColumns(): string
    {
        $keys = $this->allKeys;
        $pk   = $this->config['primary_key'] ?? null;
        if ($pk && !in_array($pk, $keys, true)) {
            array_unshift($keys, $pk);
        }

        foreach ($keys as $key) {
            if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $key)) {
                throw new \RuntimeException('Invalid column name: ' . $key);
            }
        }

        return implode(', ', $keys);
    }

    private function validateSortColumn(string $col, ?string $default = null): string
    {
        $default = $default ?? $this->config['default_sort'] ?? 'id';
        if (!in_array($col, $this->sortableKeys, true)) {
            $col = in_array($default, $this->sortableKeys, true) ? $default : ($this->sortableKeys[0] ?? $this->allKeys[0]);
        }
        return $col;
    }

    private function validateSortOrder(string $order): string
    {
        $order = strtoupper($order);
        return in_array($order, ['ASC', 'DESC'], true) ? $order : 'ASC';
    }

    private function sanitizeFilters(array $filters): array
    {
        if (count($filters) > 20) {
            return [];
        }
        $clean = [];
        foreach ($filters as $col => $value) {
            if (!in_array($col, $this->filterableKeys, true)) {
                continue;
            }
            if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $col)) {
                continue;
            }
            if (is_array($value)) {
                $from = isset($value['from']) ? trim((string) $value['from']) : '';
                $to   = isset($value['to']) ? trim((string) $value['to']) : '';
                if ($from === '' && $to === '') continue;
                $range = [];
                if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) && strtotime($from) !== false) $range['from'] = $from;
                if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) && strtotime($to) !== false)     $range['to'] = $to;
                if (!empty($range)) $clean[$col] = $range;
            } else {
                $value = trim((string) $value);
                if ($value === '') continue;
                $clean[$col] = $value;
            }
        }
        return $clean;
    }

    private function buildCombinedWhereClause(string $search, array $filters): array
    {
        $parts    = [];
        $bindings = [];

        // Global search (OR across searchable columns)
        if ($search !== '' && !empty($this->searchableKeys)) {
            $escaped    = $this->escapeLikeWildcards($search);
            $conditions = [];
            foreach ($this->searchableKeys as $i => $col) {
                $param = ":search{$i}";
                $conditions[]     = "CAST({$col} AS TEXT) ILIKE {$param} ESCAPE '\\'";
                $bindings[$param] = "%{$escaped}%";
            }
            $parts[] = '(' . implode(' OR ', $conditions) . ')';
        }

        // Per-column filters (AND)
        $cleanFilters = $this->sanitizeFilters($filters);
        $fi = 0;
        foreach ($cleanFilters as $col => $value) {
            if (is_array($value)) {
                if (!empty($value['from'])) {
                    $param = ":filter_from{$fi}";
                    $parts[]          = "{$col}::date >= {$param}::date";
                    $bindings[$param] = $value['from'];
                }
                if (!empty($value['to'])) {
                    $param = ":filter_to{$fi}";
                    $parts[]          = "{$col}::date <= {$param}::date";
                    $bindings[$param] = $value['to'];
                }
            } else {
                $param = ":filter{$fi}";
                if (in_array($col, $this->exactFilterKeys, true)) {
                    $parts[]          = "CAST({$col} AS TEXT) ILIKE {$param}";
                    $bindings[$param] = $value;
                } else {
                    $escaped = $this->escapeLikeWildcards($value);
                    $parts[]          = "CAST({$col} AS TEXT) ILIKE {$param} ESCAPE '\\'";
                    $bindings[$param] = "%{$escaped}%";
                }
            }
            $fi++;
        }

        if (empty($parts)) {
            return ['', []];
        }

        return ['WHERE ' . implode(' AND ', $parts), $bindings];
    }

    private function countRows(string $table, string $whereClause, array $bindings): int
    {
        $sql  = "SELECT COUNT(*) FROM {$table} {$whereClause}";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->execute();
        return (int) $stmt->fetchColumn();
    }

    private function applyFormatters(array $rows): array
    {
        $formatters = $this->config['formatters'] ?? [];
        if (empty($formatters)) {
            return $rows;
        }

        foreach ($rows as &$row) {
            foreach ($formatters as $key => $fn) {
                if (array_key_exists($key, $row)) {
                    try {
                        $row[$key] = $fn($row[$key], $row);
                    } catch (\Throwable $e) {
                        error_log('[DataTable] Formatter error for column "' . $key . '": ' . $e->getMessage());
                        // Keep original value on formatter failure
                    }
                }
            }
        }
        unset($row);
        return $rows;
    }

    private function buildComparator(string $sortColumn, bool $isAsc): \Closure
    {
        return function ($a, $b) use ($sortColumn, $isAsc): int {
            $valA = $a[$sortColumn] ?? '';
            $valB = $b[$sortColumn] ?? '';
            if (is_numeric($valA) && is_numeric($valB)) {
                $cmp = (float) $valA <=> (float) $valB;
            } else {
                $cmp = strnatcasecmp((string) $valA, (string) $valB);
            }
            return $isAsc ? $cmp : -$cmp;
        };
    }

    private function escapeLikeWildcards(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
