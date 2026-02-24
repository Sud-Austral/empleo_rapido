
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
    calificacion: new Set(),
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
        calificacion: document.getElementById('filter-calificacion'),
        tcSalida: document.getElementById('filter-tc-salida'),
    },
    btnDownload: document.getElementById('btn-download'),
    sidebarPanel: document.getElementById('filters-panel'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    paginationNumbers: document.getElementById('pagination-numbers'),
    filterSearches: {
        organismo: document.getElementById('search-filter-organismo'),
        calificacion: document.getElementById('search-filter-calificacion'),
    }
};

const filterSearchQueries = {
    organismo: '',
    calificacion: '',
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
    { key: 'calificacion', col: COL.CALIFICACION, el: els.filters.calificacion },
    { key: 'tcSalida', col: COL.TC_SALIDA, el: els.filters.tcSalida },
];

async function init() {
    try {
        els.recordCount.textContent = 'Cargando datos municipales (esto puede tardar unos segundos)...';
        const response = await fetch('../data2_muni.json.gz');

        if (!response.ok) throw new Error('No se pudo cargar data2_muni.json.gz');

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

        // Sidebar Toggle (Desktop)
        if (els.sidebarToggle) {
            els.sidebarToggle.addEventListener('click', () => {
                els.sidebarPanel.classList.toggle('collapsed');
            });
        }

        // Mobile Filter Drawer logic
        const mobileFilterBtn = document.getElementById('mobile-filter-btn');
        const closeFiltersMobile = document.getElementById('close-filters-mobile');
        if (mobileFilterBtn) {
            mobileFilterBtn.addEventListener('click', () => {
                els.sidebarPanel.classList.add('open');
            });
        }
        if (closeFiltersMobile) {
            closeFiltersMobile.addEventListener('click', () => {
                els.sidebarPanel.classList.remove('open');
            });
        }

        // Filter Search Listeners
        Object.keys(els.filterSearches).forEach(key => {
            const input = els.filterSearches[key];
            if (input) {
                input.addEventListener('input', (e) => {
                    filterSearchQueries[key] = e.target.value.toLowerCase().trim();
                    renderAllFilters();
                });
            }
        });

    } catch (e) {
        console.error(e);
        els.recordCount.textContent = 'Error cargando datos.';
        alert('Error cargando data2_muni.json.gz. Asegúrate de que el navegador soporte DecompressionStream.');
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
                // Add labels for better UX
                let label = key;
                if (key === 'orgPadre') label = 'Org Padre';
                else if (key === 'anio') label = 'Año';
                else if (key === 'mes') label = 'Mes';

                chip.innerHTML = `
                    <span style="color:var(--text-secondary); margin-right:4px;">${label}:</span>
                    <span>${val}</span>
                    <div class="remove-filter" title="Quitar filtro">
                        &times;
                    </div>
                `;
                // Add click listener to remove
                chip.querySelector('.remove-filter').addEventListener('click', () => {
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

        // Update Badge
        const badge = document.getElementById(`count-${targetConfig.key}`);
        if (badge) {
            const count = activeFilters[targetConfig.key].size;
            badge.textContent = count;
            badge.classList.toggle('active', count > 0);
        }

        // 3. Render the list
        targetConfig.el.innerHTML = '';

        const searchQueryForFilter = filterSearchQueries[targetConfig.key] || '';

        sortedValues.forEach(val => {
            if (searchQueryForFilter && !String(val).toLowerCase().includes(searchQueryForFilter)) {
                return;
            }

            const div = document.createElement('div');
            div.className = 'filter-item';
            if (activeFilters[targetConfig.key].has(val)) {
                div.classList.add('selected');
            }
            div.textContent = val;
            div.onclick = () => toggleFilter(targetConfig.key, val, div);
            targetConfig.el.appendChild(div);
        });

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
        if (activeFilters.calificacion.size > 0 && !activeFilters.calificacion.has(row[COL.CALIFICACION])) return false;
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
    const stats = {};
    let total = 0;
    let totalSum = 0;
    let totalCountWithRem = 0;
    let totalAgeSum = 0;
    let totalAgeCount = 0;

    const parseAgeStr = (str) => {
        if (!str) return null;
        const s = String(str).toUpperCase();
        if (s.includes('ENTRE')) {
            const matches = s.match(/\d+/g);
            if (matches && matches.length >= 2) return (parseInt(matches[0]) + parseInt(matches[1])) / 2;
        }
        if (s.includes('MENOR')) return 18;
        if (s.includes('MAYOR')) return 65;
        const n = parseInt(s);
        return isNaN(n) ? null : n;
    };

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

        let age = parseAgeStr(row[COL.EDAD]);
        if (age) {
            totalAgeSum += age;
            totalAgeCount++;
        }
    });

    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    const sortedStatsKeys = Object.keys(stats).sort((a, b) => stats[b].count - stats[a].count);
    const globalAvgFinal = totalCountWithRem > 0 ? Math.round(totalSum / totalCountWithRem) : 0;
    const globalAvgAge = totalAgeCount > 0 ? Math.round(totalAgeSum / totalAgeCount) : 0;
    const fmtMoney = (v) => '$ ' + v.toLocaleString('es-CL');

    let html = `
        <div class="stat-card total">
            <span class="stat-value">${total.toLocaleString()}</span>
            <span class="stat-label">Personas registradas</span>
            <div style="margin-top:auto; padding-top:1rem; display:flex; gap:1rem; font-size:0.75rem; color:var(--text-secondary);">
                <div>Prom. Bruta: <b>${fmtMoney(globalAvgFinal)}</b></div>
                <div>Edad Prom.: <b>${globalAvgAge} años</b></div>
            </div>
        </div>
    `;

    // Only show top 3 types in KPIs to avoid overcrowding
    sortedStatsKeys.slice(0, 3).forEach(key => {
        let cardClass = 'stat-card';
        const k = key.toLowerCase();
        if (k.includes('contrata')) cardClass += ' contrata';
        else if (k.includes('honorarios')) cardClass += ' honorarios';
        else if (k.includes('planta')) cardClass += ' planta';
        else if (k.includes('trabajo')) cardClass += ' cod-trabajo';

        const data = stats[key];
        const avg = data.validRemCount > 0 ? Math.round(data.sum / data.validRemCount) : 0;

        html += `
            <div class="${cardClass}">
                <span class="stat-value">${data.count.toLocaleString()}</span>
                <span class="stat-label">${key}</span>
                <div style="margin-top:auto; padding-top:1rem; font-size:0.75rem; color:var(--text-secondary);">
                    Promedio: <b>${fmtMoney(avg)}</b>
                </div>
            </div>
        `;
    });

    statsContainer.innerHTML = html;
}

function updateTable() {
    const totalRecords = filteredData.length;
    els.recordCount.textContent = `${totalRecords.toLocaleString()} resultados encontrados`;

    // Show Skeleton State
    els.tableBody.innerHTML = Array(10).fill(0).map(() => `
        <tr class="skeleton-row">
            <td colspan="13"><div class="skeleton" style="height: 20px; width: 100%;"></div></td>
        </tr>
    `).join('');

    // Small delay to simulate load and show shimmer
    setTimeout(() => {
        if (totalRecords === 0) {
            els.tableBody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 3rem;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span style="font-size: 1rem; font-weight: 500;">No se encontraron coincidencias</span>
                            <span style="font-size: 0.85rem;">Intenta ajustar los filtros o tu búsqueda.</span>
                        </div>
                    </td>
                </tr>
            `;
            els.pageInfo.textContent = `Página 0 de 0`;
            els.prevBtn.disabled = true;
            els.nextBtn.disabled = true;
            if (els.paginationNumbers) els.paginationNumbers.innerHTML = '';
            return;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = filteredData.slice(start, end);

        els.tableBody.innerHTML = pageData.map((row, index) => {
            const g = (i) => {
                let v = row[i];
                return (v === null || v === undefined) ? "" : v;
            };

            const formatMoney = (val) => {
                if (typeof val === 'number') return '$ ' + val.toLocaleString('es-CL');
                return val || "";
            };

            const fechaSalida = (g(COL.MES_SALIDA) && g(COL.ANIO_SALIDA))
                ? `${String(g(COL.MES_SALIDA)).substring(0, 3)}-${g(COL.ANIO_SALIDA)}`
                : '-';

            let badgeClass = 'badge';
            const tc = String(g(COL.TC_SALIDA)).toLowerCase();
            if (tc.includes('contrata')) badgeClass += ' badge-contrata';
            else if (tc.includes('honorarios')) badgeClass += ' badge-honorarios';
            else if (tc.includes('planta')) badgeClass += ' badge-planta';
            else if (tc.includes('trabajo')) badgeClass += ' badge-cod-trabajo';

            let badgeClassEntrada = 'badge';
            const tcEntrada = String(g(COL.TIPO_CONTRATO)).toLowerCase();

            if (tcEntrada.includes('contrata')) badgeClassEntrada += ' badge-contrata';
            else if (tcEntrada.includes('honorarios')) badgeClassEntrada += ' badge-honorarios';
            else if (tcEntrada.includes('planta')) badgeClassEntrada += ' badge-planta';
            else if (tcEntrada.includes('trabajo')) badgeClassEntrada += ' badge-cod-trabajo';

            let calificacion = g(COL.CALIFICACION);
            if (calificacion === 0 || calificacion === "0") {
                calificacion = "Sin Clasificar";
            }

            const rowIndex = start + index;

            return `
                <tr onclick="showDetails(${rowIndex})">
                    <td>${g(COL.RUT)}</td>
                    <td title="${g(COL.NOMBRE)}">${g(COL.NOMBRE)}</td>
                    <td>${g(COL.ORG_PADRE)}</td>
                    <td>${g(COL.ORGANISMO)}</td>
                    <td>${calificacion}</td>
                    <td>${g(COL.EDAD)}</td>
                    <td>${g(COL.ANIO)}</td>
                    <td>${g(COL.MES)}</td>
                    <td><span class="${badgeClassEntrada}">${g(COL.TIPO_CONTRATO)}</span></td>
                    <td>${fechaSalida}</td>
                    <td>${g(COL.PAGOS) || '0'}</td>
                    <td><span class="${badgeClass}">${g(COL.TC_SALIDA)}</span></td>
                    <td style="text-align:right">${formatMoney(g(COL.REM_BRUTA))}</td>
                </tr>
            `;
        }).join('');

        const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
        els.pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1}`;
        els.prevBtn.disabled = currentPage <= 1;
        els.nextBtn.disabled = currentPage >= totalPages;

        renderPaginationNumbers(totalPages);
    }, 300);
}

function renderPaginationNumbers(totalPages) {
    if (!els.paginationNumbers) return;
    els.paginationNumbers.innerHTML = '';

    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
        const span = document.createElement('div');
        span.className = `page-num ${i === currentPage ? 'active' : ''}`;
        span.textContent = i;
        span.onclick = () => {
            currentPage = i;
            updateTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        els.paginationNumbers.appendChild(span);
    }
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
