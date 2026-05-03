/**
 * DataTablePro — Configurable Frontend Controller
 *
 * Reads configuration from window.DataTableConfig:
 *   {
 *     dataUrl:         '/your/data/endpoint',
 *     exportUrl:       '/your/export/endpoint',   // optional
 *     demoUrl:         '/your/demo/endpoint',      // optional
 *     defaultSort:     'id',
 *     defaultOrder:    'asc',
 *     defaultPageSize: 10,
 *     brandName:       'DataTablePro',
 *     showModeToggle:  true,
 *     showExport:      true
 *   }
 */
(function ($) {
    'use strict';

    var config = window.DataTableConfig || {};
    var dataUrl       = config.dataUrl || '/data';
    var exportUrl     = config.exportUrl || '';
    var demoUrl       = config.demoUrl || '';
    var brandName     = config.brandName || 'DataTablePro';
    var defaultSort   = config.defaultSort || 'id';
    var defaultOrder  = config.defaultOrder || 'asc';
    var defaultSize   = config.defaultPageSize || 10;

    // ---- State ----
    var currentPage    = 1;
    var perPage        = defaultSize;
    var searchTerm     = '';
    var sortColumn     = defaultSort;
    var sortDirection  = defaultOrder;
    var currentMode    = 'normal';
    var currentColCount = 8;
    var debounceTimer  = null;
    var filterTimer    = null;
    var activeXhr      = null;
    var columnDefs     = [];
    var primaryKey     = null;
    var hasActions     = false;
    var columnFilters  = {};
    var isInitialLoad  = true;
    var actionDefs     = [];
    var lastFetchedRows = [];
    var selectedIds    = {};
    var updatingHash   = false;
    var hiddenColumns  = (function () {
        try { return JSON.parse(localStorage.getItem('dtpro-hidden-cols')) || {}; } catch (e) { return {}; }
    })();

    // ---- Dark Mode (immediate to prevent FOUC) ----
    function initDarkMode() {
        var stored = localStorage.getItem('dtpro-theme');
        var theme;
        if (stored) {
            theme = stored;
        } else {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        applyTheme(theme);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        var icon = document.querySelector('#darkModeToggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
        }
        try { localStorage.setItem('dtpro-theme', theme); } catch (e) {}
    }

    if (config.showDarkMode !== false) {
        initDarkMode();
    }

    // ---- Helpers ----

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var s = String(str);
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return s.replace(/[&<>"']/g, function (c) { return map[c]; });
    }

    function highlightMatch(escapedStr, rawSearchTerm) {
        if (!rawSearchTerm || !escapedStr) return escapedStr;
        var escapedTerm = escapeHtml(rawSearchTerm);
        var safeRegex = escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex = new RegExp('(' + safeRegex + ')', 'gi');
        return escapedStr.replace(regex, '<mark>$1</mark>');
    }

    function emptyStateHtml(icon, text) {
        return '<tr class="no-data-row"><td colspan="' + currentColCount + '" class="text-center">' +
               '<div class="empty-state">' +
               '<i class="bi bi-' + icon + ' empty-state-icon"></i>' +
               '<span class="empty-state-text">' + escapeHtml(text) + '</span>' +
               '</div></td></tr>';
    }

    function getTimestamp() {
        var d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + '_' +
            String(d.getHours()).padStart(2, '0') +
            String(d.getMinutes()).padStart(2, '0') +
            String(d.getSeconds()).padStart(2, '0');
    }

    function renderSkeletonRows(colCount) {
        var widths = ['skeleton-cell--wide', 'skeleton-cell--med', 'skeleton-cell--short'];
        var html = '';
        for (var r = 0; r < 8; r++) {
            html += '<tr class="skeleton-row">';
            for (var c = 0; c < colCount; c++) {
                var w = widths[(r + c) % 3];
                html += '<td><div class="skeleton-cell ' + w + '"></div></td>';
            }
            html += '</tr>';
        }
        return html;
    }

    // ---- URL State Management ----

    function getActiveFilters() {
        var active = {};
        for (var key in columnFilters) {
            if (columnFilters[key]) active[key] = columnFilters[key];
        }
        return active;
    }

    function hasActiveFilters() {
        for (var key in columnFilters) {
            var v = columnFilters[key];
            if (v && (typeof v === 'string' || (typeof v === 'object' && Object.keys(v).length > 0))) return true;
        }
        return false;
    }

    function saveStateToUrl() {
        updatingHash = true;
        var params = new URLSearchParams();
        if (currentPage > 1)                params.set('page', currentPage);
        if (searchTerm)                     params.set('search', searchTerm);
        if (sortColumn !== defaultSort)     params.set('sort', sortColumn);
        if (sortDirection !== defaultOrder) params.set('order', sortDirection);
        if (currentMode !== 'normal')       params.set('mode', currentMode);
        if (perPage !== defaultSize)        params.set('per_page', perPage);

        var active = getActiveFilters();
        if (Object.keys(active).length > 0) {
            params.set('filters', JSON.stringify(active));
        }

        var hash = params.toString();
        history.replaceState(null, '', hash ? '#' + hash : window.location.pathname);
        setTimeout(function () { updatingHash = false; }, 0);
    }

    function loadStateFromUrl() {
        var hash = window.location.hash.substring(1);
        if (!hash) return;

        var params = new URLSearchParams(hash);

        if (params.has('page'))     currentPage   = Math.max(1, parseInt(params.get('page'), 10) || 1);
        if (params.has('sort'))     sortColumn    = params.get('sort');
        if (params.has('order'))    sortDirection  = params.get('order') === 'desc' ? 'desc' : 'asc';
        if (params.has('per_page')) perPage        = parseInt(params.get('per_page'), 10) || defaultSize;

        if (params.has('search')) {
            searchTerm = params.get('search');
            $('#searchInput').val(searchTerm);
        }

        if (params.has('mode')) {
            currentMode = params.get('mode') === 'grouped' ? 'grouped' : 'normal';
            if (currentMode === 'grouped') {
                $('#modeGrouped').addClass('active');
                $('#modeNormal').removeClass('active');
            }
        }

        if (params.has('filters')) {
            try {
                var parsed = JSON.parse(params.get('filters'));
                if (parsed && typeof parsed === 'object') {
                    columnFilters = parsed;
                }
            } catch (e) {}
        }

        $('#pageSize').val(perPage);
    }

    // ---- Column Type Renderers ----

    function renderCellByType(value, type, highlightTerms) {
        if (value === null || value === undefined) value = '';
        var escaped = escapeHtml(value);
        var highlighted = escaped;

        if (highlightTerms && highlightTerms.length > 0) {
            for (var h = 0; h < highlightTerms.length; h++) {
                if (highlightTerms[h]) {
                    highlighted = highlightMatch(highlighted, highlightTerms[h]);
                }
            }
        }

        switch (type) {
            case 'id':
                return '<span class="cell-id">#' + highlighted + '</span>';

            case 'name':
                return '<span class="cell-name">' + highlighted + '</span>';

            case 'email':
                return '<a href="mailto:' + escaped + '" class="cell-email">' + highlighted + '</a>';

            case 'status':
                var lower = String(value).toLowerCase();
                var cls = 'status-default';
                if (lower === 'active' || lower === 'enabled' || lower === 'online' || lower === 'confirmed') {
                    cls = 'status-active';
                } else if (lower === 'inactive' || lower === 'disabled' || lower === 'offline') {
                    cls = 'status-inactive';
                } else if (lower === 'pending' || lower === 'waiting' || lower === 'draft') {
                    cls = 'status-pending';
                }
                return '<span class="status-badge ' + cls + '"><span class="status-dot"></span>' + highlighted + '</span>';

            case 'date':
                return '<span class="cell-date">' + highlighted + '</span>';

            default:
                return highlighted;
        }
    }

    // ---- Shared Cell Renderer for Merged/Grouped Rows ----

    function renderMergedRows(rows) {
        if (!rows || rows.length === 0) return '';

        var html = '';
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (!Array.isArray(row)) continue;

            var isSummary = (row.length === 1 && row[0] && row[0].colspan);
            html += isSummary ? '<tr class="summary-row">' : '<tr>';

            for (var c = 0; c < row.length; c++) {
                var cell = row[c];
                if (!cell || cell.skip === true) continue;

                var attrs = '';
                if (cell.rowspan && cell.rowspan > 1) {
                    attrs += ' rowspan="' + parseInt(cell.rowspan, 10) + '"';
                }
                if (cell.colspan && cell.colspan > 1) {
                    attrs += ' colspan="' + parseInt(cell.colspan, 10) + '"';
                }
                if (cell['class']) {
                    attrs += ' class="' + escapeHtml(cell['class']) + '"';
                }

                var content = cell.html === true ? (cell.value || '') : escapeHtml(cell.value);
                html += '<td' + attrs + '>' + content + '</td>';
            }

            html += '</tr>';
        }
        return html;
    }

    // ---- Data Fetching ----

    function fetchData() {
        if (activeXhr && activeXhr.readyState !== 4) {
            activeXhr.abort();
        }

        showLoading(true);
        hideError();
        saveStateToUrl();

        var reqData = {
            page: currentPage,
            per_page: perPage,
            search: searchTerm,
            sort_column: sortColumn,
            sort_order: sortDirection,
            mode: currentMode
        };

        var active = getActiveFilters();
        if (Object.keys(active).length > 0) {
            reqData.filters = active;
        }

        activeXhr = $.ajax({
            url: dataUrl,
            method: 'GET',
            dataType: 'json',
            timeout: 30000,
            data: reqData,
            success: function (response) {
                if (response.error) {
                    showError(response.error);
                    renderPagination(response);
                    renderInfo(response);
                    return;
                }

                if (response.columns) columnDefs = response.columns;
                primaryKey = response.primary_key || null;
                hasActions = !!response.has_actions;
                if (response.actions && response.actions.length > 0) actionDefs = response.actions;
                lastFetchedRows = response.data || [];

                if (response.total_pages && currentPage > response.total_pages && response.total_pages > 0) {
                    currentPage = response.total_pages;
                    fetchData();
                    return;
                }

                if (response.mode === 'grouped') {
                    currentColCount = columnDefs.length || 6;
                    renderGroupedHeaders(columnDefs);
                    renderGroupedBody(response.data);
                } else {
                    currentColCount = (primaryKey ? 1 : 0) + columnDefs.length + (hasActions ? 1 : 0);
                    renderNormalHeaders(columnDefs);
                    renderNormalBody(response.data);
                }

                renderPagination(response);
                renderInfo(response);
                updateSearchClear();
                resetSelection();
            },
            error: function (xhr, status) {
                if (status === 'abort') return;

                var msg = 'Failed to load data. Please try again.';
                if (status === 'timeout') {
                    msg = 'Request timed out. Please check your connection and try again.';
                } else {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp && resp.error) msg = resp.error;
                    } catch (e) {}
                }

                showError(msg);
                $('#tableBody').html(emptyStateHtml('exclamation-circle', 'Error loading data'));
                $('#pagination').empty();
                $('#tableInfo').text('');
                $('#totalBadge').text('');
            },
            complete: function (xhr, status) {
                if (status !== 'abort') showLoading(false);
            }
        });
    }

    function fetchDemoMerged() {
        if (!demoUrl) return;

        $('#demoLoading').removeClass('d-none');

        $.ajax({
            url: demoUrl,
            method: 'GET',
            dataType: 'json',
            timeout: 30000,
            success: function (response) {
                if (response.error) {
                    var cols = (response.columns && response.columns.length) || 5;
                    $('#mergedTableBody').html(
                        '<tr><td colspan="' + cols + '" class="text-center text-muted py-4">' + escapeHtml(response.error) + '</td></tr>'
                    );
                    return;
                }
                renderDemoMergedTable(response);
            },
            error: function () {
                $('#mergedTableBody').html(
                    '<tr><td colspan="5" class="text-center text-muted py-4">' +
                    '<div class="empty-state">' +
                    '<i class="bi bi-exclamation-circle empty-state-icon"></i>' +
                    '<span class="empty-state-text">Failed to load demo data</span>' +
                    '</div></td></tr>'
                );
            },
            complete: function () {
                $('#demoLoading').addClass('d-none');
            }
        });
    }

    // ---- Column Filter Helpers ----

    function buildFilterRow(cols, showActionCol) {
        var html = '<tr class="filter-row">';
        if (primaryKey && currentMode === 'normal') {
            html += '<th class="col-checkbox"></th>';
        }
        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.filterable !== false) {
                if (col.filter_options && col.filter_options.length > 0) {
                    var selVal = columnFilters[col.key] || '';
                    html += '<th data-col="' + escapeHtml(col.key) + '"><select class="column-filter-select" data-column="' + escapeHtml(col.key) + '"' +
                        ' aria-label="Filter by ' + escapeHtml(col.label) + '">' +
                        '<option value="">All</option>';
                    for (var o = 0; o < col.filter_options.length; o++) {
                        var opt = col.filter_options[o];
                        var optSelected = selVal === opt ? ' selected' : '';
                        html += '<option value="' + escapeHtml(opt) + '"' + optSelected + '>' + escapeHtml(opt) + '</option>';
                    }
                    html += '</select></th>';
                } else if (col.type === 'date') {
                    var dateVal = columnFilters[col.key];
                    var fromVal = '', toVal = '';
                    if (dateVal && typeof dateVal === 'object') { fromVal = dateVal.from || ''; toVal = dateVal.to || ''; }
                    html += '<th data-col="' + escapeHtml(col.key) + '"><div class="column-filter-date-wrap">' +
                        '<input type="date" class="column-filter-date" data-column="' + escapeHtml(col.key) + '" data-range="from"' +
                        ' value="' + escapeHtml(fromVal) + '" title="From" aria-label="Filter ' + escapeHtml(col.label) + ' from">' +
                        '<input type="date" class="column-filter-date" data-column="' + escapeHtml(col.key) + '" data-range="to"' +
                        ' value="' + escapeHtml(toVal) + '" title="To" aria-label="Filter ' + escapeHtml(col.label) + ' to">' +
                        '</div></th>';
                } else {
                    var val = columnFilters[col.key] || '';
                    html += '<th data-col="' + escapeHtml(col.key) + '"><div class="column-filter-wrap">' +
                        '<input type="text" class="column-filter" data-column="' + escapeHtml(col.key) + '"' +
                        ' placeholder="' + escapeHtml(col.label) + '..." value="' + escapeHtml(val) + '"' +
                        ' aria-label="Filter by ' + escapeHtml(col.label) + '">' +
                        '<button type="button" class="column-filter-clear' + (val ? '' : ' d-none') + '" data-column="' + escapeHtml(col.key) + '" title="Clear">' +
                        '<i class="bi bi-x"></i></button>' +
                        '</div></th>';
                }
            } else {
                html += '<th data-col="' + escapeHtml(col.key) + '"></th>';
            }
        }
        if (showActionCol) {
            var hasAny = hasActiveFilters();
            html += '<th class="text-center">';
            if (hasAny) {
                html += '<button type="button" class="btn-clear-all-filters" title="Clear all filters">' +
                    '<i class="bi bi-x-circle me-1"></i>Clear</button>';
            }
            html += '</th>';
        }
        html += '</tr>';
        return html;
    }

    function restoreFilterValues() {
        $('#tableHead .column-filter').each(function () {
            var key = $(this).data('column');
            if (columnFilters[key] && typeof columnFilters[key] === 'string') {
                $(this).val(columnFilters[key]);
                $(this).siblings('.column-filter-clear').removeClass('d-none');
            }
        });
        $('#tableHead .column-filter-select').each(function () {
            var key = $(this).data('column');
            if (columnFilters[key]) $(this).val(columnFilters[key]);
        });
        $('#tableHead .column-filter-date').each(function () {
            var key = $(this).data('column');
            var range = $(this).data('range');
            if (columnFilters[key] && typeof columnFilters[key] === 'object') {
                $(this).val(columnFilters[key][range] || '');
            }
        });
    }

    function buildColumnToggleMenu() {
        var $menu = $('#columnToggleMenu');
        if (!$menu.length || !columnDefs.length) return;
        var html = '';
        for (var i = 0; i < columnDefs.length; i++) {
            var col = columnDefs[i];
            var checked = !hiddenColumns[col.key] ? ' checked' : '';
            html += '<li><label class="dropdown-item d-flex align-items-center gap-2">' +
                '<input type="checkbox" class="form-check-input col-toggle-check" data-col-key="' + escapeHtml(col.key) + '"' + checked + '>' +
                escapeHtml(col.label) + '</label></li>';
        }
        $menu.html(html);
    }

    function applyColumnVisibility() {
        for (var i = 0; i < columnDefs.length; i++) {
            var key = columnDefs[i].key;
            var sel = '[data-col="' + key + '"]';
            if (hiddenColumns[key]) {
                $(sel).addClass('d-none');
            } else {
                $(sel).removeClass('d-none');
            }
        }
    }

    function saveHiddenColumns() {
        try { localStorage.setItem('dtpro-hidden-cols', JSON.stringify(hiddenColumns)); } catch (e) {}
    }

    function bindFilterEvents() {
        $('#tableHead').off('input', '.column-filter').on('input', '.column-filter', function () {
            var $input = $(this);
            var col = $input.data('column');
            clearTimeout(filterTimer);
            filterTimer = setTimeout(function () {
                var val = $input.val().trim();
                if (val) {
                    columnFilters[col] = val;
                    $input.siblings('.column-filter-clear').removeClass('d-none');
                } else {
                    delete columnFilters[col];
                    $input.siblings('.column-filter-clear').addClass('d-none');
                }
                currentPage = 1;
                fetchData();
            }, 400);
        });

        $('#tableHead').off('click', '.column-filter-clear').on('click', '.column-filter-clear', function () {
            var col = $(this).data('column');
            delete columnFilters[col];
            $(this).addClass('d-none');
            $(this).siblings('.column-filter').val('').focus();
            currentPage = 1;
            fetchData();
        });

        $('#tableHead').off('change', '.column-filter-select').on('change', '.column-filter-select', function () {
            var col = $(this).data('column');
            var val = $(this).val();
            if (val) { columnFilters[col] = val; } else { delete columnFilters[col]; }
            currentPage = 1;
            fetchData();
        });

        $('#tableHead').off('change', '.column-filter-date').on('change', '.column-filter-date', function () {
            var col = $(this).data('column');
            var range = $(this).data('range');
            var current = columnFilters[col];
            if (!current || typeof current !== 'object') current = {};
            var val = $(this).val();
            if (val) { current[range] = val; } else { delete current[range]; }
            if (Object.keys(current).length > 0) { columnFilters[col] = current; } else { delete columnFilters[col]; }
            currentPage = 1;
            fetchData();
        });

        $('#tableHead').off('click', '.btn-clear-all-filters').on('click', '.btn-clear-all-filters', function () {
            columnFilters = {};
            $('#tableHead .column-filter').val('');
            $('#tableHead .column-filter-clear').addClass('d-none');
            $('#tableHead .column-filter-select').val('');
            $('#tableHead .column-filter-date').val('');
            $(this).remove();
            currentPage = 1;
            fetchData();
        });

        $('#tableHead').off('keydown', '.column-filter').on('keydown', '.column-filter', function (e) {
            if (e.key === 'Escape') {
                $(this).val('').trigger('input');
                $(this).blur();
            }
            if (e.key === 'Enter') {
                clearTimeout(filterTimer);
                var val = $(this).val().trim();
                var col = $(this).data('column');
                if (val) { columnFilters[col] = val; } else { delete columnFilters[col]; }
                currentPage = 1;
                fetchData();
            }
        });
    }

    // ---- Normal Mode Rendering (type-driven) ----

    function renderNormalHeaders(cols) {
        if (!cols || cols.length === 0) return;

        var html = '<tr>';
        if (primaryKey) {
            html += '<th scope="col" class="col-checkbox"><input type="checkbox" class="form-check-input" id="selectAll" aria-label="Select all rows"></th>';
        }
        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.sortable) {
                var ariaSort = 'none';
                if (sortColumn === col.key) {
                    ariaSort = sortDirection === 'asc' ? 'ascending' : 'descending';
                }
                html += '<th scope="col" data-sort="' + escapeHtml(col.key) + '" data-col="' + escapeHtml(col.key) + '" class="sortable" aria-sort="' + ariaSort + '">' +
                        escapeHtml(col.label) + ' <span class="sort-icon"></span></th>';
            } else {
                html += '<th scope="col" data-col="' + escapeHtml(col.key) + '">' + escapeHtml(col.label) + '</th>';
            }
        }
        if (hasActions) {
            html += '<th scope="col" class="text-center" style="width:130px">Actions</th>';
        }
        html += '</tr>';

        html += buildFilterRow(cols, hasActions);

        $('#tableHead').html(html);
        restoreFilterValues();
        updateSortIndicators();
        bindSortEvents();
        bindFilterEvents();
        buildColumnToggleMenu();
        applyColumnVisibility();
    }

    function renderNormalBody(rows) {
        var tbody = $('#tableBody');
        tbody.empty();

        if (!rows || rows.length === 0) {
            tbody.html(emptyStateHtml('inbox', 'No records found'));
            return;
        }

        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            html += '<tr class="fade-in">';

            if (primaryKey) {
                var rowId = escapeHtml(row[primaryKey]);
                var chk = selectedIds[row[primaryKey]] ? ' checked' : '';
                html += '<td class="col-checkbox"><input type="checkbox" class="form-check-input row-select" data-id="' + rowId + '"' + chk + ' aria-label="Select row ' + rowId + '"></td>';
            }

            for (var c = 0; c < columnDefs.length; c++) {
                var col = columnDefs[c];
                var terms = [];
                if (col.type !== 'status' && col.type !== 'date') {
                    if (searchTerm && col.searchable !== false) terms.push(searchTerm);
                    if (columnFilters[col.key] && typeof columnFilters[col.key] === 'string' && columnFilters[col.key].charAt(0) !== '{') {
                        terms.push(columnFilters[col.key]);
                    }
                }
                html += '<td data-col="' + escapeHtml(col.key) + '">' + renderCellByType(row[col.key], col.type, terms) + '</td>';
            }

            if (hasActions && primaryKey) {
                var pkVal = escapeHtml(row[primaryKey]);
                html += '<td class="text-center action-btns">';
                if (actionDefs.length > 0) {
                    for (var a = 0; a < actionDefs.length; a++) {
                        var act = actionDefs[a];
                        html += '<button class="action-btn ' + escapeHtml(act['class'] || '') + '" data-action="' + escapeHtml(act.key) + '" data-id="' + pkVal + '"' +
                            ' title="' + escapeHtml(act.label) + '" aria-label="' + escapeHtml(act.label) + ' record #' + pkVal + '">' +
                            '<i class="bi ' + escapeHtml(act.icon) + '"></i></button>';
                    }
                } else {
                    html += '<button class="action-btn btn-view" data-action="view" data-id="' + pkVal + '" title="View" aria-label="View record #' + pkVal + '">' +
                            '<i class="bi bi-eye"></i></button>' +
                        '<button class="action-btn btn-edit" data-action="edit" data-id="' + pkVal + '" title="Edit" aria-label="Edit record #' + pkVal + '">' +
                            '<i class="bi bi-pencil"></i></button>' +
                        '<button class="action-btn btn-delete" data-action="delete" data-id="' + pkVal + '" title="Delete" aria-label="Delete record #' + pkVal + '">' +
                            '<i class="bi bi-trash3"></i></button>';
                }
                html += '</td>';
            }

            html += '</tr>';
        }

        tbody.html(html);
        applyColumnVisibility();
    }

    // ---- Grouped Mode ----

    function renderGroupedHeaders(cols) {
        if (!cols || cols.length === 0) return;

        var html = '<tr>';
        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.sortable) {
                var ariaSort = 'none';
                if (sortColumn === col.key) {
                    ariaSort = sortDirection === 'asc' ? 'ascending' : 'descending';
                }
                html += '<th scope="col" data-sort="' + escapeHtml(col.key) + '" class="sortable" aria-sort="' + ariaSort + '">' +
                        escapeHtml(col.label) + ' <span class="sort-icon"></span></th>';
            } else {
                html += '<th scope="col">' + escapeHtml(col.label) + '</th>';
            }
        }
        html += '</tr>';

        html += buildFilterRow(cols, false);

        $('#tableHead').html(html);
        restoreFilterValues();
        updateSortIndicators();
        bindSortEvents();
        bindFilterEvents();
    }

    function renderGroupedBody(rows) {
        var tbody = $('#tableBody');
        tbody.empty();

        if (!rows || rows.length === 0) {
            tbody.html(emptyStateHtml('inbox', 'No records found'));
            return;
        }

        tbody.html(renderMergedRows(rows));
    }

    // ---- Demo Merged Table ----

    function renderDemoMergedTable(data) {
        var thead = $('#mergedTableHead');
        var headHtml = '<tr>';
        if (data.columns) {
            for (var i = 0; i < data.columns.length; i++) {
                headHtml += '<th>' + escapeHtml(data.columns[i]) + '</th>';
            }
        }
        headHtml += '</tr>';
        thead.html(headHtml);

        var tbody = $('#mergedTableBody');
        if (!data.data || data.data.length === 0) {
            var cols = (data.columns && data.columns.length) || 5;
            tbody.html('<tr><td colspan="' + cols + '" class="text-center text-muted py-4">No demo data</td></tr>');
            return;
        }

        tbody.html(renderMergedRows(data.data));
    }

    // ---- Pagination ----

    function renderPagination(response) {
        var pagination = $('#pagination');
        pagination.empty();

        var total   = response.total_pages || 0;
        var current = response.current_page || 1;

        if (total <= 1) return;

        var html = '';

        html += '<li class="page-item ' + (current === 1 ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (current - 1) + '" aria-label="Go to previous page">&laquo;</a></li>';

        var pages = generatePageNumbers(current, total);
        for (var i = 0; i < pages.length; i++) {
            var p = pages[i];
            if (p === '...') {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            } else {
                var isActive = p === current;
                html += '<li class="page-item ' + (isActive ? 'active' : '') + '">' +
                        '<a class="page-link" href="#" data-page="' + p + '" aria-label="Go to page ' + p + '"' +
                        (isActive ? ' aria-current="page"' : '') + '>' + p + '</a></li>';
            }
        }

        html += '<li class="page-item ' + (current === total ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (current + 1) + '" aria-label="Go to next page">&raquo;</a></li>';

        pagination.html(html);
    }

    function generatePageNumbers(current, total) {
        var pages = [];
        var delta = 2;

        var rangeStart = Math.max(2, current - delta);
        var rangeEnd   = Math.min(total - 1, current + delta);

        pages.push(1);

        if (rangeStart > 2) {
            pages.push('...');
        }

        for (var i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }

        if (rangeEnd < total - 1) {
            pages.push('...');
        }

        if (total > 1) {
            pages.push(total);
        }

        return pages;
    }

    // ---- Info Text ----

    function renderInfo(response) {
        var total    = response.filtered_records || 0;
        var allTotal = response.total_records || 0;
        var current  = response.current_page || 1;
        var pp       = response.per_page || 10;

        $('#totalBadge').text(allTotal + ' records');

        if (total === 0) {
            $('#tableInfo').text('No entries to show');
            return;
        }

        var start = (current - 1) * pp + 1;
        var end   = Math.min(current * pp, total);

        var text = 'Showing ' + start + ' to ' + end + ' of ' + total + ' entries';
        if (total !== allTotal) {
            text += ' (filtered from ' + allTotal + ' total)';
        }

        $('#tableInfo').text(text);
    }

    // ---- Sort Indicators ----

    function updateSortIndicators() {
        $('#tableHead .sortable').removeClass('sort-asc sort-desc').attr('aria-sort', 'none');
        $('#tableHead .sortable[data-sort="' + sortColumn + '"]')
            .addClass(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc')
            .attr('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
    }

    function bindSortEvents() {
        $('#tableHead').off('click', '.sortable').on('click', '.sortable', function () {
            var col = $(this).data('sort');
            if (!col) return;

            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn    = col;
                sortDirection = 'asc';
            }

            currentPage = 1;
            updateSortIndicators();
            fetchData();
        });
    }

    // ---- Search Clear ----

    function updateSearchClear() {
        if (searchTerm) {
            $('#searchClear').removeClass('d-none');
            $('#searchShortcut').addClass('d-none');
        } else {
            $('#searchClear').addClass('d-none');
            $('#searchShortcut').removeClass('d-none');
        }
    }

    // ---- UI Helpers ----

    function showLoading(show) {
        if (show) {
            if (isInitialLoad) {
                $('#loadingOverlay').addClass('d-none');
                $('#tableBody').html(renderSkeletonRows(currentColCount));
            } else {
                $('#loadingOverlay').removeClass('d-none');
            }
        } else {
            isInitialLoad = false;
            $('#loadingOverlay').addClass('d-none');
        }
    }

    function showError(msg) {
        $('#errorMessage').text(msg);
        $('#errorAlert').removeClass('d-none');
    }

    function hideError() {
        $('#errorAlert').addClass('d-none');
    }

    function getSelectedCount() {
        return Object.keys(selectedIds).length;
    }

    function resetSelection() {
        selectedIds = {};
        $('#selectAll').prop('checked', false);
        updateBulkActionBar();
    }

    function updateBulkActionBar() {
        var count = getSelectedCount();
        var $bar = $('#bulkActionBar');
        if (count > 0) {
            if (!$bar.length) {
                var barHtml = '<div id="bulkActionBar" class="bulk-action-bar">' +
                    '<div class="d-flex align-items-center gap-3">' +
                    '<span class="bulk-count"><strong id="bulkCount">' + count + '</strong> selected</span>' +
                    '<button class="btn btn-sm btn-outline-danger bulk-btn" data-bulk="delete"><i class="bi bi-trash3 me-1"></i>Delete</button>' +
                    '<button class="btn btn-sm btn-outline-primary bulk-btn" data-bulk="export"><i class="bi bi-download me-1"></i>Export</button>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-link text-muted" id="bulkClearAll">Clear selection</button>' +
                    '</div>';
                $('.table-card').append(barHtml);
            } else {
                $bar.find('#bulkCount').text(count);
                $bar.removeClass('d-none');
            }
        } else {
            $bar.addClass('d-none');
        }
    }

    function syncSelectAll() {
        var $checks = $('#tableBody .row-select');
        var allChecked = $checks.length > 0 && $checks.filter(':checked').length === $checks.length;
        $('#selectAll').prop('checked', allChecked);
    }

    function scrollToTable() {
        var el = document.querySelector('.table-card');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ---- Toast Notifications ----

    var toastCounter = 0;

    function showToast(message, type) {
        var id = 'toast-' + (++toastCounter);
        var iconMap = {
            success: 'bi-check-circle-fill text-success',
            error:   'bi-exclamation-circle-fill text-danger',
            info:    'bi-info-circle-fill text-primary'
        };
        var icon = iconMap[type] || iconMap.info;

        var html =
            '<div id="' + id + '" class="toast export-toast align-items-center border-0" role="alert" aria-live="assertive" aria-atomic="true">' +
                '<div class="d-flex">' +
                    '<div class="toast-body d-flex align-items-center gap-2">' +
                        '<i class="bi ' + icon + '"></i>' +
                        '<span>' + escapeHtml(message) + '</span>' +
                    '</div>' +
                    '<button type="button" class="btn-close btn-close-sm me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
                '</div>' +
            '</div>';

        $('#toastContainer').append(html);
        var toastEl = document.getElementById(id);
        var toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();

        $(toastEl).on('hidden.bs.toast', function () {
            $(this).remove();
        });
    }

    // ---- Export Functions ----

    var isExporting = false;

    function setExportLoading(loading) {
        isExporting = loading;
        var $btn = $('.btn-export');
        if (loading) {
            $btn.prop('disabled', true);
            $btn.find('i.bi-download').removeClass('bi-download').addClass('bi-arrow-repeat spin-icon');
        } else {
            $btn.prop('disabled', false);
            $btn.find('i.bi-arrow-repeat').removeClass('bi-arrow-repeat spin-icon').addClass('bi-download');
        }
    }

    function fetchAllDataForExport(format, callback) {
        if (isExporting || !exportUrl) return;
        setExportLoading(true);

        var exportData = {
            search: searchTerm,
            sort_column: sortColumn,
            sort_order: sortDirection
        };
        var activeExp = getActiveFilters();
        if (Object.keys(activeExp).length > 0) {
            exportData.filters = activeExp;
        }

        $.ajax({
            url: exportUrl,
            method: 'GET',
            dataType: 'json',
            timeout: 30000,
            data: exportData,
            success: function (response) {
                if (response.error) {
                    showToast('Export failed: ' + response.error, 'error');
                    return;
                }
                if (!response.data || response.data.length === 0) {
                    showToast('No data to export.', 'info');
                    return;
                }
                try {
                    callback(response.columns, response.data);
                    var count = response.data ? response.data.length : 0;
                    showToast(format + ' exported successfully (' + count + ' records)', 'success');
                } catch (err) {
                    showToast('Export failed: ' + err.message, 'error');
                }
            },
            error: function () {
                showToast('Export failed. Could not fetch data from server.', 'error');
            },
            complete: function () {
                setExportLoading(false);
            }
        });
    }

    function buildExportData(columns, rows) {
        var visible = columns.filter(function (c) { return !hiddenColumns[c.key]; });
        var headers = visible.map(function (c) { return c.label; });
        var keys    = visible.map(function (c) { return c.key; });
        var data    = rows.map(function (row) {
            return keys.map(function (k) { return row[k] !== undefined ? row[k] : ''; });
        });
        return { headers: headers, keys: keys, data: data, columns: visible };
    }

    function exportExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('Excel library (SheetJS) not loaded. Check your internet connection.', 'error');
            return;
        }

        fetchAllDataForExport('Excel', function (columns, rows) {
            var exp = buildExportData(columns, rows);

            var ws = XLSX.utils.aoa_to_sheet([exp.headers].concat(exp.data));

            var colWidths = exp.headers.map(function (h, i) {
                var maxLen = h.length;
                for (var r = 0; r < Math.min(exp.data.length, 100); r++) {
                    var cellLen = String(exp.data[r][i] || '').length;
                    if (cellLen > maxLen) maxLen = cellLen;
                }
                return { wch: Math.min(maxLen + 3, 50) };
            });
            ws['!cols'] = colWidths;
            ws['!freeze'] = { xSplit: 0, ySplit: 1 };

            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.writeFile(wb, 'export_' + getTimestamp() + '.xlsx');
        });
    }

    function exportCsv() {
        if (typeof XLSX === 'undefined') {
            showToast('Export library (SheetJS) not loaded. Check your internet connection.', 'error');
            return;
        }

        fetchAllDataForExport('CSV', function (columns, rows) {
            var exp = buildExportData(columns, rows);

            var ws  = XLSX.utils.aoa_to_sheet([exp.headers].concat(exp.data));
            var csv = XLSX.utils.sheet_to_csv(ws);

            var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'export_' + getTimestamp() + '.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }

    function exportPdf() {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            showToast('PDF library (jsPDF) not loaded. Check your internet connection.', 'error');
            return;
        }

        fetchAllDataForExport('PDF', function (columns, rows) {
            var exp = buildExportData(columns, rows);

            var doc = new jspdf.jsPDF('l', 'mm', 'a4');
            var pageWidth = doc.internal.pageSize.getWidth();
            var pageHeight = doc.internal.pageSize.getHeight();

            doc.setFillColor(79, 70, 229);
            doc.rect(0, 0, pageWidth, 28, 'F');

            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Data Export', 14, 13);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(200, 200, 255);
            var subtitle = 'Generated: ' + new Date().toLocaleString();
            if (searchTerm) {
                subtitle += '   |   Filter: "' + searchTerm + '"';
            }
            subtitle += '   |   ' + rows.length + ' records';
            doc.text(subtitle, 14, 21);

            doc.setTextColor(0);

            var statusIdx = -1;
            var visCols = exp.columns || columns;
            for (var si = 0; si < visCols.length; si++) {
                if (visCols[si].type === 'status') { statusIdx = si; break; }
            }

            doc.autoTable({
                head: [exp.headers],
                body: exp.data,
                startY: 34,
                theme: 'grid',
                styles: {
                    fontSize: 7.5,
                    cellPadding: 3,
                    lineColor: [220, 220, 220],
                    lineWidth: 0.2,
                    textColor: [30, 30, 30],
                    font: 'helvetica'
                },
                headStyles: {
                    fillColor: [55, 48, 163],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    cellPadding: 3.5
                },
                alternateRowStyles: {
                    fillColor: [248, 249, 252]
                },
                columnStyles: (function () {
                    var styles = {};
                    for (var ci = 0; ci < visCols.length; ci++) {
                        if (visCols[ci].type === 'id') {
                            styles[ci] = { fontStyle: 'bold', textColor: [120, 120, 120], fontSize: 7 };
                        }
                        if (visCols[ci].type === 'email') {
                            styles[ci] = { textColor: [70, 70, 150], fontSize: 7 };
                        }
                        if (visCols[ci].type === 'name') {
                            styles[ci] = { fontStyle: 'bold' };
                        }
                    }
                    return styles;
                })(),
                margin: { top: 34, left: 14, right: 14, bottom: 18 },
                didParseCell: function (data) {
                    if (data.section === 'body' && statusIdx >= 0 && data.column.index === statusIdx) {
                        var val = String(data.cell.raw || '').toLowerCase();
                        if (val === 'active' || val === 'enabled' || val === 'confirmed') {
                            data.cell.styles.textColor = [5, 150, 105];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'inactive' || val === 'disabled') {
                            data.cell.styles.textColor = [156, 163, 175];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'pending' || val === 'waiting') {
                            data.cell.styles.textColor = [217, 119, 6];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawPage: function (data) {
                    var pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(
                        brandName + ' Export',
                        14,
                        pageHeight - 8
                    );
                    doc.text(
                        'Page ' + data.pageNumber + ' of ' + pageCount,
                        pageWidth - 14,
                        pageHeight - 8,
                        { align: 'right' }
                    );

                    if (data.pageNumber > 1) {
                        doc.setFillColor(79, 70, 229);
                        doc.rect(0, 0, pageWidth, 10, 'F');
                        doc.setFontSize(8);
                        doc.setTextColor(255, 255, 255);
                        doc.setFont('helvetica', 'bold');
                        doc.text('Data Export (continued)', 14, 7);
                        doc.setTextColor(0);
                    }
                }
            });

            doc.save('export_' + getTimestamp() + '.pdf');
        });
    }

    // ---- Action Handlers ----

    function handleAction(action, id) {
        var row = null;
        for (var r = 0; r < lastFetchedRows.length; r++) {
            if (primaryKey && String(lastFetchedRows[r][primaryKey]) === String(id)) {
                row = lastFetchedRows[r];
                break;
            }
        }
        if (window.DataTablePro && typeof window.DataTablePro.onAction === 'function') {
            window.DataTablePro.onAction(action, id, row);
            return;
        }
        switch (action) {
            case 'view':
                alert('View record #' + id + '\n\n(Not implemented — placeholder action)');
                break;
            case 'edit':
                alert('Edit record #' + id + '\n\n(Not implemented — placeholder action)');
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete record #' + id + '?')) {
                    alert('Delete record #' + id + '\n\n(Not implemented — placeholder action)');
                }
                break;
            default:
                alert(action + ' record #' + id + '\n\n(Not implemented — placeholder action)');
        }
    }

    // ---- Event Bindings ----

    $(document).ready(function () {

        loadStateFromUrl();
        fetchData();
        fetchDemoMerged();

        $('#searchInput').on('input', function () {
            clearTimeout(debounceTimer);
            var input = $(this);
            debounceTimer = setTimeout(function () {
                searchTerm  = input.val().trim();
                if (searchTerm.length > 200) searchTerm = searchTerm.substring(0, 200);
                currentPage = 1;
                updateSearchClear();
                fetchData();
            }, 400);
        });

        $('#searchClear').on('click', function () {
            $('#searchInput').val('').focus();
            searchTerm  = '';
            currentPage = 1;
            updateSearchClear();
            fetchData();
        });

        $('#pageSize').on('change', function () {
            perPage     = parseInt($(this).val(), 10) || defaultSize;
            currentPage = 1;
            fetchData();
        });

        bindSortEvents();

        $('#pagination').on('click', '.page-link', function (e) {
            e.preventDefault();
            var $item = $(this).closest('.page-item');
            if ($item.hasClass('disabled') || $item.hasClass('active')) return;

            var page = parseInt($(this).data('page'), 10);
            if (page && page > 0) {
                currentPage = page;
                scrollToTable();
                fetchData();
            }
        });

        $('#tableHead').on('change', '#selectAll', function () {
            var checked = $(this).is(':checked');
            $('#tableBody .row-select').each(function () {
                $(this).prop('checked', checked);
                var id = $(this).data('id');
                if (checked) { selectedIds[id] = true; } else { delete selectedIds[id]; }
            });
            updateBulkActionBar();
        });

        $('#tableBody').on('change', '.row-select', function () {
            var id = $(this).data('id');
            if ($(this).is(':checked')) { selectedIds[id] = true; } else { delete selectedIds[id]; }
            syncSelectAll();
            updateBulkActionBar();
        });

        $(document).on('click', '#bulkClearAll', function () {
            resetSelection();
            $('#tableBody .row-select').prop('checked', false);
        });

        $(document).on('click', '.bulk-btn', function () {
            var action = $(this).data('bulk');
            var ids = Object.keys(selectedIds);
            if (window.DataTablePro && typeof window.DataTablePro.onBulkAction === 'function') {
                window.DataTablePro.onBulkAction(action, ids);
                return;
            }
            alert('Bulk ' + action + ' for ' + ids.length + ' record(s): [' + ids.join(', ') + ']\n\n(Not implemented — placeholder action)');
        });

        $('#tableBody').on('click', '.action-btn', function () {
            var action = $(this).data('action');
            var id     = $(this).data('id');
            if (action && id !== undefined) {
                handleAction(action, id);
            }
        });

        $('#modeNormal').on('click', function () {
            if (currentMode === 'normal') return;
            currentMode = 'normal';
            currentPage = 1;
            isInitialLoad = true;
            $(this).addClass('active');
            $('#modeGrouped').removeClass('active');
            fetchData();
        });

        $('#modeGrouped').on('click', function () {
            if (currentMode === 'grouped') return;
            currentMode = 'grouped';
            currentPage = 1;
            isInitialLoad = true;
            $(this).addClass('active');
            $('#modeNormal').removeClass('active');
            fetchData();
        });

        if (config.showExport && exportUrl) {
            $('#exportExcel').on('click', function (e) { e.preventDefault(); exportExcel(); });
            $('#exportPdf').on('click',   function (e) { e.preventDefault(); exportPdf(); });
            $('#exportCsv').on('click',   function (e) { e.preventDefault(); exportCsv(); });
        }

        $(document).on('keydown', function (e) {
            if (e.key === '/' && !$(e.target).is('input, textarea, select')) {
                e.preventDefault();
                $('#searchInput').focus();
            }
            if (e.key === 'Escape' && $(e.target).is('#searchInput')) {
                e.preventDefault();
                $('#searchInput').blur();
            }
        });

        $(window).on('hashchange', function () {
            if (updatingHash) return;
            loadStateFromUrl();
            fetchData();
        });

        $('#darkModeToggle').on('click', function () {
            var current = document.documentElement.getAttribute('data-bs-theme');
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });

        $('#columnToggleMenu').on('change', '.col-toggle-check', function () {
            var key = $(this).data('col-key');
            if (!$(this).is(':checked')) {
                var visibleCount = $('#columnToggleMenu .col-toggle-check:checked').length;
                if (visibleCount === 0) {
                    $(this).prop('checked', true);
                    showToast('At least one column must remain visible.', 'error');
                    return;
                }
                hiddenColumns[key] = true;
            } else {
                delete hiddenColumns[key];
            }
            saveHiddenColumns();
            applyColumnVisibility();
        });
    });

    window.DataTablePro = window.DataTablePro || {};
    window.DataTablePro.refresh = function () { fetchData(); };
    window.DataTablePro.getSelectedIds = function () { return Object.keys(selectedIds); };
    window.DataTablePro.getState = function () {
        return { page: currentPage, perPage: perPage, search: searchTerm, sort: sortColumn, order: sortDirection, mode: currentMode, filters: columnFilters };
    };

})(jQuery);
