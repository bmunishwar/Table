<?php

declare(strict_types=1);

class UserController
{
    public function index(): void
    {
        require BASE_PATH . '/views/users/index.php';
    }

    public function data(): void
    {
        DataTable::handleRequest(UserModel::tableConfig());
    }

    public function export(): void
    {
        DataTable::handleRequest(UserModel::tableConfig(), null, 'export');
    }

    public function demoMerged(): void
    {
        try {
            Response::json(UserModel::getDemoMergedData());
        } catch (\Throwable $e) {
            error_log('[UserController::demoMerged] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            Response::json(['error' => 'Unable to fetch demo data.'], 500);
        }
    }
}
