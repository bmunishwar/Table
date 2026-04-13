<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management — Admin Panel</title>

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Custom Styles -->
    <link href="/assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-light">

<div class="container-fluid px-4 py-4">

    <!-- ========== PAGE HEADER ========== -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 fw-semibold text-dark">
            <i class="bi bi-people me-2"></i>User Management
        </h4>
    </div>

    <!-- ========== MAIN DATA TABLE ========== -->
    <div class="card shadow-sm border-0">

        <!-- Card Header: Controls -->
        <div class="card-header bg-white border-bottom py-3">
            <div class="row align-items-center g-2">
                <!-- Left: Page size + Mode toggle -->
                <div class="col-md-6 d-flex align-items-center gap-3 flex-wrap">
                    <div class="d-flex align-items-center gap-2">
                        <label for="pageSize" class="form-label mb-0 text-muted small">Show</label>
                        <select id="pageSize" class="form-select form-select-sm" style="width:75px">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                        <span class="text-muted small">entries</span>
                    </div>

                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-secondary active" id="modeNormal">
                            <i class="bi bi-table me-1"></i>Normal
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="modeGrouped">
                            <i class="bi bi-layout-three-columns me-1"></i>Grouped
                        </button>
                    </div>
                </div>

                <!-- Right: Search -->
                <div class="col-md-6 d-flex justify-content-md-end">
                    <div class="input-group input-group-sm" style="max-width:280px">
                        <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search users...">
                    </div>
                </div>
            </div>
        </div>

        <!-- Card Body: Table -->
        <div class="card-body p-0 position-relative">
            <!-- Loading Overlay -->
            <div id="loadingOverlay" class="loading-overlay d-none">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <!-- Error Alert -->
            <div id="errorAlert" class="alert alert-danger m-3 d-none" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <span id="errorMessage">An error occurred.</span>
            </div>

            <!-- Responsive Table -->
            <div class="table-responsive">
                <table class="table table-hover table-bordered align-middle mb-0" id="usersTable">
                    <thead class="table-dark" id="tableHead">
                        <tr>
                            <th data-sort="id" class="sortable">ID <span class="sort-icon"></span></th>
                            <th data-sort="name" class="sortable">Name <span class="sort-icon"></span></th>
                            <th data-sort="email" class="sortable">Email <span class="sort-icon"></span></th>
                            <th data-sort="mobile" class="sortable">Mobile <span class="sort-icon"></span></th>
                            <th data-sort="city" class="sortable">City <span class="sort-icon"></span></th>
                            <th data-sort="status" class="sortable">Status <span class="sort-icon"></span></th>
                            <th data-sort="created_at" class="sortable">Created <span class="sort-icon"></span></th>
                            <th class="text-center" style="width:140px">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="tableBody">
                        <!-- Populated by AJAX -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Card Footer: Info + Pagination -->
        <div class="card-footer bg-white border-top py-3">
            <div class="row align-items-center">
                <div class="col-md-6">
                    <span id="tableInfo" class="text-muted small"></span>
                </div>
                <div class="col-md-6 d-flex justify-content-md-end mt-2 mt-md-0">
                    <nav>
                        <ul class="pagination pagination-sm mb-0" id="pagination"></ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <!-- ========== DEMO: MERGED CELLS (Court Schedule) ========== -->
    <div class="mt-5">
        <h5 class="fw-semibold text-dark mb-3">
            <i class="bi bi-grid-3x3 me-2"></i>Court Schedule — Rowspan/Colspan Demo
        </h5>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0 position-relative">
                <div id="demoLoading" class="loading-overlay d-none">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered align-middle mb-0" id="mergedTable">
                        <thead class="table-dark" id="mergedTableHead"></thead>
                        <tbody id="mergedTableBody"></tbody>
                    </table>
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
