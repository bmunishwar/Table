<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management — Admin Panel</title>

    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Custom Styles -->
    <link href="/assets/css/style.css" rel="stylesheet">
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

        <!-- ========== PAGE HEADER ========== -->
        <div class="page-header mb-4">
            <div class="row align-items-center">
                <div class="col">
                    <div class="d-flex align-items-center gap-3 mb-1">
                        <h3 class="page-title mb-0">User Management</h3>
                        <span class="badge bg-primary-subtle text-primary rounded-pill fw-500" id="totalBadge"></span>
                    </div>
                    <p class="page-subtitle mb-0">Manage and view all registered users with advanced filtering</p>
                </div>
            </div>
        </div>

        <!-- ========== MAIN DATA TABLE CARD ========== -->
        <div class="table-card">

            <!-- Toolbar -->
            <div class="table-toolbar">
                <div class="row align-items-center g-3">
                    <!-- Left: Page size + Mode toggle -->
                    <div class="col-lg-7 d-flex align-items-center gap-3 flex-wrap">
                        <div class="d-flex align-items-center gap-2">
                            <span class="toolbar-label">Show</span>
                            <select id="pageSize" class="form-select form-select-sm custom-select">
                                <option value="5">5</option>
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span class="toolbar-label">entries</span>
                        </div>

                        <div class="mode-toggle" role="group">
                            <button type="button" class="mode-btn active" id="modeNormal">
                                <i class="bi bi-list-ul"></i>
                                <span>Normal</span>
                            </button>
                            <button type="button" class="mode-btn" id="modeGrouped">
                                <i class="bi bi-collection"></i>
                                <span>Grouped</span>
                            </button>
                        </div>
                    </div>

                    <!-- Right: Search -->
                    <div class="col-lg-5 d-flex justify-content-lg-end">
                        <div class="search-wrapper">
                            <i class="bi bi-search search-icon"></i>
                            <input type="text" id="searchInput" class="form-control search-input" placeholder="Search...">
                            <kbd class="search-shortcut d-none d-md-inline-flex">/</kbd>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table Container -->
            <div class="table-container">
                <!-- Loading Overlay -->
                <div id="loadingOverlay" class="loading-overlay d-none">
                    <div class="loading-content">
                        <div class="spinner-ring"></div>
                        <span class="loading-text">Loading data...</span>
                    </div>
                </div>

                <!-- Error Alert -->
                <div id="errorAlert" class="alert-custom d-none">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-exclamation-octagon-fill text-danger"></i>
                        <span id="errorMessage">An error occurred.</span>
                    </div>
                </div>

                <!-- Responsive Table -->
                <div class="table-responsive">
                    <table class="table modern-table" id="usersTable">
                        <thead id="tableHead"></thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Footer: Info + Pagination -->
            <div class="table-footer">
                <div class="row align-items-center">
                    <div class="col-md-5">
                        <span id="tableInfo" class="table-info-text"></span>
                    </div>
                    <div class="col-md-7 d-flex justify-content-md-end mt-2 mt-md-0">
                        <nav>
                            <ul class="pagination modern-pagination mb-0" id="pagination"></ul>
                        </nav>
                    </div>
                </div>
            </div>
        </div>

        <!-- ========== DEMO: MERGED CELLS (Court Schedule) ========== -->
        <div class="mt-5">
            <div class="d-flex align-items-center gap-3 mb-3">
                <h5 class="page-title mb-0" style="font-size:1.15rem">Court Schedule</h5>
                <span class="badge bg-warning-subtle text-warning rounded-pill fw-500">
                    <i class="bi bi-grid-3x3 me-1"></i>Rowspan / Colspan Demo
                </span>
            </div>

            <div class="table-card">
                <div class="table-container" style="min-height:auto">
                    <div id="demoLoading" class="loading-overlay d-none">
                        <div class="loading-content">
                            <div class="spinner-ring"></div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table modern-table" id="mergedTable">
                            <thead id="mergedTableHead"></thead>
                            <tbody id="mergedTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- jQuery -->
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
<!-- Bootstrap JS Bundle -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<!-- Custom JS -->
<script src="/assets/js/users.js"></script>

</body>
</html>
