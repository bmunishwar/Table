/**
 * PHP MVC Data Table — Frontend Controller
 * Handles AJAX loading, pagination, sorting, search, and rowspan/colspan rendering.
 */
(function ($) {
    'use strict';

    // ---- State ----
    let currentPage   = 1;
    let perPage        = 10;
    let searchTerm     = '';
    let sortColumn     = 'id';
    let sortDirection  = 'asc';
    let currentMode    = 'normal'; // 'normal' | 'grouped'
    let debounceTimer  = null;
    let activeXhr      = null; // track current AJAX request

    // Column count for the normal table (including Actions)
    const NORMAL_COL_COUNT = 8;

    // ---- Helpers ----

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var s = String(str);
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return s.replace(/[&<>"']/g, function (c) { return map[c]; });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return escapeHtml(dateStr);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    // ---- Data Fetching ----

    function fetchUsers() {
        // Abort previous pending request
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
                    return;
                }

                if (response.mode === 'grouped') {
                    renderGroupedHeaders(response.columns);
                    renderGroupedBody(response.data);
                } else {
                    renderNormalHeaders();
                    renderNormalBody(response.data);
                }

                renderPagination(response);
                renderInfo(response);
            },
            error: function (xhr, status) {
                if (status === 'abort') return;
                showError('Failed to load data. Please try again.');
                $('#tableBody').html(
                    '<tr class="no-data-row"><td colspan="' + NORMAL_COL_COUNT + '" class="text-center">' +
                    '<i class="bi bi-exclamation-circle me-2"></i>Error loading data</td></tr>'
                );
                $('#pagination').empty();
                $('#tableInfo').text('');
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
                renderDemoMergedTable(response);
            },
            error: function () {
                $('#mergedTableBody').html(
                    '<tr><td colspan="5" class="text-center text-muted py-4">' +
                    '<i class="bi bi-exclamation-circle me-2"></i>Failed to load demo data</td></tr>'
                );
            },
            complete: function () {
                $('#demoLoading').addClass('d-none');
            }
        });
    }

    // ---- Normal Mode Rendering ----

    function renderNormalHeaders() {
        var headerHtml =
            '<tr>' +
            '<th data-sort="id" class="sortable">ID <span class="sort-icon"></span></th>' +
            '<th data-sort="name" class="sortable">Name <span class="sort-icon"></span></th>' +
            '<th data-sort="email" class="sortable">Email <span class="sort-icon"></span></th>' +
            '<th data-sort="mobile" class="sortable">Mobile <span class="sort-icon"></span></th>' +
            '<th data-sort="city" class="sortable">City <span class="sort-icon"></span></th>' +
            '<th data-sort="status" class="sortable">Status <span class="sort-icon"></span></th>' +
            '<th data-sort="created_at" class="sortable">Created <span class="sort-icon"></span></th>' +
            '<th class="text-center" style="width:140px">Actions</th>' +
            '</tr>';

        $('#tableHead').html(headerHtml);
        updateSortIndicators();
        bindSortEvents();
    }

    function renderNormalBody(rows) {
        var tbody = $('#tableBody');
        tbody.empty();

        if (!rows || rows.length === 0) {
            tbody.html(
                '<tr class="no-data-row"><td colspan="' + NORMAL_COL_COUNT + '" class="text-center">' +
                '<i class="bi bi-inbox me-2"></i>No records found</td></tr>'
            );
            return;
        }

        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];

            var statusBadge = row.status === 'active'
                ? '<span class="badge bg-success">Active</span>'
                : '<span class="badge bg-secondary">Inactive</span>';

            html += '<tr>' +
                '<td>' + escapeHtml(row.id) + '</td>' +
                '<td>' + escapeHtml(row.name) + '</td>' +
                '<td>' + escapeHtml(row.email) + '</td>' +
                '<td>' + escapeHtml(row.mobile) + '</td>' +
                '<td>' + escapeHtml(row.city) + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td>' + formatDate(row.created_at) + '</td>' +
                '<td class="text-center action-btns">' +
                    '<button class="btn btn-sm btn-outline-info" onclick="DataTable.viewUser(' + row.id + ')" title="View">' +
                        '<i class="bi bi-eye"></i>' +
                    '</button>' +
                    '<button class="btn btn-sm btn-outline-warning" onclick="DataTable.editUser(' + row.id + ')" title="Edit">' +
                        '<i class="bi bi-pencil"></i>' +
                    '</button>' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="DataTable.deleteUser(' + row.id + ')" title="Delete">' +
                        '<i class="bi bi-trash"></i>' +
                    '</button>' +
                '</td>' +
                '</tr>';
        }

        tbody.html(html);
    }

    // ---- Grouped Mode Rendering (Rowspan/Colspan) ----

    function renderGroupedHeaders(columns) {
        if (!columns || columns.length === 0) return;

        var html = '<tr>';
        for (var i = 0; i < columns.length; i++) {
            html += '<th>' + escapeHtml(columns[i]) + '</th>';
        }
        html += '</tr>';

        $('#tableHead').html(html);
    }

    function renderGroupedBody(rows) {
        var tbody = $('#tableBody');
        tbody.empty();

        if (!rows || rows.length === 0) {
            tbody.html(
                '<tr class="no-data-row"><td colspan="6" class="text-center">' +
                '<i class="bi bi-inbox me-2"></i>No records found</td></tr>'
            );
            return;
        }

        var html = '';
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];

            // Detect summary rows (rows with colspan covering full width)
            var isSummary = false;
            if (row.length === 1 && row[0].colspan) {
                isSummary = true;
            }

            html += isSummary ? '<tr class="summary-row">' : '<tr>';

            for (var c = 0; c < row.length; c++) {
                var cell = row[c];

                // Skip cells covered by rowspan/colspan from previous rows/cells
                if (cell.skip === true) {
                    continue;
                }

                var attrs = '';
                if (cell.rowspan && cell.rowspan > 1) {
                    attrs += ' rowspan="' + cell.rowspan + '"';
                }
                if (cell.colspan && cell.colspan > 1) {
                    attrs += ' colspan="' + cell.colspan + '"';
                }
                if (cell['class']) {
                    attrs += ' class="' + cell['class'] + '"';
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
        // Headers
        var thead = $('#mergedTableHead');
        var headHtml = '<tr>';
        if (data.columns) {
            for (var i = 0; i < data.columns.length; i++) {
                headHtml += '<th>' + escapeHtml(data.columns[i]) + '</th>';
            }
        }
        headHtml += '</tr>';
        thead.html(headHtml);

        // Body with rowspan/colspan
        var tbody = $('#mergedTableBody');
        if (!data.data || data.data.length === 0) {
            tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">No demo data</td></tr>');
            return;
        }

        var html = '';
        for (var r = 0; r < data.data.length; r++) {
            var row = data.data[r];
            html += '<tr>';

            for (var c = 0; c < row.length; c++) {
                var cell = row[c];

                if (cell.skip === true) {
                    continue;
                }

                var attrs = '';
                if (cell.rowspan && cell.rowspan > 1) {
                    attrs += ' rowspan="' + cell.rowspan + '"';
                }
                if (cell.colspan && cell.colspan > 1) {
                    attrs += ' colspan="' + cell.colspan + '"';
                }
                if (cell['class']) {
                    attrs += ' class="' + cell['class'] + '"';
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

        var total  = response.total_pages || 0;
        var current = response.current_page || 1;

        if (total <= 1) return;

        var html = '';

        // Previous
        html += '<li class="page-item ' + (current === 1 ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (current - 1) + '">&laquo;</a></li>';

        // Page numbers with ellipsis
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

        // Next
        html += '<li class="page-item ' + (current === total ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (current + 1) + '">&raquo;</a></li>';

        pagination.html(html);
    }

    function generatePageNumbers(current, total) {
        var pages = [];
        var delta = 2; // pages around current

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
            fetchUsers();
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

    // ---- Action Handlers (placeholders) ----

    window.DataTable = {
        viewUser: function (id) {
            alert('View user #' + id + '\n\n(Not implemented — placeholder action)');
        },
        editUser: function (id) {
            alert('Edit user #' + id + '\n\n(Not implemented — placeholder action)');
        },
        deleteUser: function (id) {
            if (confirm('Are you sure you want to delete user #' + id + '?')) {
                alert('Delete user #' + id + '\n\n(Not implemented — placeholder action)');
            }
        }
    };

    // ---- Event Bindings ----

    $(document).ready(function () {

        // Initial load
        fetchUsers();
        fetchDemoMerged();

        // Search with debounce
        $('#searchInput').on('input', function () {
            clearTimeout(debounceTimer);
            var input = $(this);
            debounceTimer = setTimeout(function () {
                searchTerm  = input.val().trim();
                currentPage = 1;
                fetchUsers();
            }, 400);
        });

        // Page size change
        $('#pageSize').on('change', function () {
            perPage     = parseInt($(this).val(), 10);
            currentPage = 1;
            fetchUsers();
        });

        // Sort header clicks (delegated, bound initially and after header redraw)
        bindSortEvents();

        // Pagination clicks (delegated)
        $('#pagination').on('click', '.page-link', function (e) {
            e.preventDefault();
            var $item = $(this).closest('.page-item');
            if ($item.hasClass('disabled') || $item.hasClass('active')) return;

            var page = parseInt($(this).data('page'), 10);
            if (page && page > 0) {
                currentPage = page;
                fetchUsers();
            }
        });

        // Mode toggle: Normal
        $('#modeNormal').on('click', function () {
            if (currentMode === 'normal') return;
            currentMode = 'normal';
            currentPage = 1;
            $(this).addClass('active');
            $('#modeGrouped').removeClass('active');
            fetchUsers();
        });

        // Mode toggle: Grouped
        $('#modeGrouped').on('click', function () {
            if (currentMode === 'grouped') return;
            currentMode = 'grouped';
            currentPage = 1;
            $(this).addClass('active');
            $('#modeNormal').removeClass('active');
            fetchUsers();
        });
    });

})(jQuery);
