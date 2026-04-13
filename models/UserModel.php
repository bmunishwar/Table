<?php

declare(strict_types=1);

class UserModel
{
    private PDO $db;

    private const SORTABLE_COLUMNS = [
        'id', 'name', 'email', 'mobile', 'city', 'status', 'created_at',
    ];

    private const SEARCHABLE_COLUMNS = [
        'name', 'email', 'mobile', 'city',
    ];

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Fetch paginated, sorted, filtered users (normal flat-row mode).
     */
    public function getUsers(
        int    $page,
        int    $perPage,
        string $search,
        string $sortColumn,
        string $sortOrder
    ): array {
        // Validate sort column
        if (!in_array($sortColumn, self::SORTABLE_COLUMNS, true)) {
            $sortColumn = 'id';
        }

        // Validate sort order
        $sortOrder = strtoupper($sortOrder);
        if (!in_array($sortOrder, ['ASC', 'DESC'], true)) {
            $sortOrder = 'ASC';
        }

        $offset = ($page - 1) * $perPage;

        // Build search condition (ILIKE for case-insensitive PostgreSQL search)
        $whereClause = '';
        $bindings    = [];

        if ($search !== '') {
            $escapedSearch = $this->escapeLikeWildcards($search);
            $conditions    = [];
            foreach (self::SEARCHABLE_COLUMNS as $i => $col) {
                $param          = ":search{$i}";
                $conditions[]   = "{$col} ILIKE {$param}";
                $bindings[$param] = "%{$escapedSearch}%";
            }
            $whereClause = 'WHERE ' . implode(' OR ', $conditions);
        }

        // Total records (unfiltered)
        $totalRecords = (int) $this->db
            ->query('SELECT COUNT(*) FROM users')
            ->fetchColumn();

        // Filtered records
        if ($search !== '') {
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM users {$whereClause}");
            foreach ($bindings as $param => $val) {
                $stmtCount->bindValue($param, $val);
            }
            $stmtCount->execute();
            $filteredRecords = (int) $stmtCount->fetchColumn();
        } else {
            $filteredRecords = $totalRecords;
        }

        // Fetch data
        $sql = "SELECT * FROM users {$whereClause} ORDER BY {$sortColumn} {$sortOrder} LIMIT :limit OFFSET :offset";

        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll();

        $totalPages = $filteredRecords > 0 ? (int) ceil($filteredRecords / $perPage) : 0;

        return [
            'data'             => $rows,
            'total_records'    => $totalRecords,
            'filtered_records' => $filteredRecords,
            'current_page'     => $page,
            'per_page'         => $perPage,
            'total_pages'      => $totalPages,
            'mode'             => 'normal',
        ];
    }

    /**
     * Fetch users grouped by city with rowspan/colspan metadata.
     * Supports sorting: rows within each city group are sorted, and
     * city groups themselves are ordered by the sort column's first value.
     */
    public function getGroupedByCityData(
        int    $page,
        int    $perPage,
        string $search,
        string $sortColumn,
        string $sortOrder
    ): array {
        // Validate sort column
        if (!in_array($sortColumn, self::SORTABLE_COLUMNS, true)) {
            $sortColumn = 'city';
        }

        // Validate sort order
        $sortOrder = strtoupper($sortOrder);
        if (!in_array($sortOrder, ['ASC', 'DESC'], true)) {
            $sortOrder = 'ASC';
        }

        // Build search condition
        $whereClause = '';
        $bindings    = [];

        if ($search !== '') {
            $escapedSearch = $this->escapeLikeWildcards($search);
            $conditions    = [];
            foreach (self::SEARCHABLE_COLUMNS as $i => $col) {
                $param          = ":search{$i}";
                $conditions[]   = "{$col} ILIKE {$param}";
                $bindings[$param] = "%{$escapedSearch}%";
            }
            $whereClause = 'WHERE ' . implode(' OR ', $conditions);
        }

        // Total records (unfiltered)
        $totalRecords = (int) $this->db
            ->query('SELECT COUNT(*) FROM users')
            ->fetchColumn();

        // Filtered records
        if ($search !== '') {
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM users {$whereClause}");
            foreach ($bindings as $param => $val) {
                $stmtCount->bindValue($param, $val);
            }
            $stmtCount->execute();
            $filteredRecords = (int) $stmtCount->fetchColumn();
        } else {
            $filteredRecords = $totalRecords;
        }

        // Fetch all matching users
        $sql = "SELECT * FROM users {$whereClause} ORDER BY city ASC, {$sortColumn} {$sortOrder}";
        $stmt = $this->db->prepare($sql);
        foreach ($bindings as $param => $val) {
            $stmt->bindValue($param, $val);
        }
        $stmt->execute();
        $allRows = $stmt->fetchAll();

        // Group by city
        $groups = [];
        foreach ($allRows as $row) {
            $groups[$row['city']][] = $row;
        }

        // Sort rows within each group by the requested column
        $isAsc = $sortOrder === 'ASC';
        foreach ($groups as $city => &$cityUsers) {
            usort($cityUsers, function ($a, $b) use ($sortColumn, $isAsc) {
                $valA = $a[$sortColumn] ?? '';
                $valB = $b[$sortColumn] ?? '';

                if (is_numeric($valA) && is_numeric($valB)) {
                    $cmp = (float) $valA <=> (float) $valB;
                } else {
                    $cmp = strnatcasecmp((string) $valA, (string) $valB);
                }

                return $isAsc ? $cmp : -$cmp;
            });
        }
        unset($cityUsers);

        // Sort city groups by the first row's sort-column value
        uasort($groups, function ($groupA, $groupB) use ($sortColumn, $isAsc) {
            $valA = $groupA[0][$sortColumn] ?? '';
            $valB = $groupB[0][$sortColumn] ?? '';

            if (is_numeric($valA) && is_numeric($valB)) {
                $cmp = (float) $valA <=> (float) $valB;
            } else {
                $cmp = strnatcasecmp((string) $valA, (string) $valB);
            }

            return $isAsc ? $cmp : -$cmp;
        });

        // Build cell-metadata rows with rowspan + summary rows
        $mergedRows = [];
        foreach ($groups as $city => $cityUsers) {
            $count = count($cityUsers);

            foreach ($cityUsers as $index => $user) {
                $row = [];

                // City cell: rowspan on first row, skip on subsequent
                if ($index === 0) {
                    $rowspanAttr = ['value' => $city, 'class' => 'fw-bold align-middle'];
                    if ($count > 1) {
                        $rowspanAttr['rowspan'] = $count;
                    }
                    $row[] = $rowspanAttr;
                } else {
                    $row[] = ['skip' => true];
                }

                $row[] = ['value' => $user['name']];
                $row[] = ['value' => $user['email']];
                $row[] = ['value' => $user['mobile']];

                // Status with color
                $statusClass = $user['status'] === 'active' ? 'text-success' : 'text-danger';
                $statusLabel = ucfirst($user['status']);
                $row[] = ['value' => $statusLabel, 'class' => $statusClass];

                $row[] = ['value' => date('d M Y', strtotime($user['created_at']))];

                $mergedRows[] = $row;
            }

            // Summary row with colspan
            $mergedRows[] = [
                ['value' => "{$city} \u{2014} {$count} user(s)", 'colspan' => 6, 'class' => 'bg-light fw-semibold text-center small text-muted'],
            ];
        }

        // Paginate the merged rows
        $totalMergedRows = count($mergedRows);
        $totalPages      = $totalMergedRows > 0 ? (int) ceil($totalMergedRows / $perPage) : 0;
        $offset          = ($page - 1) * $perPage;
        $pagedRows       = array_slice($mergedRows, $offset, $perPage);

        return [
            'columns'          => ['City', 'Name', 'Email', 'Mobile', 'Status', 'Created At'],
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

    /**
     * Demo: hardcoded court schedule with complex rowspan + colspan.
     */
    public function getDemoMergedData(): array
    {
        return [
            'columns' => ['Time Slot', 'Court', 'Player', 'Match Type', 'Status'],
            'data'    => [
                // 9:00 AM block — 3 courts
                [
                    ['value' => '9:00 AM - 10:00 AM', 'rowspan' => 3, 'class' => 'fw-bold align-middle text-center'],
                    ['value' => 'Court A', 'class' => 'fw-semibold'],
                    ['value' => 'Raj Patel vs Amit Deshmukh'],
                    ['value' => 'Singles'],
                    ['value' => 'Confirmed', 'class' => 'text-success fw-semibold'],
                ],
                [
                    ['skip' => true],
                    ['value' => 'Court B', 'class' => 'fw-semibold'],
                    ['value' => 'Priya Sharma & Sneha K. vs Divya R. & Pooja S.'],
                    ['value' => 'Doubles'],
                    ['value' => 'Confirmed', 'class' => 'text-success fw-semibold'],
                ],
                [
                    ['skip' => true],
                    ['value' => 'Court C', 'class' => 'fw-semibold'],
                    ['value' => 'Rohit Gupta vs Karthik Rao'],
                    ['value' => 'Singles'],
                    ['value' => 'Pending', 'class' => 'text-warning fw-semibold'],
                ],

                // 10:00 AM block — Court A maintenance, Court B & C active
                [
                    ['value' => '10:00 AM - 11:00 AM', 'rowspan' => 3, 'class' => 'fw-bold align-middle text-center'],
                    ['value' => 'Court A — Maintenance', 'colspan' => 3, 'class' => 'text-center text-danger bg-danger bg-opacity-10'],
                    ['skip' => true],
                    ['skip' => true],
                    ['value' => 'Closed', 'class' => 'text-danger fw-semibold'],
                ],
                [
                    ['skip' => true],
                    ['value' => 'Court B', 'class' => 'fw-semibold'],
                    ['value' => 'Venkat Rao vs Suresh Reddy'],
                    ['value' => 'Singles'],
                    ['value' => 'Confirmed', 'class' => 'text-success fw-semibold'],
                ],
                [
                    ['skip' => true],
                    ['value' => 'Court C', 'class' => 'fw-semibold'],
                    ['value' => 'Sourav Das vs Aditya Sharma'],
                    ['value' => 'Singles'],
                    ['value' => 'Confirmed', 'class' => 'text-success fw-semibold'],
                ],

                // 11:00 AM block — tournament round
                [
                    ['value' => '11:00 AM - 12:00 PM', 'rowspan' => 2, 'class' => 'fw-bold align-middle text-center'],
                    ['value' => 'All Courts — Tournament Round 1', 'colspan' => 2, 'class' => 'text-center fw-semibold bg-primary bg-opacity-10'],
                    ['skip' => true],
                    ['value' => 'Tournament', 'class' => 'text-primary fw-semibold'],
                    ['value' => 'In Progress', 'class' => 'text-info fw-semibold'],
                ],
                [
                    ['skip' => true],
                    ['value' => 'Finals — Court A', 'colspan' => 2, 'class' => 'text-center fw-semibold'],
                    ['skip' => true],
                    ['value' => 'Championship'],
                    ['value' => 'Scheduled', 'class' => 'text-secondary fw-semibold'],
                ],
            ],
            'mode' => 'demo',
        ];
    }

    /**
     * Escape %, _ and \ for safe use in LIKE/ILIKE clauses.
     * PostgreSQL uses backslash as the default LIKE escape character.
     */
    private function escapeLikeWildcards(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
