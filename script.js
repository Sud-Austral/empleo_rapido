
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
    REM_BRUTA: 21
};

let allData = [];
let filteredData = [];
const PAGE_SIZE = 100;
let currentPage = 1;
let searchQuery = '';
let searchDebounceTimer;

// Global state for selected filters
const activeFilters = {
    orgPadre: new Set(),
    organismo: new Set(),
    anio: new Set(),
    mes: new Set(),
    anioSalida: new Set(),
    mesSalida: new Set(),
    tipoContrato: new Set()
};

// DOM Elements
const els = {
    tableBody: document.getElementById('table-body'),
    recordCount: document.getElementById('record-count'),
    prevBtn: document.getElementById('prev-page'),
    nextBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    searchInput: document.getElementById('search-input'),
    filters: {
        orgPadre: document.getElementById('filter-org-padre'),
        organismo: document.getElementById('filter-organismo'),
        anio: document.getElementById('filter-anio'),
        mes: document.getElementById('filter-mes'),
        anioSalida: document.getElementById('filter-anio-salida'),
        mesSalida: document.getElementById('filter-mes-salida'),
        tipoContrato: document.getElementById('filter-tipo-contrato'),
    }
};

// Helper for filter configs
const filterConfigs = [
    { key: 'orgPadre', col: COL.ORG_PADRE, el: els.filters.orgPadre },
    { key: 'organismo', col: COL.ORGANISMO, el: els.filters.organismo },
    { key: 'anio', col: COL.ANIO, el: els.filters.anio },
    { key: 'mes', col: COL.MES, el: els.filters.mes },
    { key: 'anioSalida', col: COL.ANIO_SALIDA, el: els.filters.anioSalida },
    { key: 'mesSalida', col: COL.MES_SALIDA, el: els.filters.mesSalida },
    { key: 'tipoContrato', col: COL.TIPO_CONTRATO, el: els.filters.tipoContrato },
];

async function init() {
    try {
        els.recordCount.textContent = 'Cargando datos (esto puede tardar unos segundos)...';
        const response = await fetch('data.json');

        if (!response.ok) throw new Error('No se pudo cargar data.json');

        const json = await response.json();
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


    } catch (e) {
        console.error(e);
        els.recordCount.textContent = 'Error cargando datos.';
        alert('Error cargando data.json. Asegúrate de ejecutar esto en un servidor local.');
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

        if (activeFilters.orgPadre.size > 0 && !activeFilters.orgPadre.has(row[COL.ORG_PADRE])) return false;
        if (activeFilters.organismo.size > 0 && !activeFilters.organismo.has(row[COL.ORGANISMO])) return false;
        if (activeFilters.anio.size > 0 && !activeFilters.anio.has(row[COL.ANIO])) return false;
        if (activeFilters.mes.size > 0 && !activeFilters.mes.has(row[COL.MES])) return false;
        if (activeFilters.anioSalida.size > 0 && !activeFilters.anioSalida.has(row[COL.ANIO_SALIDA])) return false;
        if (activeFilters.mesSalida.size > 0 && !activeFilters.mesSalida.has(row[COL.MES_SALIDA])) return false;
        if (activeFilters.tipoContrato.size > 0 && !activeFilters.tipoContrato.has(row[COL.TIPO_CONTRATO])) return false;
        return true;
    });

    currentPage = 1;
    updateStats();
    updateTable();
}

function updateStats() {
    const counts = {};
    let total = 0;

    filteredData.forEach(row => {
        let type = row[COL.TC_SALIDA] || row[COL.TIPO_CONTRATO] || 'Sin Clasificar';
        counts[type] = (counts[type] || 0) + 1;
        total++;
    });

    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    let html = `
        <div class="stat-card total">
            <span class="stat-label">Total</span>
            <span class="stat-value">${total.toLocaleString()}</span>
        </div>
    `;

    sortedKeys.forEach(key => {
        html += `
            <div class="stat-card">
                <span class="stat-label">${key}</span>
                <span class="stat-value">${counts[key].toLocaleString()}</span>
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

    els.tableBody.innerHTML = pageData.map(row => {
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

        return `
            <tr>
                <td>${row[COL.RUT] || ''}</td>
                <td title="${row[COL.NOMBRE]}">${row[COL.NOMBRE] || ''}</td>
                <td>${row[COL.CALIFICACION] || ''}</td>
                <td>${row[COL.EDAD] || ''}</td>
                <td>${row[COL.ANIO] || ''}</td>
                <td>${row[COL.MES] || ''}</td>
                <td>${row[COL.TIPO_CONTRATO] || ''}</td>
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

// Start
init();
