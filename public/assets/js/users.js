/**
 * PHP MVC Data Table — Frontend Controller
 * Fully server-driven: columns, actions, and modes are configured by backend response.
 * Handles AJAX loading, pagination, sorting, search, rowspan/colspan rendering,
 * URL state persistence, and PDF/Excel/CSV export.
 */
(function ($) {
    'use strict';

    // ---- State ----
    var currentPage    = 1;
    var perPage        = 10;
    var searchTerm     = '';
    var sortColumn     = 'id';
    var sortDirection  = 'asc';
    var currentMode    = 'normal';
    var currentColCount = 8;
    var debounceTimer  = null;
    var activeXhr      = null;
    var columnDefs     = [];
    var primaryKey     = null;
    var hasActions     = false;

    // ---- Helpers ----

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var s = String(str);
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return s.replace(/[&<>"']/g, function (c) { return map[c]; });
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

    // ---- URL State Management ----

    function saveStateToUrl() {
        var params = new URLSearchParams();
        if (currentPage > 1)          params.set('page', currentPage);
        if (searchTerm)               params.set('search', searchTerm);
        if (sortColumn !== 'id')      params.set('sort', sortColumn);
        if (sortDirection !== 'asc')  params.set('order', sortDirection);
        if (currentMode !== 'normal') params.set('mode', currentMode);
        if (perPage !== 10)           params.set('per_page', perPage);

        var hash = params.toString();
        history.replaceState(null, '', hash ? '#' + hash : window.location.pathname);
    }

    function loadStateFromUrl() {
        var hash = window.location.hash.substring(1);
        if (!hash) return;

        var params = new URLSearchParams(hash);

        if (params.has('page'))     currentPage   = Math.max(1, parseInt(params.get('page'), 10) || 1);
        if (params.has('sort'))     sortColumn    = params.get('sort');
        if (params.has('order'))    sortDirection  = params.get('order') === 'desc' ? 'desc' : 'asc';
        if (params.has('per_page')) perPage        = parseInt(params.get('per_page'), 10) || 10;

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

        $('#pageSize').val(perPage);
    }

    // ---- Column Type Renderers ----

    function renderCellByType(value, type) {
        if (value === null || value === undefined) value = '';
        var escaped = escapeHtml(value);

        switch (type) {
            case 'id':
                return '<span class="cell-id">#' + escaped + '</span>';

            case 'name':
                return '<span class="cell-name">' + escaped + '</span>';

            case 'email':
                return '<a href="mailto:' + escaped + '" class="cell-email">' + escaped + '</a>';

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
                return '<span class="status-badge ' + cls + '"><span class="status-dot"></span>' + escaped + '</span>';

            case 'date':
                return '<span class="cell-date">' + escaped + '</span>';

            default:
                return escaped;
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

                if (response.columns) columnDefs = response.columns;
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
                updateSearchClear();
            },
            error: function (xhr, status) {
                if (status === 'abort') return;

                var msg = 'Failed to load data. Please try again.';
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp && resp.error) msg = resp.error;
                } catch (e) {}

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
        $('#demoLoading').removeClass('d-none');

        $.ajax({
            url: '/users/demo-merged',
            method: 'GET',
            dataType: 'json',
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

    // ---- Normal Mode Rendering (type-driven) ----

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
            html += '<tr class="fade-in">';

            for (var c = 0; c < columnDefs.length; c++) {
                var col = columnDefs[c];
                html += '<td>' + renderCellByType(row[col.key], col.type) + '</td>';
            }

            if (hasActions && primaryKey) {
                var pkVal = escapeHtml(row[primaryKey]);
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

            html += '</tr>';
        }

        tbody.html(html);
    }

    // ---- Grouped Mode ----

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
        if (isExporting) return;
        setExportLoading(true);

        $.ajax({
            url: '/users/export',
            method: 'GET',
            dataType: 'json',
            data: {
                search: searchTerm,
                sort_column: sortColumn,
                sort_order: sortDirection
            },
            success: function (response) {
                if (response.error) {
                    showToast('Export failed: ' + response.error, 'error');
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
        var headers = columns.map(function (c) { return c.label; });
        var keys    = columns.map(function (c) { return c.key; });
        var data    = rows.map(function (row) {
            return keys.map(function (k) { return row[k] !== undefined ? row[k] : ''; });
        });
        return { headers: headers, keys: keys, data: data };
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

            // Freeze header row
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

            // Header bar
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 0, pageWidth, 28, 'F');

            // Title on header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Data Export', 14, 13);

            // Subtitle on header
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

            // Status column index (for colored cells)
            var statusIdx = -1;
            for (var si = 0; si < columns.length; si++) {
                if (columns[si].type === 'status') { statusIdx = si; break; }
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
                    for (var ci = 0; ci < columns.length; ci++) {
                        if (columns[ci].type === 'id') {
                            styles[ci] = { fontStyle: 'bold', textColor: [120, 120, 120], fontSize: 7 };
                        }
                        if (columns[ci].type === 'email') {
                            styles[ci] = { textColor: [70, 70, 150], fontSize: 7 };
                        }
                        if (columns[ci].type === 'name') {
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
                    // Footer
                    var pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(
                        'DataTablePro Export',
                        14,
                        pageHeight - 8
                    );
                    doc.text(
                        'Page ' + data.pageNumber + ' of ' + pageCount,
                        pageWidth - 14,
                        pageHeight - 8,
                        { align: 'right' }
                    );

                    // Header bar on subsequent pages
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

        // Restore state from URL hash before first load
        loadStateFromUrl();

        fetchData();
        fetchDemoMerged();

        // Search with debounce
        $('#searchInput').on('input', function () {
            clearTimeout(debounceTimer);
            var input = $(this);
            debounceTimer = setTimeout(function () {
                searchTerm  = input.val().trim();
                currentPage = 1;
                updateSearchClear();
                fetchData();
            }, 400);
        });

        // Search clear button
        $('#searchClear').on('click', function () {
            $('#searchInput').val('').focus();
            searchTerm  = '';
            currentPage = 1;
            updateSearchClear();
            fetchData();
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
                scrollToTable();
                fetchData();
            }
        });

        // Action buttons (delegated)
        $('#tableBody').on('click', '.action-btn', function () {
            var action = $(this).data('action');
            var id     = $(this).data('id');
            if (action && id !== undefined) {
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

        // Export buttons
        $('#exportExcel').on('click', function (e) { e.preventDefault(); exportExcel(); });
        $('#exportPdf').on('click',   function (e) { e.preventDefault(); exportPdf(); });
        $('#exportCsv').on('click',   function (e) { e.preventDefault(); exportCsv(); });

        // Keyboard shortcut: "/" focuses search
        $(document).on('keydown', function (e) {
            if (e.key === '/' && !$(e.target).is('input, textarea, select')) {
                e.preventDefault();
                $('#searchInput').focus();
            }
            // Escape clears search focus
            if (e.key === 'Escape' && $(e.target).is('#searchInput')) {
                e.preventDefault();
                $('#searchInput').blur();
            }
        });

        // Browser back/forward
        $(window).on('hashchange', function () {
            loadStateFromUrl();
            fetchData();
        });
    });

})(jQuery);
