<?php

declare(strict_types=1);

/**
 * Renders a drop-in DataTable widget for any existing PHP application.
 *
 * Usage in your view/template:
 *
 *   $widget = new DataTableWidget([
 *       'data_url'   => '/admin/products/data',
 *       'export_url' => '/admin/products/export',
 *       'title'      => 'Product Catalog',
 *   ]);
 *
 *   // In <head>:
 *   echo $widget->renderHeadAssets();
 *
 *   // In <body>:
 *   echo $widget->render();
 *
 *   // Before </body>:
 *   echo $widget->renderFooterAssets();
 */
class DataTableWidget
{
    private array $options;

    private static array $defaults = [
        'data_url'          => '',
        'export_url'        => '',
        'demo_url'          => '',
        'title'             => '',
        'subtitle'          => '',
        'default_sort'      => 'id',
        'default_order'     => 'asc',
        'default_page_size' => 10,
        'page_sizes'        => [5, 10, 25, 50, 100],
        'show_mode_toggle'  => true,
        'show_export'       => true,
        'show_dark_mode'    => true,
        'show_column_toggle' => true,
        'brand_name'        => 'DataTablePro',
        'css_path'          => '/assets/css/datatable.css',
        'js_path'           => '/assets/js/datatable.js',
    ];

    public function __construct(array $options)
    {
        $this->options = array_merge(self::$defaults, $options);
    }

    public function renderHeadAssets(): string
    {
        $css = $this->e($this->options['css_path']);

        return <<<HTML
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- DataTable Styles -->
    <link href="{$css}" rel="stylesheet">
HTML;
    }

    public function render(): string
    {
        $html = '';

        if ($this->options['title']) {
            $html .= $this->renderPageHeader();
        }

        $html .= '<div class="table-card">';
        $html .= $this->renderToolbar();
        $html .= $this->renderTableContainer();
        $html .= $this->renderFooter();
        $html .= '</div>';

        if ($this->options['demo_url']) {
            $html .= $this->renderDemoSection();
        }

        $html .= '<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastContainer" style="z-index:1090"></div>';

        return $html;
    }

    public function renderFooterAssets(): string
    {
        $jsPath    = $this->e($this->options['js_path']);
        $configJson = json_encode($this->buildJsConfig(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $html = <<<HTML
    <!-- jQuery -->
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
    <!-- Bootstrap JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
HTML;

        if ($this->options['show_export'] && $this->options['export_url']) {
            $html .= <<<HTML

    <!-- SheetJS for Excel/CSV export -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
    <!-- jsPDF for PDF export -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js"></script>
HTML;
        }

        $html .= <<<HTML

    <script>window.DataTableConfig = {$configJson};</script>
    <script src="{$jsPath}"></script>
HTML;

        return $html;
    }

    // ---- Private rendering helpers ----

    private function renderPageHeader(): string
    {
        $title    = $this->e($this->options['title']);
        $subtitle = $this->e($this->options['subtitle']);

        $html = <<<HTML
<div class="page-header mb-4">
    <div class="row align-items-center">
        <div class="col">
            <div class="d-flex align-items-center gap-3 mb-1">
                <h3 class="page-title mb-0">{$title}</h3>
                <span class="badge bg-primary-subtle text-primary rounded-pill fw-500" id="totalBadge"></span>
            </div>
HTML;

        if ($subtitle) {
            $html .= '            <p class="page-subtitle mb-0">' . $subtitle . '</p>' . "\n";
        }

        $html .= <<<HTML
        </div>
    </div>
</div>
HTML;

        return $html;
    }

    private function renderToolbar(): string
    {
        $pageSizeOptions = '';
        foreach ($this->options['page_sizes'] as $size) {
            $selected = ($size === $this->options['default_page_size']) ? ' selected' : '';
            $pageSizeOptions .= '<option value="' . $size . '"' . $selected . '>' . $size . '</option>';
        }

        $html = '<div class="table-toolbar"><div class="row align-items-center g-3">';
        $html .= '<div class="col-lg-7 d-flex align-items-center gap-3 flex-wrap">';

        $html .= <<<HTML
<div class="d-flex align-items-center gap-2">
    <span class="toolbar-label">Show</span>
    <select id="pageSize" class="form-select form-select-sm custom-select" aria-label="Rows per page">
        {$pageSizeOptions}
    </select>
    <span class="toolbar-label">entries</span>
</div>
HTML;

        if ($this->options['show_mode_toggle']) {
            $html .= <<<HTML

<div class="mode-toggle" role="group">
    <button type="button" class="mode-btn active" id="modeNormal">
        <i class="bi bi-list-ul"></i><span>Normal</span>
    </button>
    <button type="button" class="mode-btn" id="modeGrouped">
        <i class="bi bi-collection"></i><span>Grouped</span>
    </button>
</div>
HTML;
        }

        if ($this->options['show_export'] && $this->options['export_url']) {
            $html .= <<<HTML

<div class="dropdown">
    <button class="btn btn-sm btn-export dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="bi bi-download me-1"></i><span>Export</span>
    </button>
    <ul class="dropdown-menu dropdown-menu-end export-menu">
        <li><a class="dropdown-item" href="#" id="exportExcel"><i class="bi bi-file-earmark-spreadsheet text-success me-2"></i>Excel (.xlsx)</a></li>
        <li><a class="dropdown-item" href="#" id="exportPdf"><i class="bi bi-file-earmark-pdf text-danger me-2"></i>PDF</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="#" id="exportCsv"><i class="bi bi-filetype-csv text-primary me-2"></i>CSV</a></li>
    </ul>
</div>
HTML;
        }

        if ($this->options['show_column_toggle']) {
            $html .= <<<HTML

<div class="dropdown">
    <button class="btn btn-sm btn-export dropdown-toggle" type="button" id="columnToggleBtn"
            data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
        <i class="bi bi-layout-three-columns me-1"></i><span>Columns</span>
    </button>
    <ul class="dropdown-menu dropdown-menu-end export-menu" id="columnToggleMenu"></ul>
</div>
HTML;
        }

        $html .= '</div>';

        $html .= '<div class="col-lg-5 d-flex justify-content-lg-end align-items-center gap-2">';

        if ($this->options['show_dark_mode']) {
            $html .= <<<HTML
<button type="button" id="darkModeToggle" class="btn btn-sm btn-icon dark-mode-toggle"
        aria-label="Toggle dark mode" title="Toggle dark mode">
    <i class="bi bi-sun-fill"></i>
</button>
HTML;
        }

        $html .= <<<HTML
    <div class="search-wrapper">
        <i class="bi bi-search search-icon"></i>
        <input type="text" id="searchInput" class="form-control search-input" placeholder="Search..." aria-label="Search table">
        <button type="button" id="searchClear" class="search-clear d-none" title="Clear search">
            <i class="bi bi-x-lg"></i>
        </button>
        <kbd class="search-shortcut d-none d-md-inline-flex" id="searchShortcut">/</kbd>
    </div>
</div>
HTML;

        $html .= '</div></div>';
        return $html;
    }

    private function renderTableContainer(): string
    {
        return <<<HTML
<div class="table-container">
    <div id="loadingOverlay" class="loading-overlay d-none">
        <div class="loading-content">
            <div class="spinner-ring"></div>
            <span class="loading-text">Loading data...</span>
        </div>
    </div>
    <div id="errorAlert" class="alert-custom d-none">
        <div class="d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-octagon-fill text-danger"></i>
            <span id="errorMessage">An error occurred.</span>
        </div>
    </div>
    <div class="table-responsive">
        <table class="table modern-table" id="usersTable">
            <thead id="tableHead"></thead>
            <tbody id="tableBody"></tbody>
        </table>
    </div>
</div>
HTML;
    }

    private function renderFooter(): string
    {
        return <<<HTML
<div class="table-footer">
    <div class="row align-items-center">
        <div class="col-md-5">
            <span id="tableInfo" class="table-info-text" role="status" aria-live="polite"></span>
        </div>
        <div class="col-md-7 d-flex justify-content-md-end mt-2 mt-md-0">
            <nav aria-label="Table pagination">
                <ul class="pagination modern-pagination mb-0" id="pagination"></ul>
            </nav>
        </div>
    </div>
</div>
HTML;
    }

    private function renderDemoSection(): string
    {
        return <<<HTML

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
                <div class="loading-content"><div class="spinner-ring"></div></div>
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
HTML;
    }

    private function buildJsConfig(): array
    {
        return [
            'dataUrl'         => $this->options['data_url'],
            'exportUrl'       => $this->options['export_url'],
            'demoUrl'         => $this->options['demo_url'],
            'defaultSort'     => $this->options['default_sort'],
            'defaultOrder'    => $this->options['default_order'],
            'defaultPageSize' => $this->options['default_page_size'],
            'brandName'       => $this->options['brand_name'],
            'showModeToggle'  => $this->options['show_mode_toggle'],
            'showExport'      => $this->options['show_export'] && !empty($this->options['export_url']),
            'showDarkMode'    => $this->options['show_dark_mode'],
            'showColumnToggle' => $this->options['show_column_toggle'],
        ];
    }

    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
