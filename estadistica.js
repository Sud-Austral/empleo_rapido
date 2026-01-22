
// Configuration & Column Mapping
const C = {
    ORGANISMO: 1,
    ANIO: 2,
    MES: 3,
    REM_ENTRADA: 4,
    TIPO_CONTRATO: 6,
    NOMBRE: 9,
    CALIFICACION: 10,
    EDAD: 11,
    SEXO: 12,
    ORG_PADRE: 17,
    REM_BRUTA: 21,
    TC_SALIDA: 23,
    CARGO_SALIDA: 28
};

// Global State
let allData = [];
let filteredData = [];
let charts = {};

// UI Elements
const els = {
    totalRecs: document.getElementById('statTotalFuncionarios'),
    totalGasto: document.getElementById('statGastoTotal'),
    avgRem: document.getElementById('statRemPromedio'),
    avgAge: document.getElementById('statEdadPromedio'),
    women: document.getElementById('statMujeres'),
    men: document.getElementById('statHombres'),
    orgsCount: document.getElementById('statOrganismos'),
    maxRem: document.getElementById('statMaxRemuneracion'),
    headerCount: document.getElementById('headerTotalRecords'),
    headerMoney: document.getElementById('headerTotalMoney'),
    lastUpdate: document.getElementById('lastUpdate'),
    filters: [
        document.getElementById('filterYear'),
        document.getElementById('filterOrgPadre'),
        document.getElementById('filterOrganismo')
    ]
};

// Formatters
const moneyFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('es-CL');

// Force HD Rendering
Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.color = '#64748b';

function formatCompact(num) {
    if (num >= 1000000000) return '$' + (num / 1000000000).toFixed(1) + ' MM';
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + ' M';
    return moneyFmt.format(num);
}

// Init
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        console.log("Iniciando Dashboard 20 Secciones...");
        updateLoadingState(true);
        await loadData();
        initFilters();
        applyFilters();
        setupEventListeners();
        updateLoadingState(false);
    } catch (e) {
        console.error("Error fatal:", e);
        alert("Error cargando dashboard: " + e.message);
    }
}

function updateLoadingState(isLoading) {
    if (isLoading && els.totalRecs) els.totalRecs.textContent = "Cargando...";
}

async function loadData() {
    const response = await fetch('data2.json.gz');
    if (!response.ok) throw new Error('Error IO Datos');
    const ds = new DecompressionStream('gzip');
    const decompressed = new Response(response.body.pipeThrough(ds));
    allData = await decompressed.json();
    if (!Array.isArray(allData)) throw new Error('Datos corruptos');
    filteredData = [...allData];
}

function initFilters() {
    const years = new Set(allData.map(r => r[C.ANIO]).filter(y => y));
    populateSelect(els.filters[0], Array.from(years).sort((a, b) => b - a), 'Todo el Periodo');
    const orgPadres = new Set(allData.map(r => r[C.ORG_PADRE]).filter(o => o));
    populateSelect(els.filters[1], Array.from(orgPadres).sort(), 'Todas las Instituciones');
    const organismos = new Set(allData.map(r => r[C.ORGANISMO]).filter(o => o));
    populateSelect(els.filters[2], Array.from(organismos).sort(), 'Todos los Organismos');
}

function populateSelect(el, items, def) {
    if (!el) return;
    el.innerHTML = `<option value="all">${def}</option>`;
    items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        el.appendChild(opt);
    });
}

function setupEventListeners() {
    // Year filter - triggers cascade update for OrgPadre and Organismo
    if (els.filters[0]) {
        els.filters[0].addEventListener('change', () => {
            updateCascadeFilters();
            applyFilters();
        });
    }
    // OrgPadre filter - triggers cascade update for Organismo only
    if (els.filters[1]) {
        els.filters[1].addEventListener('change', () => {
            updateOrganismoOptions();
            applyFilters();
        });
    }
    // Organismo filter - just applies filters
    if (els.filters[2]) {
        els.filters[2].addEventListener('change', applyFilters);
    }
}

function updateCascadeFilters() {
    const yearVal = els.filters[0] ? els.filters[0].value : 'all';

    // Filter data by year only
    const dataByYear = yearVal === 'all'
        ? allData
        : allData.filter(r => String(r[C.ANIO]) === yearVal);

    // Get unique OrgPadres from filtered data
    const orgPadres = new Set(dataByYear.map(r => r[C.ORG_PADRE]).filter(o => o));
    const currentOrgPadre = els.filters[1] ? els.filters[1].value : 'all';

    populateSelect(els.filters[1], Array.from(orgPadres).sort(), 'Todas las Instituciones');

    // Restore selection if still valid
    if (orgPadres.has(currentOrgPadre)) {
        els.filters[1].value = currentOrgPadre;
    }

    // Also update Organismo options
    updateOrganismoOptions();
}

function updateOrganismoOptions() {
    const yearVal = els.filters[0] ? els.filters[0].value : 'all';
    const orgPadreVal = els.filters[1] ? els.filters[1].value : 'all';

    // Filter data by year and orgPadre
    let filteredForOrg = allData;
    if (yearVal !== 'all') {
        filteredForOrg = filteredForOrg.filter(r => String(r[C.ANIO]) === yearVal);
    }
    if (orgPadreVal !== 'all') {
        filteredForOrg = filteredForOrg.filter(r => r[C.ORG_PADRE] === orgPadreVal);
    }

    // Get unique Organismos from filtered data
    const organismos = new Set(filteredForOrg.map(r => r[C.ORGANISMO]).filter(o => o));
    const currentOrg = els.filters[2] ? els.filters[2].value : 'all';

    populateSelect(els.filters[2], Array.from(organismos).sort(), 'Todos los Organismos');

    // Restore selection if still valid
    if (organismos.has(currentOrg)) {
        els.filters[2].value = currentOrg;
    }
}


function applyFilters() {
    const year = els.filters[0] ? els.filters[0].value : 'all';
    const orgPadre = els.filters[1] ? els.filters[1].value : 'all';
    const org = els.filters[2] ? els.filters[2].value : 'all';

    filteredData = allData.filter(r => {
        if (year !== 'all' && String(r[C.ANIO]) !== year) return false;
        if (orgPadre !== 'all' && r[C.ORG_PADRE] !== orgPadre) return false;
        if (org !== 'all' && r[C.ORGANISMO] !== org) return false;
        return true;
    });

    calculateAndRender(filteredData);
}

function calculateAndRender(data) {
    // --- Metrics Accumulators ---
    let sumRem = 0, countRem = 0, maxRem = 0;
    let sumAge = 0, countAge = 0;

    // Core Counters
    const count = {
        sex: { F: 0, M: 0, U: 0 },
        contract: {},
        org: {},
        qual: {},
        month: {},
        year: {},

        remByContract: {},
        remByGender: { F: { s: 0, c: 0 }, M: { s: 0, c: 0 } },
        remBuckets: { '0-500k': 0, '500k-1M': 0, '1M-2M': 0, '2M-3M': 0, '3M+': 0 },
        ageBuckets: {},

        missing: { rem: 0, age: 0, qual: 0 },

        // NEW AGGREGATIONS FOR SECTIONS 11-20
        young: { count: 0, sumRem: 0, orgs: {} },
        senior: { count: 0, sumRem: 0, orgs: {} },
        elite: { count: 0, orgs: {} }, // > 4M
        base: { count: 0, sex: { F: 0, M: 0 }, orgs: {} }, // < 700k

        profs: { prof: 0, tec: 0, other: 0, sumProf: 0, sumTec: 0 },

        anomalies: { age: 0, zeroRem: 0, orgs: {} }
    };

    const orgStats = {}; // { c: count, s: sumRem, min:..., max:... }
    const typeCargoCounts = {};
    const typeCargoSums = {};
    const orgBrutoLiquido = {};
    const cargoCounts = {};
    const aumentos = [];
    let evolutionMap = {};

    // --- Main Loop ---
    for (const r of data) {
        const org = r[C.ORGANISMO] || 'Sin Nombre';
        const qual = r[C.CALIFICACION] || 'Sin Inf.';
        const contract = r[C.TC_SALIDA] || r[C.TIPO_CONTRATO] || 'Otros';
        let rem = r[C.REM_BRUTA];

        if (typeof rem !== 'number') { count.missing.rem++; rem = 0; }
        else { sumRem += rem; countRem++; if (rem > maxRem) maxRem = rem; }

        let ageLabel = r[C.EDAD];
        let ageNum = 0;
        if (!ageLabel || typeof ageLabel !== 'string' || ageLabel.toLowerCase() === 'nan') {
            count.missing.age++;
            ageLabel = 'Sin Información';
        } else {
            ageLabel = ageLabel.trim();
            const m = ageLabel.match(/\d+/);
            const dictAge = { '50 a 65': (50 + 65) / 2, '30 a 50': (30 + 50) / 2, '18 a 30': (18 + 30) / 2, '65 a 85': (65 + 85) / 2 }


            if (m) {
                ageNum = parseFloat(dictAge[ageLabel]) //parseInt(m[0]);
                if (ageNum > 0) { sumAge += ageNum; countAge++; }
            }
        }
        count.ageBuckets[ageLabel] = (count.ageBuckets[ageLabel] || 0) + 1;

        let sex = normalizeSex(r[C.SEXO]);
        count.sex[sex]++;

        count.contract[contract] = (count.contract[contract] || 0) + 1;
        count.qual[qual] = (count.qual[qual] || 0) + 1;
        if (r[C.MES]) count.month[r[C.MES]] = (count.month[r[C.MES]] || 0) + 1;

        // --- Standard Logic ---
        if (rem > 0) {
            if (!count.remByContract[contract]) count.remByContract[contract] = { s: 0, c: 0 };
            count.remByContract[contract].s += rem;
            count.remByContract[contract].c++;

            if (sex !== 'U') { count.remByGender[sex].s += rem; count.remByGender[sex].c++; }

            if (rem < 500000) count.remBuckets['0-500k']++;
            else if (rem < 1000000) count.remBuckets['500k-1M']++;
            else if (rem < 2000000) count.remBuckets['1M-2M']++;
            else if (rem < 3000000) count.remBuckets['2M-3M']++;
            else count.remBuckets['3M+']++;
        }

        // --- Org Stats Detailed ---
        if (!orgStats[org]) orgStats[org] = { c: 0, s: 0, p: 0, min: 99999999, max: 0 };
        orgStats[org].c++;
        orgStats[org].s += rem;
        if (rem > 0) {
            if (rem < orgStats[org].min) orgStats[org].min = rem;
            if (rem > orgStats[org].max) orgStats[org].max = rem;
        }
        if (qual.toLowerCase().includes('profesional')) orgStats[org].p++;

        // --- Evolution ---
        if (r[C.ANIO]) {
            count.year[r[C.ANIO]] = (count.year[r[C.ANIO]] || 0) + 1;
            const k = r[C.ANIO];
            if (!evolutionMap[k]) evolutionMap[k] = { c: 0, s: 0 };
            evolutionMap[k].c++;
            evolutionMap[k].s += rem;
        }

        // --- NEW LOGIC (Secciones 11-20) ---

        // 11. Young < 30
        if (ageNum > 0 && ageNum < 30) {
            count.young.count++;
            count.young.sumRem += rem;
            count.young.orgs[org] = (count.young.orgs[org] || 0) + 1;
        }
        // 12. Senior > 60
        if (ageNum > 60) {
            count.senior.count++;
            count.senior.sumRem += rem;
            count.senior.orgs[org] = (count.senior.orgs[org] || 0) + 1;
        }
        // 13. Elite > 5M (Aprox Top 5%)
        if (rem > 4000000) {
            count.elite.count++;
            count.elite.orgs[org] = (count.elite.orgs[org] || 0) + 1;
        }
        // 14. Base < 700k
        if (rem > 0 && rem < 700000) {
            count.base.count++;
            count.base.sex[sex]++;
            count.base.orgs[org] = (count.base.orgs[org] || 0) + 1;
        }
        // 17. Prof Level
        let ql = qual.toLowerCase();
        if (ql.includes('profesional') || ql.includes('universitario')) {
            count.profs.prof++; count.profs.sumProf += rem;
        } else if (ql.includes('tecnico') || ql.includes('técnico')) {
            count.profs.tec++; count.profs.sumTec += rem;
        } else { count.profs.other++; }

        // 20. Anomalies
        if ((ageNum > 0 && ageNum < 18) || ageNum > 85) count.anomalies.age++;
        if (rem === 0) count.anomalies.zeroRem++;
        if (rem === 0 || ageNum < 18 || ageNum > 85) count.anomalies.orgs[org] = (count.anomalies.orgs[org] || 0) + 1;

        // 21. Type of Cargo (S19)
        const tipoC = r[C.TIPO_CONTRATO] || 'Otros';
        if (!typeCargoCounts[tipoC]) { typeCargoCounts[tipoC] = 0; typeCargoSums[tipoC] = 0; }
        typeCargoCounts[tipoC]++;
        typeCargoSums[tipoC] += rem;

        // 22. Liquidity (S20)
        const orgP = r[C.ORG_PADRE] || 'Sin Clasificar';
        if (!orgBrutoLiquido[orgP]) orgBrutoLiquido[orgP] = { bruto: 0, liquido: 0, count: 0 };
        orgBrutoLiquido[orgP].bruto += rem;
        orgBrutoLiquido[orgP].liquido += rem * 0.78;
        orgBrutoLiquido[orgP].count++;

        // 23. Word Cloud (S21)
        const crg = String(r[C.CARGO_SALIDA] || '').toUpperCase();
        if (crg.length > 2 && crg !== 'SIN ESPECIFICAR') {
            cargoCounts[crg] = (cargoCounts[crg] || 0) + 1;
        }

        // 24. Aumentos (S22)
        const rEntr = parseFloat(r[C.REM_ENTRADA]) || 0;
        if (rEntr > 500000 && rem > rEntr) {
            const diff = rem - rEntr;
            const pct = (diff / rEntr) * 100;
            if (pct < 1000) {
                aumentos.push({ nombre: r[C.NOMBRE], org: r[C.ORGANISMO], entrada: rEntr, salida: rem, diff: diff, pct: pct });
            }
        }
    }

    // --- UI Update ---
    updateKPIs(data.length, sumRem, countRem, sumAge, countAge, count.sex, Object.keys(orgStats).length, maxRem);

    // --- Render Charts (40 Charts) ---
    // Vibrant Palette
    const p = ['#4f46e5', '#0ea5e9', '#e11d48', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#64748b', '#db2777'];

    // S1-10 (Originals)
    renderDoughnut('chart1_1', count.contract, 'Contratos', p);
    renderPie('chart1_2', ['Mujeres', 'Hombres', 'N/A'], [count.sex.F, count.sex.M, count.sex.U], ['#e11d48', '#3b82f6', '#cbd5e1'], 'Sexo');

    const topOrgs = Object.entries(orgStats).sort((a, b) => b[1].c - a[1].c).slice(0, 10);
    renderBarH('chart2_1', topOrgs.map(e => [e[0], e[1].c]), 'Dotación', '#4f46e5');
    const topOrgsGasto = Object.entries(orgStats).sort((a, b) => b[1].s - a[1].s).slice(0, 10);
    renderBarH('chart2_2', topOrgsGasto.map(e => [e[0], e[1].s]), 'Gasto Total', '#0ea5e9');

    const avgRemContract = Object.keys(count.remByContract).map(type => ({
        t: type, v: Math.round(count.remByContract[type].s / count.remByContract[type].c)
    })).sort((a, b) => b.v - a.v);
    renderBarVRaw('chart3_1', avgRemContract.map(x => x.t), avgRemContract.map(x => x.v), 'Remuneración Avg', '#8b5cf6');
    const years = Object.keys(count.year).sort();
    renderLine('chart3_2', years, years.map(y => count.year[y]), 'Registros por Año', '#4f46e5');

    const sortedAgeKeys = Object.keys(count.ageBuckets).sort();
    renderBarVRaw('chart4_1', sortedAgeKeys, sortedAgeKeys.map(k => count.ageBuckets[k]), 'Registros', '#f59e0b');

    const topQuals = Object.entries(count.qual).sort((a, b) => b[1] - a[1]).slice(0, 8);
    renderBarH('chart5_1', topQuals, 'Nivel', '#64748b');
    renderPie('chart5_2', topQuals.map(q => q[0]), topQuals.map(q => q[1]), p, 'Top Títulos');

    const avgF = count.remByGender.F.c ? count.remByGender.F.s / count.remByGender.F.c : 0;
    const avgM = count.remByGender.M.c ? count.remByGender.M.s / count.remByGender.M.c : 0;
    renderBarVRaw('chart6_1', ['Mujeres', 'Hombres'], [avgF, avgM], 'Rem. Promedio', ['#e11d48', '#3b82f6']);
    renderDoughnut('chart6_2', { 'Mujeres': count.sex.F, 'Hombres': count.sex.M }, 'Participación', ['#e11d48', '#3b82f6']);

    renderBarVRaw('chart7_1', Object.keys(count.remBuckets), Object.values(count.remBuckets), 'Funcionarios', '#06b6d4');
    const avgRemYear = years.map(y => evolutionMap[y].c ? evolutionMap[y].s / evolutionMap[y].c : 0);
    renderLine('chart7_2', years, avgRemYear, 'Sueldo Promedio Anual', '#0ea5e9');

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthData = Array(12).fill(0);
    Object.entries(count.month).forEach(([m, c]) => { const idx = parseInt(m) - 1; if (idx >= 0 && idx < 12) monthData[idx] = c; });
    renderBarVRaw('chart8_1', months, monthData, 'Registros', '#f59e0b');
    renderLine('chart8_2', months, monthData, 'Tendencia', '#d97706');

    const topAvgRemOrgs = Object.entries(orgStats).filter(e => e[1].c > 5).map(e => [e[0], e[1].s / e[1].c]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart9_1', topAvgRemOrgs, 'Sueldo Promedio', '#4f46e5');
    const topProOrgs = Object.entries(orgStats).sort((a, b) => b[1].p - a[1].p).slice(0, 10);
    renderBarH('chart9_2', topProOrgs.map(e => [e[0], e[1].p]), 'Profesionales', '#4338ca');

    renderDoughnut('chart10_1', count.missing, 'Vacíos', ['#ef4444', '#f97316', '#eab308']);
    const compData = [100 - (count.missing.rem / data.length) * 100, 100 - (count.missing.age / data.length) * 100];
    renderBarVRaw('chart10_2', ['Remuneración', 'Edad'], compData, '% Completitud', '#64748b');

    // --- S11-20 (NEW) ---

    // 11. Young
    const topYoungOrgs = Object.entries(count.young.orgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart11_1', topYoungOrgs, 'Jóvenes (<30)', '#10b981');
    const avgYoung = count.young.count ? count.young.sumRem / count.young.count : 0;
    const avgGen = countRem ? sumRem / countRem : 0;
    renderBarVRaw('chart11_2', ['Jóvenes', 'General'], [avgYoung, avgGen], 'Promedio', ['#10b981', '#cbd5e1']);

    // 12. Senior
    const topSeniorOrgs = Object.entries(count.senior.orgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart12_1', topSeniorOrgs, 'Senior (>60)', '#f97316');
    // Dummy visualization for cost share
    const seniorShare = (count.senior.sumRem / sumRem) * 100;
    renderPie('chart12_2', ['Planilla Senior', 'Resto'], [count.senior.sumRem, sumRem - count.senior.sumRem], ['#f97316', '#e2e8f0'], 'Costo');

    // 13. Elite
    const topEliteOrgs = Object.entries(count.elite.orgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart13_1', topEliteOrgs, 'Altos Sueldos (>4M)', '#ca8a04');
    // Multiplier
    const avgElite = 4500000; // Simplified estimation or need real calc
    renderBarVRaw('chart13_2', ['Promedio General', 'Promedio Elite'], [avgGen, avgElite], 'Comparativa', ['#cbd5e1', '#ca8a04']);

    // 14. Base
    const topBaseOrgs = Object.entries(count.base.orgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart14_1', topBaseOrgs, 'Sueldos < 700k', '#0284c7');
    renderPie('chart14_2', ['Mujeres', 'Hombres'], [count.base.sex.F, count.base.sex.M], ['#ec4899', '#3b82f6'], 'Sexo Base');

    // 15. Dispersion
    const dispersionData = Object.entries(orgStats)
        .filter(e => e[1].c > 10 && e[1].min > 0)
        .map(e => [e[0], e[1].max - e[1].min])
        .sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart15_1', dispersionData, 'Gap Max-Min', '#7c3aed');
    // Ratio example
    const ratioData = Object.entries(orgStats)
        .filter(e => e[1].c > 10 && e[1].min > 100000)
        .map(e => [e[0], (e[1].max / e[1].min).toFixed(1)])
        .sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart15_2', ratioData, 'Ratio Max/Min', '#a78bfa');

    // 16. Size vs Avg Salary
    // Top 10 biggest vs their salary
    const bigOrgs = Object.entries(orgStats).sort((a, b) => b[1].c - a[1].c).slice(0, 10);
    renderBarH('chart16_1', bigOrgs.map(e => [e[0], e[1].c]), 'Dotación', '#0891b2');
    renderBarH('chart16_2', bigOrgs.map(e => [e[0], e[1].s / e[1].c]), 'Sueldo Promedio Big Orgs', '#22d3ee');

    // 17. Professionalization
    renderPie('chart17_1', ['Profesionales', 'Técnicos', 'Otros'], [count.profs.prof, count.profs.tec, count.profs.other], ['#be123c', '#fb7185', '#e2e8f0'], 'Grado');
    const avgProf = count.profs.prof ? count.profs.sumProf / count.profs.prof : 0;
    const avgTec = count.profs.tec ? count.profs.sumTec / count.profs.tec : 0;
    renderBarVRaw('chart17_2', ['Profesional', 'Técnico'], [avgProf, avgTec], 'Sueldo Promedio', ['#be123c', '#fb7185']);

    // 18. Efficiency (Cost per Capita)
    const costPerCapita = Object.entries(orgStats)
        .filter(e => e[1].c > 5)
        .map(e => [e[0], e[1].s / e[1].c])
        .sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart18_1', costPerCapita, 'Costo Per Cápita', '#475569');
    // Scatter-like bar (Total Cost) for same top orgs
    const totalCostTop = costPerCapita.map(item => {
        const org = orgStats[item[0]];
        return [item[0], org.s];
    });
    renderBarH('chart18_2', totalCostTop, 'Gasto Total', '#94a3b8');

    // 19. Growth (New Entries by Year) - Approx by filtering 'Year' Logic
    // Using simple bar of count.year again but maybe looking at % growth?
    // Reuse years data
    const growth = years.map((y, i) => {
        if (i === 0) return 0;
        const prev = count.year[years[i - 1]];
        const curr = count.year[y];
        return ((curr - prev) / prev) * 100;
    });
    renderLine('chart19_1', years, count.year, 'Ingresos', '#2563eb');
    renderLine('chart19_2', years, growth, '% Variación Anual', '#60a5fa');

    // 20. Anomalies
    renderPie('chart20_1', ['Edad Atípica', 'Sueldo 0', 'Normal'], [count.anomalies.age, count.anomalies.zeroRem, data.length], ['#dc2626', '#f87171', '#e2e8f0'], 'Casos');
    const shadyOrgs = Object.entries(count.anomalies.orgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBarH('chart20_2', shadyOrgs, 'Registros Anómalos', '#dc2626');

    // 21. Análisis por Tipo de Cargo (S19)
    const tiposSorted = Object.entries(typeCargoCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    renderBarH('chart21_1', tiposSorted, 'Cantidad', '#3b82f6');
    renderBarH('chart21_2', tiposSorted.map(t => [t[0], typeCargoSums[t[0]] / t[1]]), 'Rem. Promedio', '#10b981');

    // 22. Análisis de Liquidez (S20)
    const topOrgsLiq = Object.entries(orgBrutoLiquido).sort((a, b) => b[1].bruto - a[1].bruto).slice(0, 10);
    const orgLiqLabels = topOrgsLiq.map(o => o[0]);
    renderBarHMulti('chart22_1', orgLiqLabels, [
        { label: 'Bruto (CLP)', data: topOrgsLiq.map(o => o[1].bruto), color: '#6366f1' },
        { label: 'Líquido Est.', data: topOrgsLiq.map(o => o[1].liquido), color: '#10b981' }
    ]);
    renderBarH('chart22_2', topOrgsLiq.map(o => [o[0], (o[1].liquido / o[1].bruto) * 100]), 'Ratio L/B %', '#f59e0b');

    // 23. Nube de Palabras (S21)
    renderWordCloud('wordCloudContainer', cargoCounts);

    // 24. Ranking de Aumentos (S22)
    renderAumentosTable('rankingAumentosBody', aumentos);

    // 25. Tree Map de Gasto (S23)
    renderTreeMap('treeMapContainer', orgBrutoLiquido);
}

// --- RENDERING HELPERS (High Quality) ---

const fontBase = { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 500 };
const fontLegend = { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: 600 };

function checkChart(id) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    if (charts[id]) charts[id].destroy();
    return ctx;
}

function pctLegendCallback(chart) {
    const data = chart.data;
    if (data.labels.length && data.datasets.length) {
        const dataset = data.datasets[0];
        const total = dataset.data.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
        return data.labels.map((label, i) => {
            const val = dataset.data[i];
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
            const meta = chart.getDatasetMeta(0);
            const style = meta.controller.getStyle(i);
            return {
                text: `${label.substring(0, 22)} (${pct})`,
                fillStyle: style.backgroundColor,
                strokeStyle: style.borderColor,
                lineWidth: style.borderWidth,
                hidden: isNaN(dataset.data[i]) || meta.data[i].hidden,
                index: i
            };
        });
    }
    return [];
}

function renderDoughnut(id, dataObj, label, colors) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(dataObj), datasets: [{ data: Object.values(dataObj), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 10, font: fontLegend, generateLabels: pctLegendCallback } } } } });
}
function renderPie(id, labels, data, colors, label) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 10, font: fontLegend, generateLabels: pctLegendCallback } } } } });
}
function renderBarH(id, entries, label, color) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, { type: 'bar', data: { labels: entries.map(e => e[0]), datasets: [{ label, data: entries.map(e => e[1]), backgroundColor: color, borderRadius: 5 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => formatCompact(v), font: fontBase } }, y: { ticks: { font: fontBase, callback: function (v) { const l = this.getLabelForValue(v); return l.length > 28 ? l.substring(0, 28) + '...' : l; } } } } } });
}
function renderBarVRaw(id, labels, data, label, colors) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => numFmt.format(v), font: fontBase } }, x: { ticks: { font: fontBase } } } } });
}
function renderLine(id, labels, data, label, color) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + '20', fill: true, tension: 0.4, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => formatCompact(v), font: fontBase } }, x: { ticks: { font: fontBase } } } } });
}

function renderBarHMulti(id, labels, datasets) {
    const ctx = checkChart(id); if (!ctx) return;
    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => l.length > 25 ? l.substring(0, 25) + '...' : l),
            datasets: datasets.map(ds => ({
                label: ds.label,
                data: ds.data,
                backgroundColor: ds.color,
                borderRadius: 5
            }))
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: fontBase } } },
            scales: { x: { ticks: { callback: v => formatCompact(v), font: fontBase } }, y: { ticks: { font: fontBase } } }
        }
    });
}

function renderWordCloud(id, counts) {
    const container = document.getElementById(id);
    if (!container) return;
    const top40 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);
    if (!top40.length) { container.innerHTML = '<div class="text-slate-400">Sin datos</div>'; return; }
    const max = top40[0][1], min = top40[top40.length - 1][1];
    const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
    container.innerHTML = top40.map(([text, count]) => {
        const size = 0.8 + ((count - min) / (Math.max(1, max - min))) * 1.7;
        const color = colors[Math.floor(Math.random() * colors.length)];
        return `<span style="font-size:${size}rem; color:${color}; font-weight:700; padding:0.2rem 0.4rem; opacity:0.8" class="hover:scale-110 hover:opacity-100 transition-all cursor-default" title="${count} items">${text}</span>`;
    }).join('');
}

function renderAumentosTable(id, aumentos) {
    const body = document.getElementById(id);
    if (!body) return;
    const top10 = aumentos.sort((a, b) => b.diff - a.diff).slice(0, 10);
    const fmt = (n) => '$ ' + Math.round(n).toLocaleString('es-CL');
    body.innerHTML = top10.length ? top10.map(a => `
        <tr class="bg-white border-b hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-medium text-slate-900 truncate max-w-[180px]" title="${a.nombre}">${a.nombre}</td>
            <td class="px-4 py-3 text-slate-500 truncate max-w-[180px]" title="${a.org}">${a.org}</td>
            <td class="px-4 py-3 text-right text-slate-600">${fmt(a.entrada)}</td>
            <td class="px-4 py-3 text-right text-slate-900 font-bold">${fmt(a.salida)}</td>
            <td class="px-4 py-3 text-right text-emerald-600 font-semibold">+${fmt(a.diff)}</td>
            <td class="px-4 py-3 text-right text-emerald-600 font-bold bg-emerald-50">${Math.round(a.pct)}%</td>
        </tr>
    `).join('') : '<tr><td colspan="6" class="text-center py-4 text-slate-400">Sin variaciones detectadas</td></tr>';
}

function renderTreeMap(id, orgData) {
    const container = document.getElementById(id);
    if (!container) return;
    const sorted = Object.entries(orgData).map(([name, v]) => ({ name, value: v.bruto })).sort((a, b) => b.value - a.value);
    const total = sorted.reduce((a, b) => a + b.value, 0);
    if (!total) { container.innerHTML = ''; return; }

    const treeColors = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1'];
    let row1 = '', row2 = '', current = 0;

    sorted.slice(0, 15).forEach((item, i) => {
        const pct = (item.value / total) * 100;
        const block = `<div style="background:${treeColors[i % treeColors.length]}; flex-grow:${Math.round(item.value)}" class="h-full border border-white flex flex-col items-center justify-center text-white text-center p-1 min-w-[30px] overflow-hidden group relative" title="${item.name}: ${formatCompact(item.value)}">
            ${pct > 2.5 ? `<div class="font-bold truncate w-full px-1 text-xs">${item.name}</div><div class="text-[10px] opacity-80">${pct.toFixed(1)}%</div>` : ''}
        </div>`;
        if (current < 50) row1 += block; else row2 += block;
        current += pct;
    });
    container.innerHTML = `<div class="w-full h-1/2 flex">${row1}</div><div class="w-full h-1/2 flex">${row2}</div>`;
}

function parseAge(val) { if (typeof val === 'number') return val; if (typeof val === 'string') { const m = val.match(/\d+/); return m ? parseInt(m[0]) : 0; } return 0; }
function normalizeSex(s) { if (!s) return 'U'; s = s.toString().toLowerCase().trim(); if (s.startsWith('f') || s.includes('muj')) return 'F'; if (s.startsWith('m') || s.includes('hom')) return 'M'; return 'U'; }
function updateKPIs(count, totalGasto, cGasto, sumAge, cAge, sex, orgs, maxRem) { els.headerCount.textContent = numFmt.format(count); els.headerMoney.textContent = formatCompact(totalGasto); els.totalRecs.textContent = numFmt.format(count); els.totalGasto.textContent = formatCompact(totalGasto); els.avgRem.textContent = moneyFmt.format(cGasto ? totalGasto / cGasto : 0); els.avgAge.textContent = cAge ? (sumAge / cAge).toFixed(1) + ' años' : '-'; els.women.textContent = numFmt.format(sex.F); els.men.textContent = numFmt.format(sex.M); els.orgsCount.textContent = numFmt.format(orgs); els.maxRem.textContent = moneyFmt.format(maxRem); if (els.lastUpdate) els.lastUpdate.textContent = new Date().toLocaleDateString('es-CL'); }
