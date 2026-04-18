<?php

declare(strict_types=1);

class DataTable
{
    private PDO $db;
    private array $config;

    private array $sortableKeys   = [];
    private array $searchableKeys = [];
    private array $allKeys        = [];

    public function __construct(array $config)
    {
        $this->db     = Database::getConnection();
        $this->config = $config;

        foreach ($config['columns'] as $col) {
            $this->allKeys[] = $col['key'];
            if (!empty($col['sortable'])) {
                $this->sortableKeys[] = $col['key'];
            }
            if (!empty($col['searchable'])) {
                $this->searchableKeys[] = $col['key'];
            }
        }
    }

    public function getColumnDefs(): array
    {
        $defs = [];
        foreach ($this->config['columns'] as $col) {
            $def = [
                'key'      => $col['key'],
                'label'    => $col['label'],
                'sortable' => !empty($col['sortable']),
            ];
            if (!empty($col['type'])) {
                $def['type'] = $col['type'];
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
        string $sortOrder
    ): array {
        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $table   = $this->safeTable();

        $sortColumn = $this->validateSortColumn($sortColumn);
        $sortOrder  = $this->validateSortOrder($sortOrder);
        $offset     = ($page - 1) * $perPage;

        [$whereClause, $bindings] = $this->buildSearchClause($search);
        $selectCols = $this->buildSelectColumns();

        $totalRecords    = $this->countRows($table, '', []);
        $filteredRecords = ($search !== '')
            ? $this->countRows($table, $whereClause, $bindings)
            : $totalRecords;

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

        $totalPages = $filteredRecords > 0 ? (int) ceil($filteredRecords / $perPage) : 0;

        return [
            'columns'          => $this->getColumnDefs(),
            'primary_key'      => $this->config['primary_key'] ?? null,
            'has_actions'      => !empty($this->config['has_actions']),
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
        string $sortOrder
    ): array {
        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $table   = $this->safeTable();

        $groupByKey = $this->config['group_by'] ?? $this->allKeys[0] ?? null;
        if (!$groupByKey || !in_array($groupByKey, $this->allKeys, true)) {
            return $this->getData($page, $perPage, $search, $sortColumn, $sortOrder);
        }

        $sortColumn = $this->validateSortColumn($sortColumn, $groupByKey);
        $sortOrder  = $this->validateSortOrder($sortOrder);

        [$whereClause, $bindings] = $this->buildSearchClause($search);
        $selectCols = $this->buildSelectColumns();

        $totalRecords    = $this->countRows($table, '', []);
        $filteredRecords = ($search !== '')
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

    public function getAllData(string $search, string $sortColumn, string $sortOrder): array
    {
        $table      = $this->safeTable();
        $sortColumn = $this->validateSortColumn($sortColumn);
        $sortOrder  = $this->validateSortOrder($sortOrder);
        $selectCols = $this->buildSelectColumns();

        [$whereClause, $bindings] = $this->buildSearchClause($search);

        $sql  = "SELECT {$selectCols} FROM {$table} {$whereClause} ORDER BY {$sortColumn} {$sortOrder}";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
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

    private function buildSearchClause(string $search): array
    {
        if ($search === '' || empty($this->searchableKeys)) {
            return ['', []];
        }

        $escaped    = $this->escapeLikeWildcards($search);
        $conditions = [];
        $bindings   = [];

        foreach ($this->searchableKeys as $i => $col) {
            $param = ":search{$i}";
            $conditions[]     = "CAST({$col} AS TEXT) ILIKE {$param} ESCAPE '\\'";
            $bindings[$param] = "%{$escaped}%";
        }

        return ['WHERE ' . implode(' OR ', $conditions), $bindings];
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
                    $row[$key] = $fn($row[$key], $row);
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
