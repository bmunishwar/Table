<?php

declare(strict_types=1);

class UserController
{
    private UserModel $model;

    private const ALLOWED_PER_PAGE = [5, 10, 25, 50, 100];

    public function __construct()
    {
        $this->model = new UserModel();
    }

    /**
     * Render the main HTML page.
     */
    public function index(): void
    {
        require BASE_PATH . '/views/users/index.php';
    }

    /**
     * AJAX endpoint: return paginated/sorted/filtered user data as JSON.
     */
    public function data(): void
    {
        try {
            $page       = max(1, (int) ($_GET['page'] ?? 1));
            $perPage    = (int) ($_GET['per_page'] ?? 10);
            $search     = trim((string) ($_GET['search'] ?? ''));
            $sortColumn = (string) ($_GET['sort_column'] ?? 'id');
            $sortOrder  = (string) ($_GET['sort_order'] ?? 'asc');
            $mode       = (string) ($_GET['mode'] ?? 'normal');

            if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
                $perPage = 10;
            }

            if ($mode === 'grouped') {
                $result = $this->model->getGroupedByCityData($page, $perPage, $search, $sortColumn, $sortOrder);
            } else {
                $result = $this->model->getUsers($page, $perPage, $search, $sortColumn, $sortOrder);
            }

            Response::json($result);
        } catch (\Throwable $e) {
            error_log('[UserController::data] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            Response::json([
                'error' => 'Unable to fetch data. Please try again later.',
                'data'  => [],
                'total_records'    => 0,
                'filtered_records' => 0,
                'current_page'     => 1,
                'per_page'         => 10,
                'total_pages'      => 0,
            ], 500);
        }
    }

    /**
     * AJAX endpoint: return demo merged-cell data (court schedule).
     */
    public function demoMerged(): void
    {
        try {
            $result = $this->model->getDemoMergedData();
            Response::json($result);
        } catch (\Throwable $e) {
            error_log('[UserController::demoMerged] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            Response::json([
                'error' => 'Unable to fetch demo data. Please try again later.',
            ], 500);
        }
    }
}
