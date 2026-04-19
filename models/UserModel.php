<?php

declare(strict_types=1);

class UserModel
{
    public static function tableConfig(): array
    {
        return [
            'table'        => 'users',
            'primary_key'  => 'id',
            'columns'      => [
                ['key' => 'id',         'label' => 'ID',         'sortable' => true,  'searchable' => false, 'type' => 'id'],
                ['key' => 'name',       'label' => 'Name',       'sortable' => true,  'searchable' => true,  'type' => 'name'],
                ['key' => 'email',      'label' => 'Email',      'sortable' => true,  'searchable' => true,  'type' => 'email'],
                ['key' => 'mobile',     'label' => 'Mobile',     'sortable' => true,  'searchable' => true],
                ['key' => 'city',       'label' => 'City',       'sortable' => true,  'searchable' => true],
                ['key' => 'status',     'label' => 'Status',     'sortable' => true,  'searchable' => false, 'type' => 'status'],
                ['key' => 'created_at', 'label' => 'Created At', 'sortable' => true,  'searchable' => false, 'type' => 'date'],
            ],
            'default_sort'  => 'id',
            'default_order' => 'asc',
            'has_actions'   => true,
            'group_by'      => 'city',
            'group_label'   => 'City',
            'formatters'    => [
                'status'     => fn($val) => ucfirst((string) $val),
                'created_at' => fn($val) => $val ? date('d M Y', strtotime((string) $val)) : '',
            ],
        ];
    }

    public static function getDemoMergedData(): array
    {
        return [
            'columns' => ['Time Slot', 'Court', 'Player', 'Match Type', 'Status'],
            'data'    => [
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
}
