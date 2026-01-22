
// Column Mappings
const COL = {
    ORG_PADRE: 17,
    ORGANISMO: 1,
    ANIO: 2,
    MES: 3,
    ANIO_SALIDA: 19,
    MES_SALIDA: 20,
    TIPO_CONTRATO: 6,
    RUT: 8,
    NOMBRE: 9,
    CALIFICACION: 10,
    EDAD: 11,
    FECHA_SALIDA_TS: 25,
    PAGOS: 26,
    TC_SALIDA: 23,
    REM_BRUTA: 21,
    CARGO_ENTRADA: 27,
    CARGO_SALIDA: 28
};

let allData = [];
let filteredData = [];
const PAGE_SIZE = 100;
let currentPage = 1;
let searchQuery = '';
let searchCargoQuery = '';
let searchDebounceTimer;
let searchCargoDebounceTimer;
let currentSort = { col: null, dir: 'asc' };

// Global state for selected filters
const activeFilters = {
    orgPadre: new Set(),
    organismo: new Set(),
    anio: new Set(),
    mes: new Set(),
    anioSalida: new Set(),
    mesSalida: new Set(),
    tipoContrato: new Set(),
    tcSalida: new Set()
};

// DOM Elements
const els = {
    tableBody: document.getElementById('table-body'),
    recordCount: document.getElementById('record-count'),
    prevBtn: document.getElementById('prev-page'),
    nextBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    searchInput: document.getElementById('search-input'),
    searchCargoInput: document.getElementById('search-cargo'),
    activeFiltersBar: document.getElementById('active-filters-bar'),
    activeFiltersList: document.getElementById('active-filters-list'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    modal: document.getElementById('details-modal'),
    modalBody: document.getElementById('modal-details-body'),
    closeModalBtn: document.getElementById('close-modal'),
    filters: {
        orgPadre: document.getElementById('filter-org-padre'),
        organismo: document.getElementById('filter-organismo'),
        anio: document.getElementById('filter-anio'),
        mes: document.getElementById('filter-mes'),
        anioSalida: document.getElementById('filter-anio-salida'),
        mesSalida: document.getElementById('filter-mes-salida'),
        tipoContrato: document.getElementById('filter-tipo-contrato'),
        tcSalida: document.getElementById('filter-tc-salida'),
    },
    btnDownload: document.getElementById('btn-download'),
};

// ... (existing code) ...

function downloadExcel() {
    if (!filteredData || filteredData.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // Prepare data for Excel
    // We map filteredData to objects with the specific headers we want
    const dataForSheet = filteredData.map(row => {
        // Safe getter
        const g = (i) => {
            let val = row[i];
            if (val === null || val === undefined) return "";
            return val;
        };

        return {
            "Código Organismo": g(0),
            "Organismo": g(1),
            "Año Entrada": g(2),
            "Mes Entrada": g(3),
            "Remuneración Bruta Entrada": g(4),
            "Remuneración Líquida Entrada": g(5),
            "Tipo Contrato Entrada": g(6),
            "Nombre Base Datos": g(7),
            "RUT": g(8),
            "Nombre": g(9),
            "Calificación Entrada": g(10),
            "Clase de Edad": g(11),
            "Sexo": g(12),
            "Fecha Ingreso": g(13),
            "Código Org Padre": g(16),
            "Organismo Padre": g(17),
            "Es Municipal": g(18),
            "Año Salida": g(19),
            "Mes Salida": g(20),
            "Remuneración Bruta Salida": g(21),
            "Remuneración Líquida Salida": g(22),
            "Tipo Contrato Salida": g(23),
            "Calificación Salida": g(24),
            "Fecha Salida": g(25),
            "Número de Pagos": g(26),
            "Cargo Entrada": g(27),
            "Cargo Salida": g(28)
        };
    });

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(dataForSheet);

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos Empleo");

    // Save File
    XLSX.writeFile(wb, "empleo_rapido_export.xlsx");
}

// Helper for filter configs
const filterConfigs = [
    { key: 'orgPadre', col: COL.ORG_PADRE, el: els.filters.orgPadre },
    { key: 'organismo', col: COL.ORGANISMO, el: els.filters.organismo },
    { key: 'anio', col: COL.ANIO, el: els.filters.anio },
    { key: 'mes', col: COL.MES, el: els.filters.mes },
    { key: 'anioSalida', col: COL.ANIO_SALIDA, el: els.filters.anioSalida },
    { key: 'mesSalida', col: COL.MES_SALIDA, el: els.filters.mesSalida },
    { key: 'tipoContrato', col: COL.TIPO_CONTRATO, el: els.filters.tipoContrato },
    { key: 'tcSalida', col: COL.TC_SALIDA, el: els.filters.tcSalida },
];

async function init() {
    try {
        els.recordCount.textContent = 'Cargando datos (esto puede tardar unos segundos)...';
        const response = await fetch('data2.json.gz');

        if (!response.ok) throw new Error('No se pudo cargar data2.json.gz');

        // Decompress the GZIP file client-side
        const ds = new DecompressionStream('gzip');
        const decompressedResponse = new Response(response.body.pipeThrough(ds));
        const json = await decompressedResponse.json();

        allData = Array.isArray(json) ? json : [];

        filteredData = allData;

        // Initial render of filters with full data context
        renderAllFilters();

        updateTable();
        updateStats(); // Initial stats

        // Search Listener
        if (els.searchInput) {
            els.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    renderAllFilters();
                    applyFilters();
                }, 300);
            });
        }

        // Cargo Search Listener
        if (els.searchCargoInput) {
            els.searchCargoInput.addEventListener('input', (e) => {
                clearTimeout(searchCargoDebounceTimer);
                searchCargoDebounceTimer = setTimeout(() => {
                    searchCargoQuery = e.target.value.toLowerCase().trim();
                    renderAllFilters();
                    applyFilters();
                }, 300);
            });
        }

        // Clear Filters Listener
        if (els.btnClearFilters) {
            els.btnClearFilters.addEventListener('click', clearFilters);
        }

        // Sorting Listeners
        document.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const colKey = th.dataset.col;
                handleSort(colKey);
            });
        });




        // Modal Close Listeners
        if (els.closeModalBtn) {
            els.closeModalBtn.addEventListener('click', closeModal);
        }
        if (els.modal) {
            els.modal.addEventListener('click', (e) => {
                if (e.target === els.modal) closeModal();
            });
        }

        // Download Button Listener
        if (els.btnDownload) {
            els.btnDownload.addEventListener('click', downloadExcel);
        }

    } catch (e) {
        console.error(e);
        els.recordCount.textContent = 'Error cargando datos.';
        alert('Error cargando data2.json.gz. Asegúrate de que el navegador soporte DecompressionStream y de ejecutar esto en un servidor local.');
    }
}


function toggleFilter(category, value, infoDiv) {
    const set = activeFilters[category];
    if (set.has(value)) {
        set.delete(value);
        // We don't remove class manually here because we re-render
    } else {
        set.add(value);
    }

    // Core of the cascade logic:
    // 1. Re-calculate which options are valid for ALL filters based on the new selection state.
    renderAllFilters();

    // 2. Update the main data table
    applyFilters();
    renderActiveFilters();
}

function clearFilters() {
    // Clear Sets
    Object.keys(activeFilters).forEach(key => activeFilters[key].clear());

    // Clear Inputs
    searchQuery = '';
    searchCargoQuery = '';
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchCargoInput) els.searchCargoInput.value = '';

    // Re-render
    renderAllFilters();
    applyFilters();
    renderActiveFilters();
}

function renderActiveFilters() {
    if (!els.activeFiltersBar || !els.activeFiltersList) return;

    els.activeFiltersList.innerHTML = '';
    let hasFilters = false;

    // Iterate over activeFilters
    Object.keys(activeFilters).forEach(key => {
        const set = activeFilters[key];
        if (set.size > 0) {
            hasFilters = true;
            set.forEach(val => {
                const chip = document.createElement('div');
                chip.className = 'filter-chip';
                chip.innerHTML = `
                    <span>${val}</span>
                    <div class="remove-filter" title="Quitar filtro">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                `;
                // Add click listener to remove
                chip.querySelector('.remove-filter').addEventListener('click', () => {
                    // Toggle off
                    // Note: We need to find the element in DOM to pass to toggleFilter if we followed that pattern?
                    // toggleFilter(targetConfig.key, val, div);
                    // But toggleFilter uses 'div' argument to toggle class... which rerenders anyway.
                    // So we can pass null.
                    toggleFilter(key, val, null);
                });
                els.activeFiltersList.appendChild(chip);
            });
        }
    });

    if (hasFilters) {
        els.activeFiltersBar.classList.remove('hidden');
    } else {
        els.activeFiltersBar.classList.add('hidden');
    }
}

/**
 * Renders all filter lists. 
 * For each filter, it calculates the valid options based on the selection of *other* filters.
 * (Bidirectional / Global Context filtering)
 */
function renderAllFilters() {
    filterConfigs.forEach(targetConfig => {
        // 1. Determine the subset of data relevant for THIS filter.
        // We want to filter allData by all active filters EXCEPT the current one (targetConfig.key).
        // This allows the user to see other siblings in the same category (e.g. check multiple years).

        const subset = allData.filter(row => {
            for (const key in activeFilters) {
                if (key === targetConfig.key) continue; // Skip self
                const set = activeFilters[key];
                if (set.size > 0) {
                    // Check if row matches this active filter
                    // Map key to col index
                    const colIdx = getColIndexByKey(key);
                    if (colIdx !== -1 && !set.has(row[colIdx])) {
                        return false;
                    }
                }
            }

            // Check Search
            if (searchQuery) {
                const searchTerms = searchQuery.split(/\s+/);
                const rut = String(row[COL.RUT] || '').toLowerCase();
                const nombre = String(row[COL.NOMBRE] || '').toLowerCase();
                const fullText = rut + ' ' + nombre;

                const matches = searchTerms.every(term => fullText.includes(term));
                if (!matches) return false;
            }

            // Check Cargo Search
            if (searchCargoQuery) {
                const searchTerms = searchCargoQuery.split(/\s+/);
                const cargoIn = String(row[COL.CARGO_ENTRADA] || '').toLowerCase();
                const cargoOut = String(row[COL.CARGO_SALIDA] || '').toLowerCase();
                const fullText = cargoIn + ' ' + cargoOut;

                const matches = searchTerms.every(term => fullText.includes(term));
                if (!matches) return false;
            }

            return true;
        });

        // 2. Get unique values from this subset
        const uniqueValues = new Set();
        subset.forEach(row => {
            const val = row[targetConfig.col];
            if (val !== null && val !== undefined && val !== "") {
                uniqueValues.add(val);
            }
        });

        const sortedValues = Array.from(uniqueValues).sort();

        // 3. Render the list
        // Optimization: updating innerHTML is fast enough for ~100 items. 
        // For 'Organismo' (potentially thousands), it might be heavy, but DOM usually handles <5000 nodes ok.
        targetConfig.el.innerHTML = '';

        sortedValues.forEach(val => {
            const div = document.createElement('div');
            div.className = 'filter-item';
            if (activeFilters[targetConfig.key].has(val)) {
                div.classList.add('selected');
            }
            div.textContent = val;
            div.onclick = () => toggleFilter(targetConfig.key, val, div);
            targetConfig.el.appendChild(div);
        });

        // 4. Clean up invalid selections?
        // If a value was selected in activeFilters[targetConfig.key] but is NOT in uniqueValues,
        // it means it's no longer compatible with other filters.
        // We should probably remove it from activeFilters so the Data Table doesn't show 0 results unnecessarily?
        // Or keep it? Standard simple cascade: Valid Options Only.
        // If we simply don't render it, the user can't unclick it. 
        // Let's remove invalid selections from the Set to keep state clean.

        const currentSelection = new Set(activeFilters[targetConfig.key]);
        currentSelection.forEach(selectedVal => {
            if (!uniqueValues.has(selectedVal)) {
                activeFilters[targetConfig.key].delete(selectedVal);
            }
        });
    });
}

function getColIndexByKey(key) {
    const found = filterConfigs.find(c => c.key === key);
    return found ? found.col : -1;
}

function applyFilters() {
    // Standard filtering for the table using ALL active filters AND search
    filteredData = allData.filter(row => {
        // Search first (optimization)
        if (searchQuery) {
            const searchTerms = searchQuery.split(/\s+/);
            const rut = String(row[COL.RUT] || '').toLowerCase();
            const nombre = String(row[COL.NOMBRE] || '').toLowerCase();
            const fullText = rut + ' ' + nombre;

            const matches = searchTerms.every(term => fullText.includes(term));
            if (!matches) return false;
        }

        // Cargo Search
        if (searchCargoQuery) {
            const searchTerms = searchCargoQuery.split(/\s+/);
            const cargoIn = String(row[COL.CARGO_ENTRADA] || '').toLowerCase();
            const cargoOut = String(row[COL.CARGO_SALIDA] || '').toLowerCase();
            const fullText = cargoIn + ' ' + cargoOut;

            const matches = searchTerms.every(term => fullText.includes(term));
            if (!matches) return false;
        }

        if (activeFilters.orgPadre.size > 0 && !activeFilters.orgPadre.has(row[COL.ORG_PADRE])) return false;
        if (activeFilters.organismo.size > 0 && !activeFilters.organismo.has(row[COL.ORGANISMO])) return false;
        if (activeFilters.anio.size > 0 && !activeFilters.anio.has(row[COL.ANIO])) return false;
        if (activeFilters.mes.size > 0 && !activeFilters.mes.has(row[COL.MES])) return false;
        if (activeFilters.anioSalida.size > 0 && !activeFilters.anioSalida.has(row[COL.ANIO_SALIDA])) return false;
        if (activeFilters.mesSalida.size > 0 && !activeFilters.mesSalida.has(row[COL.MES_SALIDA])) return false;
        if (activeFilters.tipoContrato.size > 0 && !activeFilters.tipoContrato.has(row[COL.TIPO_CONTRATO])) return false;
        if (activeFilters.tcSalida.size > 0 && !activeFilters.tcSalida.has(row[COL.TC_SALIDA])) return false;
        return true;
    });

    currentPage = 1;
    updateStats();
    sortData(); // Apply sort after filtering
    updateTable();
}

function handleSort(colKey) {
    if (currentSort.col === colKey) {
        // Toggle direction
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.col = colKey;
        currentSort.dir = 'asc';
    }
    sortData();
    updateTable();
    updateSortIcons();
}

function sortData() {
    if (!currentSort.col) return;

    const colIndex = COL[currentSort.col];
    const dir = currentSort.dir === 'asc' ? 1 : -1;

    filteredData.sort((a, b) => {
        let valA = a[colIndex];
        let valB = b[colIndex];

        // Handle null/undefined
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        // Numeric sort if applicable
        if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * dir;
        }

        // String sort
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return -1 * dir;
        if (strA > strB) return 1 * dir;
        return 0;
    });
}

function updateSortIcons() {
    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.col === currentSort.col) {
            th.classList.add(`sort-${currentSort.dir}`);
        }
    });
}

function updateStats() {
    const counts = {};
    const sums = {}; // Track sum of REM_BRUTA for each type
    let total = 0;

    // We also want total average
    let totalSum = 0;
    let totalCountWithRem = 0;

    filteredData.forEach(row => {
        let type = row[COL.TC_SALIDA] || row[COL.TIPO_CONTRATO] || 'Sin Clasificar';

        counts[type] = (counts[type] || 0) + 1;

        // Sum Remuneration
        let rem = row[COL.REM_BRUTA];
        if (typeof rem === 'number' && !isNaN(rem)) {
            sums[type] = (sums[type] || 0) + rem;
            totalSum += rem;
            totalCountWithRem++;
        }

        total++;
    });

    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const globalAvg = totalCountWithRem > 0 ? Math.round(totalSum / totalCountWithRem) : 0;
    const fmtMoney = (v) => '$ ' + v.toLocaleString('es-CL');

    let html = `
        <div class="stat-card total">
            <span class="stat-label">Total</span>
            <span class="stat-value">${total.toLocaleString()}</span>
            <span class="stat-subtext">Promedio: ${fmtMoney(globalAvg)}</span>
        </div>
    `;

    sortedKeys.forEach(key => {
        let cardClass = 'stat-card';
        const k = key.toLowerCase();
        if (k.includes('contrata')) cardClass += ' contrata';
        else if (k.includes('honorarios')) cardClass += ' honorarios';
        else if (k.includes('planta')) cardClass += ' planta';
        else if (k.includes('trabajo')) cardClass += ' cod-trabajo';

        const count = counts[key];
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

        // Calculate Avg for this group
        // Note: we can't assume all items in 'count' had a valid number, but usually yes. 
        // Ideally we track countWithRem per group. But let's assume valid records mostly have rem.
        // Actually safe way is to track count per group in same loop. 
        // But to keep it simple, we'll divide by the count of items in that group. 
        // If some items have NaN rem, they didn't add to sum, so avg might be slightly skewed if we divide by total count including NaNs.
        // Correct approach: track valid counts.

        // Let's re-loop or just accept small skews? No, let's do it right.
        // I will use a separate countsWithRem object.
    });

    // --- REDOLING LOGIC TO INCLUDE VALID REM COUNTS ---

    // Reset stats for re-calculation inside function
    const stats = {}; // { key: { count: 0, sum: 0, validRemCount: 0 } }

    total = 0;
    totalSum = 0;
    totalCountWithRem = 0;

    filteredData.forEach(row => {
        let type = row[COL.TC_SALIDA] || row[COL.TIPO_CONTRATO] || 'Sin Clasificar';

        if (!stats[type]) stats[type] = { count: 0, sum: 0, validRemCount: 0 };

        stats[type].count++;
        total++;

        let rem = row[COL.REM_BRUTA];
        if (typeof rem === 'number' && !isNaN(rem)) {
            stats[type].sum += rem;
            stats[type].validRemCount++;

            totalSum += rem;
            totalCountWithRem++;
        }
    });

    const sortedStatsKeys = Object.keys(stats).sort((a, b) => stats[b].count - stats[a].count);
    const globalAvgFinal = totalCountWithRem > 0 ? Math.round(totalSum / totalCountWithRem) : 0;

    html = `
        <div class="stat-card total">
            <span class="stat-label">Total</span>
            <span class="stat-value">${total.toLocaleString()}</span>
            <span class="stat-subtext">Registros Totales</span>
            <div class="stat-avg-container">
                <span class="stat-avg-label" style="color: rgba(255,255,255,0.8);">Prom. Bruta Salida</span>
                <span class="stat-avg-value" style="color:white;">${fmtMoney(globalAvgFinal)}</span>
            </div>
        </div>
    `;

    sortedStatsKeys.forEach(key => {
        let cardClass = 'stat-card';
        const k = key.toLowerCase();
        if (k.includes('contrata')) cardClass += ' contrata';
        else if (k.includes('honorarios')) cardClass += ' honorarios';
        else if (k.includes('planta')) cardClass += ' planta';
        else if (k.includes('trabajo')) cardClass += ' cod-trabajo';

        const data = stats[key];
        const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : 0;
        const avg = data.validRemCount > 0 ? Math.round(data.sum / data.validRemCount) : 0;

        html += `
            <div class="${cardClass}">
                <span class="stat-label">${key}</span>
                <span class="stat-value">${data.count.toLocaleString()}</span>
                <span class="stat-subtext">${percent}% del total</span>
                <div class="stat-avg-container">
                    <span class="stat-avg-label">Prom. Bruta Salida</span>
                    <span class="stat-avg-value">${fmtMoney(avg)}</span>
                </div>
            </div>
        `;
    });

    statsContainer.innerHTML = html;
}

function updateTable() {
    const totalRecords = filteredData.length;
    els.recordCount.textContent = `${totalRecords.toLocaleString()} Registros`;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredData.slice(start, end);

    els.tableBody.innerHTML = pageData.map((row, index) => {
        const formatMoney = (val) => {
            if (typeof val === 'number') return '$ ' + val.toLocaleString('es-CL');
            return val;
        };

        const fechaSalida = (row[COL.MES_SALIDA] && row[COL.ANIO_SALIDA])
            ? `${String(row[COL.MES_SALIDA]).substring(0, 3)}-${row[COL.ANIO_SALIDA]}`
            : '-';

        let badgeClass = 'badge';
        const tc = String(row[COL.TC_SALIDA] || '').toLowerCase();
        if (tc.includes('contrata')) badgeClass += ' badge-contrata';
        else if (tc.includes('honorarios')) badgeClass += ' badge-honorarios';
        else if (tc.includes('planta')) badgeClass += ' badge-planta';
        else if (tc.includes('trabajo')) badgeClass += ' badge-cod-trabajo';

        let badgeClassEntrada = 'badge';
        const tcEntrada = String(row[COL.TIPO_CONTRATO] || '').toLowerCase();

        if (tcEntrada.includes('contrata')) badgeClassEntrada += ' badge-contrata';
        else if (tcEntrada.includes('honorarios')) badgeClassEntrada += ' badge-honorarios';
        else if (tcEntrada.includes('planta')) badgeClassEntrada += ' badge-planta';
        else if (tcEntrada.includes('trabajo')) badgeClassEntrada += ' badge-cod-trabajo';

        let calificacion = row[COL.CALIFICACION];
        if (calificacion === 0 || calificacion === "0") {
            calificacion = "Sin Clasificar";
        }



        // Use index to identify row later if needed, but easier to pass full object on click
        // To attach click listener to dynamic row, we can use event delegation on tbody or attach here.
        // Attaching simple inline onclick is messy with objects. 
        // Best approach: Add data-index to TR.
        // We need the index relative to filteredData? Yes.
        const rowIndex = start + index;

        return `
            <tr onclick="showDetails(${rowIndex})">
                <td>${row[COL.RUT] || ''}</td>
                <td title="${row[COL.NOMBRE]}">${row[COL.NOMBRE] || ''}</td>
                <td>${row[COL.ORG_PADRE] || ''}</td>
                <td>${row[COL.ORGANISMO] || ''}</td>
                <td>${calificacion || ''}</td>
                <td>${row[COL.EDAD] || ''}</td>
                <td>${row[COL.ANIO] || ''}</td>
                <td>${row[COL.MES] || ''}</td>
                <td><span class="${badgeClassEntrada}">${row[COL.TIPO_CONTRATO] || ''}</span></td>
                <td>${fechaSalida}</td>
                <td>${row[COL.PAGOS] || '0'}</td>
                <td><span class="${badgeClass}">${row[COL.TC_SALIDA] || ''}</span></td>
                <td style="text-align:right">${formatMoney(row[COL.REM_BRUTA])}</td>
            </tr>
        `;
    }).join('');

    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
    els.pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1}`;
    els.prevBtn.disabled = currentPage <= 1;
    els.nextBtn.disabled = currentPage >= totalPages;
}

els.prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updateTable();
    }
});

els.nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    if (currentPage < totalPages) {
        currentPage++;
        updateTable();
    }
});

// Modal Functions
function showDetails(index) {
    // index is relative to filteredData because we used mapped index from pageData + start offset?
    // Wait, in map(row, index), index is 0..100.
    // rowIndex passed was start + index.

    // Safety check
    if (index < 0 || index >= filteredData.length) return;

    const row = filteredData[index];

    // Generate HTML for all fields
    // We can iterate over COL to get labels? 
    // Or just list them manually for better order.

    const money = (val) => (typeof val === 'number') ? '$ ' + val.toLocaleString('es-CL') : val;
    const date = (val) => {
        if (!val) return '-';
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        // Use UTC components to avoid timezone shift
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}-${month}-${year}`;
    };

    // 1. Single Fields Config
    const singleFields = [
        { idx: 16, label: 'Código Organismo Padre' },
        { idx: 17, label: 'Organismo Padre' },
        { idx: 0, label: 'Código Organismo' },
        { idx: 1, label: 'Organismo' },
        { idx: 8, label: 'RUT' },
        { idx: 9, label: 'Nombre' },
        { idx: 7, label: 'Nombre Base Datos' },
        { idx: 26, label: 'Número de Pagos' },
        { idx: 11, label: 'Clase de Edad' },
        { idx: 12, label: 'Sexo' },
        { idx: 18, label: 'Es Municipal' },
    ];

    // 2. Paired Fields Config (Label | In Index | Out Index)
    const pairedFields = [
        { label: 'Año', idxIn: 2, idxOut: 19 },
        { label: 'Mes', idxIn: 3, idxOut: 20 },
        { label: 'Fecha', idxIn: 13, idxOut: 25 },
        { label: 'Tipo Contrato', idxIn: 6, idxOut: 23 },
        { label: 'Calificación', idxIn: 10, idxOut: 24 },
        { label: 'Cargo', idxIn: 27, idxOut: 28 },
        { label: 'Remuneración Bruta', idxIn: 4, idxOut: 21 },
        { label: 'Remuneración Líquida', idxIn: 5, idxOut: 22 },
    ];

    let html = '';

    // -- Render Single Fields --
    singleFields.forEach(config => {
        const i = config.idx;
        let val = row[i];
        if (i < row.length) {
            if (val === null || val === undefined || val === '') val = '-';
            html += `
                <div class="detail-row">
                    <span class="detail-label">${config.label}</span>
                    <span class="detail-value">${val}</span>
                </div>
            `;
        }
    });

    // -- Render Comparison Header --
    html += `
        <div class="comparison-header">
            <span class="pair-label">Campo Comparado</span>
            <span class="pair-value-col">Entrada (Inicio)</span>
            <span class="pair-value-col">Salida (Término)</span>
        </div>
    `;

    // -- Render Paired Fields --
    pairedFields.forEach(pair => {
        let valIn = row[pair.idxIn];
        let valOut = row[pair.idxOut];

        // Format Helper
        const formatVal = (i, v) => {
            if ([4, 5, 21, 22].includes(i)) return money(v);
            if ([13, 25].includes(i)) return date(v);
            if ((i === 10 || i === 24) && (v === 0 || v === '0')) return 'Sin Clasificar';
            if (v === null || v === undefined || v === '') return '-';
            return v;
        };

        valIn = formatVal(pair.idxIn, valIn);
        valOut = formatVal(pair.idxOut, valOut);

        html += `
            <div class="detail-pair-row">
                <span class="pair-label">${pair.label}</span>
                <span class="pair-value-col entry">${valIn}</span>
                <span class="pair-value-col exit">${valOut}</span>
            </div>
        `;
    });

    els.modalBody.innerHTML = html;
    els.modal.classList.remove('hidden');
}

window.showDetails = showDetails; // Expose to global scope for inline onclick

function closeModal() {
    els.modal.classList.add('hidden');
}

// Start
init();
