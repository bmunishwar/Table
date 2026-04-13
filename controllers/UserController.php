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

            // Constrain per_page to allowed values
            if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
                $perPage = 10;
            }

            if ($mode === 'grouped') {
                $result = $this->model->getGroupedByCityData($page, $perPage, $search);
            } else {
                $result = $this->model->getUsers($page, $perPage, $search, $sortColumn, $sortOrder);
            }

            Response::json($result);
        } catch (\Throwable $e) {
            Response::json([
                'error'   => 'An error occurred while fetching data.',
                'message' => $e->getMessage(),
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
            Response::json([
                'error'   => 'An error occurred while fetching demo data.',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
