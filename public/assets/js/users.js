/**
 * PHP MVC Data Table — Frontend Controller
 * Fully server-driven: columns, actions, and modes are configured by backend response.
 * Handles AJAX loading, pagination, sorting, search, and rowspan/colspan rendering.
 */
(function ($) {
    'use strict';

    // ---- State ----
    let currentPage    = 1;
    let perPage        = 10;
    let searchTerm     = '';
    let sortColumn     = 'id';
    let sortDirection  = 'asc';
    let currentMode    = 'normal';
    let currentColCount = 8;
    let debounceTimer  = null;
    let activeXhr      = null;

    // Column definitions from the server (populated on first response)
    let columnDefs     = [];
    let primaryKey     = null;
    let hasActions     = false;

    // ---- Helpers ----

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var s = String(str);
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return s.replace(/[&<>"']/g, function (c) { return map[c]; });
    }

    function getColCount() {
        return currentColCount;
    }

    function emptyStateHtml(icon, text) {
        return '<tr class="no-data-row"><td colspan="' + getColCount() + '" class="text-center">' +
               '<div class="empty-state">' +
               '<i class="bi bi-' + icon + ' empty-state-icon"></i>' +
               '<span class="empty-state-text">' + escapeHtml(text) + '</span>' +
               '</div></td></tr>';
    }

    // ---- Data Fetching ----

    function fetchData() {
        if (activeXhr && activeXhr.readyState !== 4) {
            activeXhr.abort();
        }

        showLoading(true);
        hideError();

        activeXhr = $.ajax({
            url: '/users/data',
            method: 'GET',
            dataType: 'json',
            data: {
                page: currentPage,
                per_page: perPage,
                search: searchTerm,
                sort_column: sortColumn,
                sort_order: sortDirection,
                mode: currentMode
            },
            success: function (response) {
                if (response.error) {
                    showError(response.error);
                    renderPagination(response);
                    renderInfo(response);
                    return;
                }

                // Store server-driven metadata
                if (response.columns) {
                    columnDefs = response.columns;
                }
                primaryKey = response.primary_key || null;
                hasActions = !!response.has_actions;

                if (response.mode === 'grouped') {
                    currentColCount = columnDefs.length || 6;
                    renderGroupedHeaders(columnDefs);
                    renderGroupedBody(response.data);
                } else {
                    currentColCount = columnDefs.length + (hasActions ? 1 : 0);
                    renderNormalHeaders(columnDefs);
                    renderNormalBody(response.data);
                }

                renderPagination(response);
                renderInfo(response);
            },
            error: function (xhr, status) {
                if (status === 'abort') return;

                var msg = 'Failed to load data. Please try again.';
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp && resp.error) msg = resp.error;
                } catch (e) { /* use default message */ }

                showError(msg);
                $('#tableBody').html(emptyStateHtml('exclamation-circle', 'Error loading data'));
                $('#pagination').empty();
                $('#tableInfo').text('');
                $('#totalBadge').text('');
            },
            complete: function (xhr, status) {
                if (status !== 'abort') {
                    showLoading(false);
                }
            }
        });
    }

    function fetchDemoMerged() {
        $('#demoLoading').removeClass('d-none');

        $.ajax({
            url: '/users/demo-merged',
            method: 'GET',
            dataType: 'json',
            success: function (response) {
                if (response.error) {
                    $('#mergedTableBody').html(
                        '<tr><td colspan="5" class="text-center text-muted py-4">' + escapeHtml(response.error) + '</td></tr>'
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

    // ---- Normal Mode Rendering (fully server-driven) ----

    function renderNormalHeaders(cols) {
        if (!cols || cols.length === 0) return;

        var html = '<tr>';
        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.sortable) {
                html += '<th data-sort="' + escapeHtml(col.key) + '" class="sortable">' +
                        escapeHtml(col.label) + ' <span class="sort-icon"></span></th>';
            } else {
                html += '<th>' + escapeHtml(col.label) + '</th>';
            }
        }

        if (hasActions) {
            html += '<th class="text-center" style="width:130px">Actions</th>';
        }

        html += '</tr>';

        $('#tableHead').html(html);
        updateSortIndicators();
        bindSortEvents();
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
            html += '<tr>';

            for (var c = 0; c < columnDefs.length; c++) {
                var col = columnDefs[c];
                var val = row[col.key];
                var display = escapeHtml(val);

                // Special rendering for status columns
                if (col.key === 'status') {
                    var lower = String(val || '').toLowerCase();
                    if (lower === 'active') {
                        display = '<span class="status-badge status-active"><span class="status-dot"></span>' + escapeHtml(val) + '</span>';
                    } else if (lower === 'inactive') {
                        display = '<span class="status-badge status-inactive"><span class="status-dot"></span>' + escapeHtml(val) + '</span>';
                    }
                }

                html += '<td>' + display + '</td>';
            }

            if (hasActions && primaryKey) {
                var pkVal = parseInt(row[primaryKey], 10);
                if (!isNaN(pkVal)) {
                    html += '<td class="text-center action-btns">' +
                        '<button class="action-btn btn-view" data-action="view" data-id="' + pkVal + '" title="View">' +
                            '<i class="bi bi-eye"></i>' +
                        '</button>' +
                        '<button class="action-btn btn-edit" data-action="edit" data-id="' + pkVal + '" title="Edit">' +
                            '<i class="bi bi-pencil"></i>' +
                        '</button>' +
                        '<button class="action-btn btn-delete" data-action="delete" data-id="' + pkVal + '" title="Delete">' +
                            '<i class="bi bi-trash3"></i>' +
                        '</button>' +
                    '</td>';
                }
            }

            html += '</tr>';
        }

        tbody.html(html);
    }

    // ---- Grouped Mode Rendering (Rowspan/Colspan) ----

    function renderGroupedHeaders(cols) {
        if (!cols || cols.length === 0) return;

        var html = '<tr>';
        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            if (col.sortable) {
                html += '<th data-sort="' + escapeHtml(col.key) + '" class="sortable">' +
                        escapeHtml(col.label) + ' <span class="sort-icon"></span></th>';
            } else {
                html += '<th>' + escapeHtml(col.label) + '</th>';
            }
        }
        html += '</tr>';

        $('#tableHead').html(html);
        updateSortIndicators();
        bindSortEvents();
    }

    function renderGroupedBody(rows) {
        var tbody = $('#tableBody');
        tbody.empty();

        if (!rows || rows.length === 0) {
            tbody.html(emptyStateHtml('inbox', 'No records found'));
            return;
        }

        var html = '';
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (!Array.isArray(row)) continue;

            var isSummary = (row.length === 1 && row[0] && row[0].colspan);

            html += isSummary ? '<tr class="summary-row">' : '<tr>';

            for (var c = 0; c < row.length; c++) {
                var cell = row[c];
                if (!cell) continue;

                if (cell.skip === true) {
                    continue;
                }

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

                var content = '';
                if (cell.html === true) {
                    content = cell.value || '';
                } else {
                    content = escapeHtml(cell.value);
                }

                html += '<td' + attrs + '>' + content + '</td>';
            }

            html += '</tr>';
        }

        tbody.html(html);
    }

    // ---- Demo Merged Table (Court Schedule) ----

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
            tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">No demo data</td></tr>');
            return;
        }

        var html = '';
        for (var r = 0; r < data.data.length; r++) {
            var row = data.data[r];
            if (!Array.isArray(row)) continue;

            html += '<tr>';

            for (var c = 0; c < row.length; c++) {
                var cell = row[c];
                if (!cell) continue;

                if (cell.skip === true) {
                    continue;
                }

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

                var content = '';
                if (cell.html === true) {
                    content = cell.value || '';
                } else {
                    content = escapeHtml(cell.value);
                }

                html += '<td' + attrs + '>' + content + '</td>';
            }

            html += '</tr>';
        }

        tbody.html(html);
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
                '<a class="page-link" href="#" data-page="' + (current - 1) + '">&laquo;</a></li>';

        var pages = generatePageNumbers(current, total);
        for (var i = 0; i < pages.length; i++) {
            var p = pages[i];
            if (p === '...') {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            } else {
                html += '<li class="page-item ' + (p === current ? 'active' : '') + '">' +
                        '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
            }
        }

        html += '<li class="page-item ' + (current === total ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (current + 1) + '">&raquo;</a></li>';

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
        $('#tableHead .sortable').removeClass('sort-asc sort-desc');
        $('#tableHead .sortable[data-sort="' + sortColumn + '"]')
            .addClass(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
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

    // ---- UI Helpers ----

    function showLoading(show) {
        if (show) {
            $('#loadingOverlay').removeClass('d-none');
        } else {
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

    // ---- Action Handlers (delegated via data attributes) ----

    function handleAction(action, id) {
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
        }
    }

    // ---- Event Bindings ----

    $(document).ready(function () {

        fetchData();
        fetchDemoMerged();

        // Search with debounce
        $('#searchInput').on('input', function () {
            clearTimeout(debounceTimer);
            var input = $(this);
            debounceTimer = setTimeout(function () {
                searchTerm  = input.val().trim();
                currentPage = 1;
                fetchData();
            }, 400);
        });

        // Page size change
        $('#pageSize').on('change', function () {
            perPage     = parseInt($(this).val(), 10) || 10;
            currentPage = 1;
            fetchData();
        });

        // Sort header clicks
        bindSortEvents();

        // Pagination clicks (delegated)
        $('#pagination').on('click', '.page-link', function (e) {
            e.preventDefault();
            var $item = $(this).closest('.page-item');
            if ($item.hasClass('disabled') || $item.hasClass('active')) return;

            var page = parseInt($(this).data('page'), 10);
            if (page && page > 0) {
                currentPage = page;
                fetchData();
            }
        });

        // Action buttons (delegated — no inline onclick)
        $('#tableBody').on('click', '.action-btn', function () {
            var action = $(this).data('action');
            var id     = parseInt($(this).data('id'), 10);
            if (action && !isNaN(id)) {
                handleAction(action, id);
            }
        });

        // Mode toggle: Normal
        $('#modeNormal').on('click', function () {
            if (currentMode === 'normal') return;
            currentMode = 'normal';
            currentPage = 1;
            $(this).addClass('active');
            $('#modeGrouped').removeClass('active');
            fetchData();
        });

        // Mode toggle: Grouped
        $('#modeGrouped').on('click', function () {
            if (currentMode === 'grouped') return;
            currentMode = 'grouped';
            currentPage = 1;
            $(this).addClass('active');
            $('#modeNormal').removeClass('active');
            fetchData();
        });

        // Keyboard shortcut: "/" focuses search
        $(document).on('keydown', function (e) {
            if (e.key === '/' && !$(e.target).is('input, textarea, select')) {
                e.preventDefault();
                $('#searchInput').focus();
            }
        });
    });

})(jQuery);
