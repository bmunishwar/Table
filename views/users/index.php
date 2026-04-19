<?php
$widget = new DataTableWidget([
    'data_url'          => '/users/data',
    'export_url'        => '/users/export',
    'demo_url'          => '/users/demo-merged',
    'title'             => 'User Management',
    'subtitle'          => 'Manage and view all registered users with advanced filtering',
    'default_sort'      => 'id',
    'default_order'     => 'asc',
    'default_page_size' => 10,
    'show_mode_toggle'  => true,
    'show_export'       => true,
    'brand_name'        => 'DataTablePro',
]);
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management — DataTablePro</title>
<?= $widget->renderHeadAssets() ?>
</head>
<body>

<!-- ========== TOP NAVBAR ========== -->
<nav class="navbar navbar-expand-lg top-navbar sticky-top">
    <div class="container-fluid px-4">
        <a class="navbar-brand d-flex align-items-center gap-2" href="/">
            <div class="brand-icon">
                <i class="bi bi-grid-3x3-gap-fill"></i>
            </div>
            <span class="fw-700">DataTable<span class="text-primary">Pro</span></span>
        </a>
        <div class="d-flex align-items-center gap-3">
            <span class="badge bg-primary-subtle text-primary fw-500 px-3 py-2 rounded-pill">
                <i class="bi bi-lightning-charge-fill me-1"></i>PHP 8 MVC
            </span>
        </div>
    </div>
</nav>

<div class="main-content">
    <div class="container-fluid px-4 py-4">
<?= $widget->render() ?>
    </div>
</div>

<?= $widget->renderFooterAssets() ?>

</body>
</html>
