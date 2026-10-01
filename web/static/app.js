let portsData = [];
let viewMode = 'table';
let actionHistory = [];
let toastTimeout = null;
let devOnlyFilter = false;
let lastSSEData = null;

// Web Watch Daemon state
let isWebWatchActive = false;
let webWatchIntervalId = null;
let previousWatchPortsMap = new Map();

// Developer Tips Carousel State (Randomized with History)
let currentTipIndex = -1;
let tipsHistory = [];
let tipsIntervalId = null;
let isCarouselPaused = false;
let hasActiveAlert = false;

function pickNextRandomTipIndex() {
    const pool = getTipsPool();
    if (!pool || pool.length === 0) return 0;
    if (pool.length === 1) return 0;
    let nextIdx;
    let attempts = 0;
    do {
        nextIdx = Math.floor(Math.random() * pool.length);
        attempts++;
    } while (nextIdx === currentTipIndex && attempts < 10);
    return nextIdx;
}

function getTipsPool() {
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
    if (typeof devTips !== 'undefined') {
        if (devTips[lang] && Array.isArray(devTips[lang])) return devTips[lang];
        if (Array.isArray(devTips)) return devTips;
    }
    return [
        "💡 <strong>Pro Tip:</strong> Puedes usar <code>scaport check 3000 8080</code> en tu <code>package.json</code> dentro de <code>\"predev\"</code> para evitar arrancar con puertos colisionados.",
        "🔄 <strong>Hot-Cycle:</strong> Si tu servidor Vite o FastAPI no detecta cambios en caliente, pulsa <strong>Restart</strong> para regenerarlo con sus mismos argumentos.",
        "🛡️ <strong>Seguridad:</strong> scaport bloquea automáticamente la terminación de procesos del sistema como PID 4 para mantener seguro tu OS.",
        "🌐 <strong>Un solo clic:</strong> Cuando un puerto responda <code>200 OK</code>, pulsa el icono <strong>🌐</strong> para abrirlo directamente en tu navegador."
    ];
}

// Initialize SSE Connection
function initSSE() {
    const eventSource = new EventSource('/api/events');
    const statusElem = document.getElementById('connection-status');

    eventSource.onmessage = function (event) {
        try {
            const data = JSON.parse(event.data);
            lastSSEData = data;
            portsData = data.ports || [];
            updateStats(data);
            runDiagnostics(portsData);
            renderView();
            if (statusElem) {
                statusElem.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>${t('sseLive')}</span>`;
                statusElem.className = 'hidden sm:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            }
        } catch (err) {
            console.error('Error parsing SSE event:', err);
        }
    };

    eventSource.onerror = function () {
        if (statusElem) {
            statusElem.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span>${t('reconnecting')}</span>`;
            statusElem.className = 'hidden sm:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20';
        }
    };
}

// Telemetry & Historical Trends state (buffer of last 30 samples)
let metricsHistory = {
    timestamps: [],
    totalPorts: [],
    devPorts: [],
    memoryMB: [],
    healthyCount: []
};
const MAX_HISTORY_POINTS = 30;

function generateSparklinePath(data, width = 100, height = 24, padding = 3) {
    if (!data || data.length < 2) {
        return { path: `M0,${height - padding} L${width},${height - padding}`, area: `M0,${height - padding} L${width},${height - padding} L${width},${height} L0,${height} Z` };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) === 0 ? 1 : (max - min);

    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const normalizedY = (val - min) / range;
        const y = (height - padding) - (normalizedY * (height - padding * 2));
        return { x: x.toFixed(1), y: y.toFixed(1) };
    });

    const pathD = 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ');
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
    return { path: pathD, area: areaD };
}

function updateStats(data) {
    if (!data) return;
    const ports = data.ports || [];
    const totalPortsCount = data.total || ports.length;
    
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let idleCount = 0;
    let totalMem = 0;
    let devCount = 0;
    let dbCount = 0;
    let sysCount = 0;
    let latencySum = 0;
    let latencyCount = 0;
    let topProc = { name: '-', mem: 0, pid: 0 };
    let techCounts = {};

    const commonDevPorts = [3000, 3001, 3333, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000, 9090, 9119];

    ports.forEach(p => {
        const proc = p.process || {};
        const isProtected = proc.isProtected || (proc.pid && proc.pid <= 4) || proc.projectType === 'System' || (proc.name || '').toLowerCase() === 'system';
        const isDb = proc.isDatabase || proc.projectType === 'Database';
        const isDevProject = (proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System' && proc.projectType !== 'Database') || commonDevPorts.includes(p.port);

        // Classify layers
        if (isProtected) {
            sysCount++;
        } else if (isDb) {
            dbCount++;
        } else if (isDevProject) {
            devCount++;
        }

        // Tech tally
        const type = proc.projectType || 'Binary';
        if (type !== 'Binary' && type !== 'Unknown' && type !== 'System') {
            techCounts[type] = (techCounts[type] || 0) + 1;
        }

        // Memory calculations
        if (proc.memoryMB) {
            totalMem += proc.memoryMB;
            if (proc.memoryMB > topProc.mem) {
                topProc = { name: proc.projectName || proc.name || `PID ${proc.pid}`, mem: proc.memoryMB, pid: proc.pid };
            }
        }

        // Health & Latencies
        if (p.health === 'healthy') {
            healthyCount++;
            if (p.healthTimeMs) {
                latencySum += p.healthTimeMs;
                latencyCount++;
            }
        } else if (p.health === 'degraded') {
            degradedCount++;
            if (p.healthTimeMs) {
                latencySum += p.healthTimeMs;
                latencyCount++;
            }
        } else if (p.health === 'unhealthy') {
            unhealthyCount++;
        } else {
            idleCount++;
        }
    });

    // Record sample in telemetry buffer
    metricsHistory.timestamps.push(new Date().toLocaleTimeString());
    metricsHistory.totalPorts.push(totalPortsCount);
    metricsHistory.devPorts.push(devCount);
    metricsHistory.memoryMB.push(Number(totalMem.toFixed(1)));
    metricsHistory.healthyCount.push(healthyCount);

    if (metricsHistory.totalPorts.length > MAX_HISTORY_POINTS) {
        metricsHistory.timestamps.shift();
        metricsHistory.totalPorts.shift();
        metricsHistory.devPorts.shift();
        metricsHistory.memoryMB.shift();
        metricsHistory.healthyCount.shift();
    }

    // 1. Update Card 1: Active Sockets
    const statTotalPorts = document.getElementById('stat-total-ports');
    if (statTotalPorts) statTotalPorts.innerText = totalPortsCount;
    const statDev = document.getElementById('stat-dev-count');
    if (statDev) statDev.innerText = devCount;
    const statDb = document.getElementById('stat-db-count');
    if (statDb) statDb.innerText = dbCount;
    const statSys = document.getElementById('stat-sys-count');
    if (statSys) statSys.innerText = sysCount;
    
    const minPorts = Math.min(...metricsHistory.totalPorts, totalPortsCount);
    const maxPorts = Math.max(...metricsHistory.totalPorts, totalPortsCount, 1);
    const scalePortsElem = document.getElementById('sparkline-ports-scale');
    if (scalePortsElem) {
        scalePortsElem.innerText = t('scaleSockets', { min: minPorts, max: maxPorts });
    }

    const portsSpark = generateSparklinePath(metricsHistory.totalPorts, 100, 28);
    const sparklinePortsElem = document.getElementById('sparkline-ports');
    if (sparklinePortsElem) {
        sparklinePortsElem.innerHTML = `<path d="${portsSpark.area}" fill="currentColor" opacity="0.15"></path><path d="${portsSpark.path}" fill="none" stroke="currentColor"></path>`;
    }

    // 2. Update Card 2: Health & Traffic
    const statHealthyElem = document.getElementById('stat-healthy');
    if (statHealthyElem) {
        statHealthyElem.innerText = `${healthyCount} ${t('healthOnline')}`;
    }
    const statOnline = document.getElementById('stat-online-count');
    if (statOnline) statOnline.innerText = healthyCount;
    const statIdle = document.getElementById('stat-idle-count');
    if (statIdle) statIdle.innerText = idleCount;
    const statUnhealthy = document.getElementById('stat-unhealthy-count');
    if (statUnhealthy) statUnhealthy.innerText = unhealthyCount;

    // Latency badge
    const latencyBadge = document.getElementById('stat-avg-latency-badge');
    if (latencyBadge) {
        if (latencyCount > 0) {
            const avg = Math.round(latencySum / latencyCount);
            latencyBadge.innerText = `avg ${avg}ms`;
            latencyBadge.classList.remove('hidden');
        } else {
            latencyBadge.classList.add('hidden');
        }
    }

    // Health Bar distribution percentages
    const totalHealthItems = totalPortsCount || 1;
    const pctOnline = ((healthyCount / totalHealthItems) * 100).toFixed(1);
    const pctDegraded = ((degradedCount / totalHealthItems) * 100).toFixed(1);
    const pctUnhealthy = ((unhealthyCount / totalHealthItems) * 100).toFixed(1);
    const pctIdle = Math.max(0, 100 - pctOnline - pctDegraded - pctUnhealthy).toFixed(1);

    const barOnline = document.getElementById('health-bar-online');
    const barDegraded = document.getElementById('health-bar-degraded');
    const barUnhealthy = document.getElementById('health-bar-unhealthy');
    const barIdle = document.getElementById('health-bar-idle');
    if (barOnline) barOnline.style.width = `${pctOnline}%`;
    if (barDegraded) barDegraded.style.width = `${pctDegraded}%`;
    if (barUnhealthy) barUnhealthy.style.width = `${pctUnhealthy}%`;
    if (barIdle) barIdle.style.width = `${pctIdle}%`;

    // 3. Update Card 3: Memory (RSS)
    const statMem = document.getElementById('stat-memory');
    if (statMem) statMem.innerText = `${totalMem.toFixed(1)} MB`;
    
    const minMem = Math.min(...metricsHistory.memoryMB, totalMem);
    const maxMem = Math.max(...metricsHistory.memoryMB, totalMem, 1);
    const formatMemShort = (v) => v >= 1000 ? (v / 1024).toFixed(1) + 'GB' : Math.round(v) + 'MB';
    const scaleMemElem = document.getElementById('sparkline-mem-scale');
    if (scaleMemElem) {
        scaleMemElem.innerText = t('scaleMem', { min: formatMemShort(minMem), max: formatMemShort(maxMem) });
    }

    const topProcElem = document.getElementById('stat-top-consumer');
    if (topProcElem) {
        topProcElem.innerText = topProc.mem > 0 ? `${topProc.name} (${topProc.mem.toFixed(0)}MB)` : t('topConsumerEmpty');
        if (topProcElem.parentElement) {
            topProcElem.parentElement.title = t('topConsumerTitle', { name: topProc.name, mem: topProc.mem.toFixed(1) });
        }
    }
    const memBadge = document.getElementById('stat-memory-badge');
    if (memBadge) {
        if (totalMem > 3000) {
            memBadge.innerText = t('memStatusHigh');
            memBadge.className = 'px-1.5 py-0.2 text-[10px] rounded bg-rose-500/20 text-rose-300 font-mono font-bold';
        } else if (totalMem > 1500) {
            memBadge.innerText = t('memStatusModerate');
            memBadge.className = 'px-1.5 py-0.2 text-[10px] rounded bg-amber-500/20 text-amber-300 font-mono';
        } else {
            memBadge.innerText = t('memStatusNormal');
            memBadge.className = 'px-1.5 py-0.2 text-[10px] rounded bg-cyan-500/15 text-cyan-300 font-mono';
        }
    }
    const memSpark = generateSparklinePath(metricsHistory.memoryMB, 100, 28);
    const sparklineMemElem = document.getElementById('sparkline-memory');
    if (sparklineMemElem) {
        sparklineMemElem.innerHTML = `<path d="${memSpark.area}" fill="currentColor" opacity="0.15"></path><path d="${memSpark.path}" fill="none" stroke="currentColor"></path>`;
    }

    // 4. Update Card 4: Dev Ecosystem & Stack Distribution
    const totalProjectsCount = Object.values(techCounts).reduce((a, b) => a + b, 0);
    const statProj = document.getElementById('stat-projects');
    if (statProj) statProj.innerText = totalProjectsCount;

    // Tech Chips
    const chipsContainer = document.getElementById('tech-chips-container');
    if (chipsContainer) {
        const techKeys = Object.keys(techCounts);
        if (techKeys.length > 0) {
            chipsContainer.innerHTML = techKeys.map(k => `
                <button onclick="quickFilter('tech', '${k}')" class="px-2 py-0.5 rounded-full bg-dark-900 border border-slate-700 hover:border-amber-400 hover:text-amber-300 text-slate-300 transition flex items-center space-x-1 shrink-0">
                    <span class="font-bold">${k}</span>
                    <span class="bg-amber-500/20 text-amber-300 px-1 rounded-full text-[9px] font-mono">${techCounts[k]}</span>
                </button>
            `).join('');
        } else {
            chipsContainer.innerHTML = `<span class="text-slate-500">${t('noFrameworks')}</span>`;
        }
    }

    // Tech Bar Distribution
    const techBar = document.getElementById('tech-distribution-bar');
    if (techBar && totalProjectsCount > 0) {
        const colorMap = {
            'Go': 'bg-cyan-400',
            'Node.js': 'bg-emerald-400',
            'Python': 'bg-yellow-400',
            'Rust': 'bg-orange-500',
            'Database': 'bg-amber-400',
            'Docker': 'bg-blue-400',
            'Java': 'bg-red-400',
            'PHP': 'bg-purple-400',
            'Ruby': 'bg-rose-500'
        };
        techBar.innerHTML = Object.keys(techCounts).map(k => {
            const pct = ((techCounts[k] / totalProjectsCount) * 100).toFixed(1);
            const color = colorMap[k] || 'bg-slate-500';
            return `<div class="${color} h-full transition-all duration-500" style="width: ${pct}%" title="${k}: ${techCounts[k]} (${pct}%)"></div>`;
        }).join('');
    }

    // 5. Update Telemetry Modal if currently open
    updateTelemetryModalContent(ports, totalMem, totalPortsCount);
}

// Smart Diagnostic & Suggestions Analyzer with Alert Priority
function runDiagnostics(ports) {
    const banner = document.getElementById('smart-advisor-banner');
    const msgElem = document.getElementById('advisor-message');
    const titleElem = document.getElementById('advisor-title');
    const tagElem = document.getElementById('advisor-tag');
    const iconElem = document.getElementById('advisor-icon');
    const counterElem = document.getElementById('advisor-counter');
    const controlsElem = document.getElementById('advisor-controls');

    if (!banner || !msgElem || !titleElem || !tagElem || !iconElem) return;

    let devPortsColliding = [];
    let highMemProcs = [];
    let unhealthyDevServices = [];

    const commonDevPorts = [3000, 3001, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8888, 9000, 9090];
    const nonDevBinaries = ['anydesk', 'spotify', 'discord', 'steam', 'svchost', 'system', 'system idle process'];

    ports.forEach(p => {
        const port = p.port;
        const proc = p.process || {};
        const procName = (proc.name || '').toLowerCase();
        const isSystemOrDesktop = nonDevBinaries.some(b => procName.includes(b));
        const isDevProject = (proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown') || commonDevPorts.includes(port);

        if (commonDevPorts.includes(port) && !isSystemOrDesktop) {
            devPortsColliding.push({ port, proc });
        }

        if (proc.memoryMB > 550 && !isSystemOrDesktop) {
            highMemProcs.push({ port, proc, mem: proc.memoryMB.toFixed(0) });
        }

        // Only alert Unhealthy on dev projects or common dev web ports that fail HTTP
        if (p.health === 'unhealthy' && isDevProject && !isSystemOrDesktop) {
            unhealthyDevServices.push({ port, proc });
        }
    });

    const isEs = currentLang === 'es';

    // Priority 1: Unhealthy / Frozen dev services
    if (unhealthyDevServices.length > 0) {
        hasActiveAlert = true;
        const item = unhealthyDevServices[0];
        iconElem.innerText = "🚨";
        titleElem.innerText = t('alertUnhealthyTitle');
        titleElem.className = "font-bold text-sm text-rose-400";
        tagElem.innerText = t('alertUnhealthyTag');
        tagElem.className = "text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono";
        if (counterElem) counterElem.className = "hidden";
        if (controlsElem) controlsElem.classList.add('hidden');
        
        const procName = item.proc.projectName || item.proc.name || 'PID ' + item.proc.pid;
        if (isEs) {
            msgElem.innerHTML = `⚠️ <strong>Servicio sin respuesta en :${item.port} (${procName})</strong>. El socket está abierto pero no responde a HTTP GET. Sugerencia: <button onclick="hotCycleProcess(${item.proc.pid}, ${item.port})" class="underline text-amber-300 font-bold hover:text-white">🔄 Reiniciar (Hot-Cycle)</button> o <button onclick="killProcess(${item.proc.pid}, ${item.port})" class="underline text-rose-400 font-bold hover:text-white">🛑 Liberar puerto</button>.`;
        } else {
            msgElem.innerHTML = `⚠️ <strong>Unresponsive service on :${item.port} (${procName})</strong>. Socket is listening but fails HTTP GET. Suggestion: <button onclick="hotCycleProcess(${item.proc.pid}, ${item.port})" class="underline text-amber-300 font-bold hover:text-white">🔄 Restart (Hot-Cycle)</button> or <button onclick="killProcess(${item.proc.pid}, ${item.port})" class="underline text-rose-400 font-bold hover:text-white">🛑 Free port</button>.`;
        }
        banner.className = 'bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 shadow-lg transition-all duration-300 relative group';
    } 
    // Priority 2: Occupied standard dev ports collision warning
    else if (devPortsColliding.length > 1) {
        hasActiveAlert = true;
        const item = devPortsColliding[0];
        iconElem.innerText = "💡";
        titleElem.innerText = t('alertCollisionTitle');
        titleElem.className = "font-bold text-sm text-amber-400";
        tagElem.innerText = t('alertCollisionTag');
        tagElem.className = "text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono";
        if (counterElem) counterElem.className = "hidden";
        if (controlsElem) controlsElem.classList.add('hidden');
        
        if (isEs) {
            msgElem.innerHTML = `💡 <strong>Tienes ${devPortsColliding.length} puertos dev activos</strong> (:3000, :5173, etc.). Si vas a lanzar un nuevo microservicio, verifica que no colisione o usa <button onclick="toggleDevOnlyFilter()" class="underline text-emerald-400 font-bold hover:text-white">⚡ Solo Dev</button> para inspeccionarlos.`;
        } else {
            msgElem.innerHTML = `💡 <strong>You have ${devPortsColliding.length} active dev ports</strong> (:3000, :5173, etc.). Before launching a new service, check for collisions or use <button onclick="toggleDevOnlyFilter()" class="underline text-emerald-400 font-bold hover:text-white">⚡ Dev Only</button> to inspect them.`;
        }
        banner.className = 'bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 shadow-lg transition-all duration-300 relative group';
    } 
    // Priority 3: High memory leaks
    else if (highMemProcs.length > 0) {
        hasActiveAlert = true;
        const item = highMemProcs[0];
        iconElem.innerText = "🧠";
        titleElem.innerText = t('alertMemTitle');
        titleElem.className = "font-bold text-sm text-cyan-400";
        tagElem.innerText = t('alertMemTag');
        tagElem.className = "text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono";
        if (counterElem) counterElem.className = "hidden";
        if (controlsElem) controlsElem.classList.add('hidden');
        
        if (isEs) {
            msgElem.innerHTML = `🧠 <strong>Alto consumo en :${item.port}</strong> (${item.proc.name} está consumiendo <strong>${item.mem} MB</strong>). Si es un proceso huérfano, puedes finalizarlo para liberar RAM.`;
        } else {
            msgElem.innerHTML = `🧠 <strong>High memory on :${item.port}</strong> (${item.proc.name} is using <strong>${item.mem} MB</strong>). If orphaned, terminate it to reclaim RAM.`;
        }
        banner.className = 'bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-4 shadow-lg transition-all duration-300 relative group';
    } 
    // Default: Normal State -> Rich Rotating Tips Carousel (400+ Tips)
    else {
        hasActiveAlert = false;
        iconElem.innerText = "✨";
        titleElem.innerText = t('advisorTitleDefault');
        titleElem.className = "font-bold text-sm text-emerald-400";
        tagElem.innerText = t('advisorTagDefault');
        tagElem.className = "text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono";
        if (controlsElem) controlsElem.classList.remove('hidden');
        
        const pool = getTipsPool();
        if (currentTipIndex === -1) {
            currentTipIndex = pickNextRandomTipIndex();
        }
        const safeIndex = currentTipIndex % pool.length;
        if (counterElem) {
            counterElem.className = "text-[10px] bg-slate-800/90 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold";
            counterElem.innerText = `${t('advisorTipPrefix')}${safeIndex + 1}`;
        }
        msgElem.innerHTML = pool[safeIndex];
        banner.className = 'bg-gradient-to-r from-emerald-500/10 via-dark-800 to-dark-800 border border-emerald-500/30 rounded-xl p-4 shadow-lg transition-all duration-300 relative group';
    }
}

// Auto-Rotating Tips Carousel Engine (every 15s, randomized)
function startTipsCarousel() {
    if (currentTipIndex === -1) {
        currentTipIndex = pickNextRandomTipIndex();
    }
    if (tipsIntervalId) clearInterval(tipsIntervalId);
    tipsIntervalId = setInterval(() => {
        if (!isCarouselPaused && !hasActiveAlert) {
            if (currentTipIndex !== -1) {
                tipsHistory.push(currentTipIndex);
                if (tipsHistory.length > 50) tipsHistory.shift();
            }
            currentTipIndex = pickNextRandomTipIndex();
            runDiagnostics(portsData);
        }
    }, 15000);
}

function pauseTipsCarousel() {
    isCarouselPaused = true;
}

function resumeTipsCarousel() {
    isCarouselPaused = false;
}

function nextAdvisorTip() {
    if (currentTipIndex !== -1) {
        tipsHistory.push(currentTipIndex);
        if (tipsHistory.length > 50) tipsHistory.shift();
    }
    currentTipIndex = pickNextRandomTipIndex();
    runDiagnostics(portsData);
}

function prevAdvisorTip() {
    if (tipsHistory.length > 0) {
        currentTipIndex = tipsHistory.pop();
    } else {
        currentTipIndex = pickNextRandomTipIndex();
    }
    runDiagnostics(portsData);
}

function randomAdvisorTip() {
    if (currentTipIndex !== -1) {
        tipsHistory.push(currentTipIndex);
        if (tipsHistory.length > 50) tipsHistory.shift();
    }
    currentTipIndex = pickNextRandomTipIndex();
    runDiagnostics(portsData);
}

// Web Watch Daemon Controller
function toggleWebWatchMode() {
    isWebWatchActive = !isWebWatchActive;
    const btn = document.getElementById('web-watch-btn');
    const textElem = document.getElementById('watch-text');
    const iconElem = document.getElementById('watch-icon');

    if (isWebWatchActive) {
        if (btn) btn.className = 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg border border-emerald-400 transition flex items-center space-x-1.5';
        if (textElem) textElem.innerText = t('watchOn');
        if (iconElem) iconElem.innerText = '🟢';
        showToast(t('watchActiveToast'), 'success');
        recordAction('👁️ WATCH DAEMON ON', t('watchActiveToast'), true);

        // Run continuous background health probes
        webWatchIntervalId = setInterval(async () => {
            try {
                await fetch('/api/healthcheck', { method: 'POST' });
            } catch (e) {
                console.error(e);
            }
        }, 3000);
    } else {
        if (btn) btn.className = 'px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5';
        if (textElem) textElem.innerText = t('watchOff');
        if (iconElem) iconElem.innerText = '👁️';
        if (webWatchIntervalId) {
            clearInterval(webWatchIntervalId);
            webWatchIntervalId = null;
        }
        showToast(t('watchDisabledToast'), 'info');
        recordAction('👁️ WATCH DAEMON OFF', t('watchDisabledToast'), true);
    }
}

function toggleDevOnlyFilter() {
    devOnlyFilter = !devOnlyFilter;
    const btn = document.getElementById('dev-only-btn');
    if (btn) {
        if (devOnlyFilter) {
            btn.className = 'px-3 py-1.5 text-xs rounded-lg font-bold border border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm transition flex items-center space-x-1.5';
        } else {
            btn.className = 'px-3 py-1.5 text-xs rounded-lg font-medium border border-slate-700 bg-dark-900 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition flex items-center space-x-1.5';
        }
    }
    renderView();
}

function renderView() {
    const searchInput = document.getElementById('search-input');
    const searchVal = (searchInput ? searchInput.value : '').toLowerCase();
    const typeFilterElem = document.getElementById('type-filter');
    const typeFilter = typeFilterElem ? typeFilterElem.value : 'ALL';
    const commonDevPorts = [3000, 3001, 3333, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000, 9090, 9119];

    const filtered = portsData.filter(p => {
        const portStr = String(p.port);
        const pidStr = p.process ? String(p.process.pid) : '';
        const nameStr = p.process ? (p.process.name + ' ' + (p.process.projectName || '')).toLowerCase() : '';
        const typeStr = p.process ? p.process.projectType : '';
        const isDevProject = p.process && p.process.projectType && p.process.projectType !== 'Binary' && p.process.projectType !== 'Unknown' && p.process.projectType !== 'System';

        const matchesSearch = portStr.includes(searchVal) || pidStr.includes(searchVal) || nameStr.includes(searchVal);
        const matchesType = typeFilter === 'ALL' || typeStr === typeFilter;
        const matchesDevOnly = !devOnlyFilter || isDevProject || commonDevPorts.includes(p.port);

        return matchesSearch && matchesType && matchesDevOnly;
    });

    // Developer-First Sorting
    const priorityOf = (p) => {
        const proc = p.process || {};
        const isProtected = proc.isProtected || (proc.pid && proc.pid <= 4) || proc.projectType === 'System' || (proc.name || '').toLowerCase() === 'system';
        if (isProtected) return 4;
        const isDevProject = proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System' && proc.projectType !== 'Database';
        if (isDevProject) return 0;
        if (commonDevPorts.includes(p.port)) return 0;
        if (proc.isDatabase || proc.projectType === 'Database') return 1;
        if (proc.name && !proc.name.includes('PID Process')) return 2;
        return 3;
    };

    filtered.sort((a, b) => {
        const pa = priorityOf(a);
        const pb = priorityOf(b);
        if (pa !== pb) return pa - pb;
        return a.port - b.port;
    });

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }

    if (viewMode === 'table') {
        renderTable(filtered);
    } else {
        renderGrid(filtered);
    }
}

function renderTable(ports) {
    const tbody = document.getElementById('ports-table-body');
    if (!tbody) return;

    tbody.innerHTML = ports.map(p => {
        const proc = p.process || {};
        const healthBadge = getHealthBadge(p.health, p.healthCode, p.healthTimeMs);
        const typeBadge = getTypeBadge(proc.projectType || 'Unknown');
        const isProject = proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System';
        const isHTTPHealthy = p.health === 'healthy' || p.health === 'degraded';
        const isProtected = proc.isProtected || (proc.pid && proc.pid <= 4);
        const isDb = proc.isDatabase || proc.projectType === 'Database';
        const displayName = proc.projectName || proc.name || (currentLang === 'es' ? 'Servicio del Sistema' : 'System Service');
        const desc = proc.description || proc.cmdline || proc.cwd || '-';

        return `
            <tr class="hover:bg-slate-800/40 transition ${isProject ? 'bg-emerald-950/15' : ''}">
                <td class="py-3 px-4 font-bold text-white flex items-center space-x-2">
                    <span class="text-emerald-400 text-sm">:${p.port}</span>
                    <span class="text-[10px] text-slate-500 uppercase border border-slate-700 px-1 rounded">${p.protocol}</span>
                    ${isProject ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded font-mono">DEV</span>' : ''}
                    ${isDb ? '<span class="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-mono">DB</span>' : ''}
                </td>
                <td class="py-3 px-4">${healthBadge}</td>
                <td class="py-3 px-4 text-slate-300 font-mono">${proc.pid || '-'}</td>
                <td class="py-3 px-4">
                    <div class="font-sans max-w-xs sm:max-w-sm">
                        <p class="font-semibold text-slate-100 text-xs flex items-center space-x-1.5 truncate">
                            <span title="${desc}">${displayName}</span>
                        </p>
                        <p class="text-[11px] text-slate-400 truncate cursor-help" title="${desc}">${desc}</p>
                    </div>
                </td>
                <td class="py-3 px-4 font-sans">${typeBadge}</td>
                <td class="py-3 px-4 text-slate-300 text-xs">${proc.memoryMB ? proc.memoryMB.toFixed(1) + ' MB' : '-'}</td>
                <td class="py-3 px-4 text-slate-400 text-xs">${proc.uptime || '-'}</td>
                <td class="py-3 px-4 text-right font-sans">
                    <div class="inline-flex items-center space-x-1.5">
                        ${isHTTPHealthy ? `
                        <button onclick="openPortInBrowser(${p.port})" title="${t('openBrowserTitle', { port: p.port })}" class="p-1 text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded border border-cyan-500/20 transition flex items-center">
                            <span>🌐</span>
                        </button>` : ''}
                        ${proc.cmdline && !isProtected ? `
                        <button onclick="hotCycleProcess(${proc.pid}, ${p.port})" title="${t('hotCycleTitle')}" class="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded border border-amber-500/20 transition flex items-center space-x-1">
                            <span>🔄</span> <span class="hidden sm:inline">${t('restartBtn')}</span>
                        </button>` : ''}
                        ${isProtected ? `
                        <span class="px-2 py-1 text-[11px] bg-slate-800/90 text-slate-400 rounded border border-slate-700 select-none cursor-not-allowed font-mono flex items-center space-x-1" title="${t('shieldTitle')}">
                            <span>🛡️</span> <span>${t('shieldBadge')}</span>
                        </span>` : isDb ? `
                        <button onclick="killProcess(${proc.pid}, ${p.port}, true, '${displayName}')" title="${t('killDbTitle')}" class="px-2 py-1 text-xs bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 rounded border border-amber-500/30 transition flex items-center space-x-1">
                            <span>🛑</span> <span class="hidden sm:inline">${t('killDbBtn')}</span>
                        </button>` : `
                        <button onclick="killProcess(${proc.pid}, ${p.port}, false, '${displayName}')" title="${t('killTitle')}" class="px-2 py-1 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded border border-rose-500/20 transition flex items-center space-x-1">
                            <span>🛑</span> <span class="hidden sm:inline">${t('killBtn')}</span>
                        </button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderGrid(ports) {
    const gridContainer = document.getElementById('grid-view');
    if (!gridContainer) return;

    gridContainer.innerHTML = ports.map(p => {
        const proc = p.process || {};
        const isProject = proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System';
        const isHTTPHealthy = p.health === 'healthy' || p.health === 'degraded';
        const isProtected = proc.isProtected || (proc.pid && proc.pid <= 4);
        const isDb = proc.isDatabase || proc.projectType === 'Database';
        const displayName = proc.projectName || proc.name || (currentLang === 'es' ? 'Servicio del Sistema' : 'System Service');
        const desc = proc.description || proc.cmdline || '-';

        return `
            <div class="bg-dark-800 border ${isProject ? 'border-emerald-500/30 shadow-emerald-950/20 shadow-lg' : 'border-slate-800'} rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="text-xl font-bold text-emerald-400">:${p.port}</span>
                            <span class="text-[10px] text-slate-500 uppercase border border-slate-700 px-1.5 py-0.5 rounded">${p.protocol}</span>
                            ${isProject ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded font-mono">DEV</span>' : ''}
                            ${isDb ? '<span class="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-mono">DB</span>' : ''}
                        </div>
                        ${getHealthBadge(p.health, p.healthCode, p.healthTimeMs)}
                    </div>
                    <div class="mt-3">
                        <h4 class="font-bold text-white text-sm truncate" title="${desc}">${displayName}</h4>
                        <p class="text-xs text-slate-400 mt-0.5">PID: <span class="font-mono text-slate-200">${proc.pid || '-'}</span> • ${getTypeBadge(proc.projectType || 'Binary')}</p>
                        <p class="text-[11px] text-slate-400 truncate mt-2 cursor-help" title="${desc}">${desc}</p>
                    </div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div>🧠 ${proc.memoryMB ? proc.memoryMB.toFixed(1) + ' MB' : '-'} • ⏱️ ${proc.uptime || '-'}</div>
                    <div class="flex items-center space-x-1.5">
                        ${isHTTPHealthy ? `
                        <button onclick="openPortInBrowser(${p.port})" title="${t('openBrowserTitle', { port: p.port })}" class="p-1 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded hover:bg-cyan-500/20 transition">🌐</button>` : ''}
                        ${proc.cmdline && !isProtected ? `
                        <button onclick="hotCycleProcess(${proc.pid}, ${p.port})" title="${t('hotCycleTitle')}" class="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition">${t('restartBtn')}</button>` : ''}
                        ${isProtected ? `
                        <span class="px-2 py-1 text-[11px] bg-slate-800 text-slate-400 rounded border border-slate-700 select-none cursor-not-allowed font-mono">🛡️ ${t('shieldBadge')}</span>` : isDb ? `
                        <button onclick="killProcess(${proc.pid}, ${p.port}, true, '${displayName}')" title="${t('killDbTitle')}" class="px-2 py-1 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/20 transition">${t('killDbBtn')}</button>` : `
                        <button onclick="killProcess(${proc.pid}, ${p.port}, false, '${displayName}')" title="${t('killTitle')}" class="px-2 py-1 text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded hover:bg-rose-500/20 transition">${t('killBtn')}</button>`}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function openPortInBrowser(port) {
    try {
        await fetch(`/api/open-browser?port=${port}`);
        showToast(currentLang === 'es' ? `Abriendo http://localhost:${port} en el navegador...` : `Opening http://localhost:${port} in browser...`, 'info');
        recordAction('🌐 OPEN BROWSER', `http://localhost:${port}`, true);
    } catch (err) {
        window.open(`http://localhost:${port}`, '_blank');
    }
}

function getHealthBadge(status, code, latencyMs) {
    const latencyStr = latencyMs ? ` (${latencyMs}ms)` : '';
    const isEs = currentLang === 'es';

    if (status === 'healthy') {
        const title = isEs 
            ? `Servicio HTTP Activo y Saludable (Código: ${code || '200'}${latencyStr}). Responde peticiones web correctamente.`
            : `Active & Healthy HTTP Service (Code: ${code || '200'}${latencyStr}). Responding correctly.`;
        return `<span title="${title}" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-help">🟢 200 OK${latencyStr}</span>`;
    }
    if (status === 'degraded') {
        const title = isEs
            ? `Servicio HTTP alcanzado con advertencia (Código: ${code}${latencyStr}). Responde pero reportó un error HTTP.`
            : `HTTP Service reached with warning (Code: ${code}${latencyStr}).`;
        return `<span title="${title}" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help">🟡 ${code || 'Warning'}${latencyStr}</span>`;
    }
    if (status === 'unhealthy') {
        const title = isEs
            ? `Sin respuesta HTTP: Conexión rechazada o Timeout. Si tu servidor está bloqueado o congelado, prueba el botón 'Restart'.`
            : `No HTTP Response: Connection Refused or Timeout. Try the 'Restart' button.`;
        return `<span title="${title}" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help">🔴 Unhealthy</span>`;
    }
    const idleTitle = isEs
        ? `En Espera (Idle): El puerto está en escucha (LISTEN). Haz clic en 'Health Check' arriba para sondear si responde HTTP.`
        : `Idle: Port is in LISTEN state. Click 'Health Check' above to test.`;
    return `<span title="${idleTitle}" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700 cursor-help">⚪ Idle</span>`;
}

function getTypeBadge(type) {
    const isEs = currentLang === 'es';
    const descriptions = isEs ? {
        'Node.js': 'Entorno JavaScript/TypeScript (Next.js, Vite, Express, Nest, etc.)',
        'Go': 'Servicio compilado en Golang',
        'Python': 'Aplicación Python (FastAPI, Flask, Django, Uvicorn)',
        'Rust': 'Binario de alto rendimiento escrito en Rust',
        'Docker': 'Contenedor o motor Docker/Containerd',
        'Database': 'Motor de base de datos (PostgreSQL, MySQL, Redis, MongoDB)',
        'Binary': 'Ejecutable nativo del sistema'
    } : {
        'Node.js': 'JavaScript/TypeScript runtime (Next.js, Vite, Express, etc.)',
        'Go': 'Golang compiled native service',
        'Python': 'Python application (FastAPI, Flask, Django, Uvicorn)',
        'Rust': 'High-performance Rust binary',
        'Docker': 'Container or Docker/Containerd engine',
        'Database': 'Database engine (PostgreSQL, MySQL, Redis, MongoDB)',
        'Binary': 'Native OS executable binary'
    };

    const desc = descriptions[type] || (isEs ? 'Tecnología detectada' : 'Detected technology');

    const colors = {
        'Node.js': 'bg-green-500/10 text-green-400 border-green-500/20',
        'Go': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        'Python': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        'Rust': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        'Docker': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'Database': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    const c = colors[type] || 'bg-slate-700/20 text-slate-400 border-slate-700';
    return `<span title="${desc}" class="inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${c} cursor-help">${type}</span>`;
}

// Action History Management
function recordAction(actionType, details, success) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
        id: Date.now(),
        type: actionType,
        details: details,
        success: success,
        time: timestamp
    };
    actionHistory.unshift(entry);
    updateHistoryUI();
}

function updateHistoryUI() {
    const list = document.getElementById('history-list');
    const badge = document.getElementById('history-badge');

    if (actionHistory.length > 0) {
        if (badge) {
            badge.innerText = actionHistory.length;
            badge.classList.remove('hidden');
        }

        if (list) {
            list.innerHTML = actionHistory.map(item => `
                <div class="bg-dark-800 border ${item.success ? 'border-slate-800' : 'border-rose-900/50'} rounded-lg p-3">
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                        <span class="font-bold ${item.success ? 'text-emerald-400' : 'text-rose-400'}">${item.type}</span>
                        <span>${item.time}</span>
                    </div>
                    <p class="text-xs text-slate-200 mt-1">${item.details}</p>
                </div>
            `).join('');
        }
    } else {
        if (badge) badge.classList.add('hidden');
        if (list) list.innerHTML = `<p class="text-slate-500 text-center py-8">${t('historyEmpty')}</p>`;
    }
}

function clearHistory() {
    actionHistory = [];
    updateHistoryUI();
}

function toggleHistoryDrawer() {
    const drawer = document.getElementById('history-drawer');
    if (drawer) drawer.classList.toggle('translate-x-full');
}

function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.classList.toggle('hidden');
}

async function killProcess(pid, port, isDatabase = false, procName = '') {
    const label = procName ? ` (${procName})` : '';
    if (isDatabase) {
        const warning = t('killDbWarningPrompt', { port, pid, label });
        if (!confirm(warning)) return;
    } else {
        if (!confirm(t('killConfirmPrompt', { port, pid, label }))) return;
    }
    try {
        const res = await fetch(`/api/kill?pid=${pid}&port=${port}`, { method: 'POST' });
        const resData = await res.json();
        if (res.ok) {
            const msg = t('processKilledSuccess', { port, pid });
            showToast(msg, 'success');
            recordAction('🛑 KILL PROCESS', msg, true);
        } else {
            const errMsg = resData.error || (currentLang === 'es' ? 'Fallo al terminar el proceso' : 'Failed to kill process');
            showToast(errMsg, 'error');
            recordAction('❌ KILL FAILED', `:${port} - ${errMsg}`, false);
        }
    } catch (err) {
        showToast(currentLang === 'es' ? 'Error de red al intentar finalizar el proceso.' : 'Network error attempting to terminate process.', 'error');
        recordAction('❌ NETWORK ERROR', `:${port}`, false);
    }
}

async function hotCycleProcess(pid, port) {
    if (!confirm(t('restartConfirmPrompt', { port, pid }))) return;
    try {
        const res = await fetch(`/api/restart?pid=${pid}`, { method: 'POST' });
        const resData = await res.json();
        if (res.ok) {
            const msg = t('processRestartedSuccess', { port, newPid: resData.newPid });
            showToast(msg, 'success');
            recordAction('🔄 HOT-CYCLE RESTART', msg, true);
        } else {
            const errMsg = resData.error || (currentLang === 'es' ? 'Fallo al reiniciar el proceso' : 'Failed to restart process');
            showToast(errMsg, 'error');
            recordAction('❌ RESTART FAILED', `:${port} - ${errMsg}`, false);
        }
    } catch (err) {
        showToast(currentLang === 'es' ? 'Error de red al reiniciar el proceso.' : 'Network error restarting process.', 'error');
        recordAction('❌ NETWORK ERROR', `:${port}`, false);
    }
}

async function triggerHealthCheck() {
    showToast(t('healthCheckLaunched'), 'info');
    recordAction('🩺 HEALTH CHECK', currentLang === 'es' ? 'Sondeo general de salud HTTP lanzado.' : 'HTTP health check probe triggered.', true);
    try {
        await fetch('/api/healthcheck', { method: 'POST' });
    } catch (e) {
        console.error(e);
    }
}

function setViewMode(mode) {
    viewMode = mode;
    const tableContainer = document.getElementById('table-view');
    const gridContainer = document.getElementById('grid-view');
    const tableBtn = document.getElementById('view-table-btn');
    const gridBtn = document.getElementById('view-grid-btn');

    if (mode === 'table') {
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (gridContainer) gridContainer.classList.add('hidden');
        if (tableBtn) tableBtn.className = 'px-3 py-1 text-xs rounded font-medium bg-slate-700 text-white';
        if (gridBtn) gridBtn.className = 'px-3 py-1 text-xs rounded font-medium text-slate-400 hover:text-white';
    } else {
        if (tableContainer) tableContainer.classList.add('hidden');
        if (gridContainer) gridContainer.classList.remove('hidden');
        if (gridBtn) gridBtn.className = 'px-3 py-1 text-xs rounded font-medium bg-slate-700 text-white';
        if (tableBtn) tableBtn.className = 'px-3 py-1 text-xs rounded font-medium text-slate-400 hover:text-white';
    }
    renderView();
}

function filterPorts() {
    renderView();
}

function toggleExportMenu() {
    const el = document.getElementById('export-dropdown');
    if (el) el.classList.toggle('hidden');
}

function exportData(format) {
    window.open(`/api/export?format=${format}`, '_blank');
    toggleExportMenu();
    recordAction('📥 EXPORT DATA', t('dataExported', { format: format.toUpperCase() }), true);
}

// Toast notification
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toast.innerHTML = `<span class="flex-1">${msg}</span><button onclick="hideToast()" class="ml-3 text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 transition text-sm">✕</button>`;

    if (type === 'success') {
        toast.className = 'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 border bg-emerald-950/95 text-emerald-200 border-emerald-500 opacity-100 transform translate-y-0 transition-all duration-300';
    } else if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 border bg-rose-950/95 text-rose-200 border-rose-500 opacity-100 transform translate-y-0 transition-all duration-300';
    } else {
        toast.className = 'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 border bg-dark-800/95 text-slate-200 border-slate-700 opacity-100 transform translate-y-0 transition-all duration-300';
    }

    toastTimeout = setTimeout(() => {
        hideToast();
    }, 9000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.className = 'fixed bottom-5 right-5 transform translate-y-20 opacity-0 transition-all duration-300 z-50 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center space-x-2 border pointer-events-none';
    }
}

// Quick Filter Controller for Interactive Badges & Chips
function quickFilter(type, value) {
    if (type === 'devOnly') {
        devOnlyFilter = !devOnlyFilter;
        const btn = document.getElementById('dev-only-btn');
        if (btn) {
            btn.className = devOnlyFilter 
                ? 'px-3 py-1.5 text-xs rounded-lg font-bold border border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm transition flex items-center space-x-1.5'
                : 'px-3 py-1.5 text-xs rounded-lg font-medium border border-slate-700 bg-dark-900 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition flex items-center space-x-1.5';
        }
        showToast(devOnlyFilter ? (currentLang === 'es' ? '⚡ Filtro: Mostrando solo proyectos y puertos dev' : '⚡ Filter: Showing dev projects and ports only') : (currentLang === 'es' ? 'Mostrando todos los puertos' : 'Showing all ports'), 'info');
    } else if (type === 'tech') {
        const typeSelect = document.getElementById('type-filter');
        if (typeSelect) {
            typeSelect.value = value;
        }
        showToast(`${currentLang === 'es' ? 'Filtrado por tecnología' : 'Filtered by technology'}: ${value}`, 'info');
    } else if (type === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = value;
        }
        showToast(`${currentLang === 'es' ? 'Búsqueda' : 'Search'}: ${value}`, 'info');
    }
    renderView();
}

// Telemetry Modal Controller
function toggleTelemetryModal() {
    const modal = document.getElementById('telemetry-modal');
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            const totalMem = metricsHistory.memoryMB.length > 0 ? metricsHistory.memoryMB[metricsHistory.memoryMB.length - 1] : 0;
            updateTelemetryModalContent(portsData, totalMem, portsData.length);
            fetch('/api/healthcheck', { method: 'POST' }).catch(console.error);
        }
    }
}

// Detailed Chart Renderer with Scales, Axes, Gridlines & Units
function renderDetailedChartSVG(data, width = 280, height = 120, unit = 'MB', strokeColor = '#22d3ee', fillColor = 'rgba(34, 211, 238, 0.12)') {
    const paddingLeft = 48;
    const paddingRight = 10;
    const paddingTop = 12;
    const paddingBottom = 22;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const safeData = (data && data.length > 0) ? data : [0, 0];
    const maxVal = Math.max(...safeData, 1);
    const minVal = 0;
    const midVal = maxVal / 2;

    const formatY = (v) => {
        if (unit === 'MB') {
            if (v >= 1000) return (v / 1024).toFixed(1) + 'GB';
            return Math.round(v) + 'MB';
        }
        if (unit === 'sockets' || unit === '') {
            return Math.round(v).toString();
        }
        return Math.round(v) + (unit ? ' ' + unit : '');
    };

    const formatZero = () => {
        if (unit === 'MB') return '0MB';
        return '0';
    };

    // Calculate Coordinates
    const points = safeData.map((val, idx) => {
        const x = paddingLeft + (idx / Math.max(safeData.length - 1, 1)) * plotWidth;
        const normalizedY = (val - minVal) / (maxVal - minVal || 1);
        const y = (paddingTop + plotHeight) - (normalizedY * plotHeight);
        return { x: x.toFixed(1), y: y.toFixed(1) };
    });

    const pathD = 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ');
    const areaD = `${pathD} L ${(paddingLeft + plotWidth).toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} L ${paddingLeft},${(paddingTop + plotHeight).toFixed(1)} Z`;

    const yMaxPos = paddingTop;
    const yMidPos = paddingTop + (plotHeight / 2);
    const yZeroPos = paddingTop + plotHeight;

    const nowLabel = currentLang === 'es' ? '0s (Ahora)' : '0s (Now)';

    return `
        <!-- Background Gridlines -->
        <line x1="${paddingLeft}" y1="${yMaxPos}" x2="${width - paddingRight}" y2="${yMaxPos}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" opacity="0.6" />
        <line x1="${paddingLeft}" y1="${yMidPos}" x2="${width - paddingRight}" y2="${yMidPos}" stroke="#1e293b" stroke-dasharray="3,3" stroke-width="1" />
        <line x1="${paddingLeft}" y1="${yZeroPos}" x2="${width - paddingRight}" y2="${yZeroPos}" stroke="#475569" stroke-width="1" />
        
        <!-- Y-Axis Ticks & Units -->
        <text x="${paddingLeft - 6}" y="${yMaxPos + 3}" fill="#94a3b8" font-size="8.5" text-anchor="end" font-family="monospace" font-weight="bold">${formatY(maxVal)}</text>
        <text x="${paddingLeft - 6}" y="${yMidPos + 3}" fill="#64748b" font-size="8.5" text-anchor="end" font-family="monospace">${formatY(midVal)}</text>
        <text x="${paddingLeft - 6}" y="${yZeroPos}" fill="#64748b" font-size="8.5" text-anchor="end" font-family="monospace">${formatZero()}</text>

        <!-- Area & Curve -->
        <path d="${areaD}" fill="${fillColor}" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        <!-- X-Axis Labels (Time) -->
        <text x="${paddingLeft}" y="${height - 4}" fill="#64748b" font-size="8.5" text-anchor="start" font-family="monospace">-60s</text>
        <text x="${paddingLeft + plotWidth / 2}" y="${height - 4}" fill="#64748b" font-size="8.5" text-anchor="middle" font-family="monospace">-30s</text>
        <text x="${width - paddingRight}" y="${height - 4}" fill="#94a3b8" font-size="8.5" text-anchor="end" font-family="monospace" font-weight="bold">${nowLabel}</text>
    `;
}

function updateTelemetryModalContent(ports, totalMem, totalPortsCount) {
    const modal = document.getElementById('telemetry-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    // 1. Update Current Values & Detailed Charts with Scales & Units
    const memCurrent = document.getElementById('telemetry-mem-current');
    if (memCurrent) memCurrent.innerText = `${totalMem.toFixed(1)} MB`;

    const portsCurrent = document.getElementById('telemetry-ports-current');
    if (portsCurrent) portsCurrent.innerText = `${totalPortsCount} ${t('unitSockets')}`;

    const memChart = document.getElementById('telemetry-chart-mem');
    if (memChart) {
        memChart.innerHTML = renderDetailedChartSVG(metricsHistory.memoryMB, 280, 120, 'MB', '#22d3ee', 'rgba(34, 211, 238, 0.12)');
    }

    const portsChart = document.getElementById('telemetry-chart-ports');
    if (portsChart) {
        portsChart.innerHTML = renderDetailedChartSVG(metricsHistory.totalPorts, 280, 120, 'sockets', '#34d399', 'rgba(52, 211, 153, 0.12)');
    }

    // 2. Top Memory Consumers List (sorted by memoryMB descending)
    const topProcsList = document.getElementById('telemetry-top-procs-list');
    if (topProcsList) {
        const validProcs = ports
            .filter(p => p.process && p.process.memoryMB > 0)
            .map(p => ({
                port: p.port,
                pid: p.process.pid,
                name: p.process.projectName || p.process.name || `PID ${p.process.pid}`,
                mem: p.process.memoryMB,
                isProtected: p.process.isProtected
            }))
            .sort((a, b) => b.mem - a.mem)
            .slice(0, 5);

        if (validProcs.length > 0) {
            const maxMem = validProcs[0].mem || 1;
            topProcsList.innerHTML = validProcs.map(p => {
                const pct = ((p.mem / maxMem) * 100).toFixed(0);
                return `
                    <div class="bg-dark-800 p-2 rounded-lg border border-slate-800">
                        <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-bold text-slate-200 truncate max-w-[180px]">${p.name} <span class="text-slate-500 font-mono">(:${p.port})</span></span>
                            <span class="font-mono text-cyan-400 font-bold">${p.mem.toFixed(1)} MB</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-cyan-400 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            topProcsList.innerHTML = `<p class="text-slate-500 text-center py-4">${t('noMemTelemetry')}</p>`;
        }
    }

    // 3. HTTP Endpoints Latency Matrix
    const httpList = document.getElementById('telemetry-http-list');
    if (httpList) {
        const devPorts = [3000, 3001, 3333, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000, 9090, 9119, 54600, 54601, 54602, 54603];
        const candidatePorts = ports.filter(p => {
            const proto = (p.protocol || '').toLowerCase();
            const proc = p.process || {};
            const isDev = (proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System') || devPorts.includes(p.port);
            return p.healthTimeMs > 0 || p.health === 'healthy' || p.health === 'degraded' || (proto.includes('tcp') && isDev);
        });

        if (candidatePorts.length > 0) {
            httpList.innerHTML = candidatePorts.map(p => {
                const is200 = p.health === 'healthy';
                const isDegraded = p.health === 'degraded';
                const latency = p.healthTimeMs || 0;
                const proc = p.process || {};
                const name = proc.projectName || proc.name || (currentLang === 'es' ? 'Servicio Web' : 'Web Service');
                const codeBadge = is200 ? '200 OK' : isDegraded ? (p.healthCode || 'ERR') : 'TCP Socket';
                const badgeColor = is200 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : isDegraded ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700';
                const statusDot = is200 ? 'bg-emerald-400 animate-pulse' : isDegraded ? 'bg-amber-400' : 'bg-cyan-400';

                return `
                    <div class="flex items-center justify-between bg-dark-800 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                        <div class="flex items-center space-x-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full ${statusDot} shrink-0"></span>
                            <span class="font-bold text-emerald-400 font-mono text-xs">:${p.port}</span>
                            <span class="text-xs text-slate-200 font-medium truncate max-w-[140px]" title="${name}">${name}</span>
                        </div>
                        <div class="flex items-center space-x-2 shrink-0">
                            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeColor}">${codeBadge}</span>
                            <span class="text-xs font-mono font-bold ${latency > 0 ? (latency < 50 ? 'text-emerald-400' : latency < 200 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-500'}">
                                ${latency > 0 ? latency + 'ms' : 'active'}
                            </span>
                            ${is200 ? `<button onclick="openPortInBrowser(${p.port})" title="${t('openBrowserTitle', { port: p.port })}" class="p-1 text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded border border-cyan-500/20 transition">🌐</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            httpList.innerHTML = `<p class="text-slate-500 text-center py-4">${t('noHttpEndpoints')}</p>`;
        }
    }

    // 4. Protocol Matrix Counts
    let tcpCount = 0;
    let udpCount = 0;
    let ipv6Count = 0;
    let shieldedCount = 0;

    ports.forEach(p => {
        const proto = (p.protocol || '').toLowerCase();
        if (proto.includes('tcp')) tcpCount++;
        if (proto.includes('udp')) udpCount++;
        if (proto.includes('6')) ipv6Count++;
        if (p.process && p.process.isProtected) shieldedCount++;
    });

    const tcpElem = document.getElementById('telemetry-proto-tcp');
    const udpElem = document.getElementById('telemetry-proto-udp');
    const ipv6Elem = document.getElementById('telemetry-proto-ipv6');
    const shieldElem = document.getElementById('telemetry-proto-shielded');
    if (tcpElem) tcpElem.innerText = tcpCount;
    if (udpElem) udpElem.innerText = udpCount;
    if (ipv6Elem) ipv6Elem.innerText = ipv6Count;
    if (shieldElem) shieldElem.innerText = shieldedCount;
}

// Telemetry Report Exporter (Markdown & JSON)
function exportTelemetryReport(format = 'md') {
    const timestamp = new Date().toISOString();
    const ports = portsData || [];
    const totalMem = metricsHistory.memoryMB.length > 0 ? metricsHistory.memoryMB[metricsHistory.memoryMB.length - 1] : 0;
    
    let devCount = 0, dbCount = 0, sysCount = 0, healthyCount = 0, degradedCount = 0, unhealthyCount = 0, idleCount = 0;
    const commonDevPorts = [3000, 3001, 3333, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8888, 9000, 9090, 9119];
    
    ports.forEach(p => {
        const proc = p.process || {};
        const isProtected = proc.isProtected || (proc.pid && proc.pid <= 4) || proc.projectType === 'System' || (proc.name || '').toLowerCase() === 'system';
        const isDb = proc.isDatabase || proc.projectType === 'Database';
        const isDevProject = (proc.projectType && proc.projectType !== 'Binary' && proc.projectType !== 'Unknown' && proc.projectType !== 'System' && proc.projectType !== 'Database') || commonDevPorts.includes(p.port);

        if (isProtected) sysCount++;
        else if (isDb) dbCount++;
        else if (isDevProject) devCount++;

        if (p.health === 'healthy') healthyCount++;
        else if (p.health === 'degraded') degradedCount++;
        else if (p.health === 'unhealthy') unhealthyCount++;
        else idleCount++;
    });

    const topProcs = ports
        .filter(p => p.process && p.process.memoryMB > 0)
        .map(p => ({
            port: p.port,
            pid: p.process.pid,
            name: p.process.projectName || p.process.name || `PID ${p.process.pid}`,
            memMB: Number(p.process.memoryMB.toFixed(1)),
            type: p.process.projectType || 'Binary'
        }))
        .sort((a, b) => b.memMB - a.memMB)
        .slice(0, 10);

    const httpEndpoints = ports
        .filter(p => p.health === 'healthy' || p.health === 'degraded' || p.healthTimeMs > 0)
        .map(p => ({
            port: p.port,
            name: p.process ? (p.process.projectName || p.process.name) : '-',
            status: p.health,
            statusCode: p.healthCode || '200',
            latencyMs: p.healthTimeMs || 0
        }));

    if (format === 'json') {
        const report = {
            title: "scaport Telemetry & Performance Report",
            author: "eyejdev (GOENMA Ecosystem)",
            generatedAt: timestamp,
            summary: {
                totalSockets: ports.length,
                devSockets: devCount,
                databaseSockets: dbCount,
                systemSockets: sysCount,
                totalMemoryRSS_MB: totalMem,
                healthyEndpoints: healthyCount,
                degradedEndpoints: degradedCount,
                unhealthyEndpoints: unhealthyCount,
                idleSockets: idleCount
            },
            timeSeriesBuffer: metricsHistory,
            topMemoryConsumers: topProcs,
            httpEndpoints: httpEndpoints
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scaport-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t('telemetryExportedJson'), 'success');
        recordAction('📥 EXPORT TELEMETRY', 'JSON telemetry report exported', true);
    } else {
        const isEs = currentLang === 'es';
        let md = isEs 
            ? `# 📊 scaport - Reporte de Telemetría y Rendimiento en Vivo\n\n`
            : `# 📊 scaport - Live Telemetry & Performance Report\n\n`;
        md += `> **${isEs ? 'Generado el' : 'Generated at'}:** ${new Date().toLocaleString()} | **${isEs ? 'Autor' : 'Author'}:** [scaport](https://github.com/eyejdev/scaport) by eyejdev (GOENMA)\n\n`;
        md += `## 1. ${isEs ? 'Resumen Ejecutivo de Red y Recursos' : 'Executive Network & Resource Summary'}\n\n`;
        md += `- **${isEs ? 'Memoria RAM Acumulada (RSS)' : 'Accumulated RAM (RSS)'}:** \`${totalMem} MB\`\n`;
        md += `- **${isEs ? 'Sockets Activos' : 'Active Sockets'}:** \`${ports.length}\` (⚡ Dev: \`${devCount}\`, 🗄️ DB: \`${dbCount}\`, 🛡️ System: \`${sysCount}\`)\n`;
        md += `- **${isEs ? 'Salud de Servicios HTTP' : 'HTTP Services Health'}:** 🟢 \`${healthyCount} Online\` | 🟡 \`${degradedCount} Degraded\` | 🔴 \`${unhealthyCount} Blocked\` | ⚪ \`${idleCount} Idle\`\n\n`;
        
        md += `## 2. ${isEs ? 'Top Consumidores de Memoria RAM (RSS)' : 'Top Memory Consumers (RSS)'}\n\n`;
        md += `| ${isEs ? 'Proceso / Proyecto' : 'Process / Project'} | ${isEs ? 'Puerto' : 'Port'} | PID | ${isEs ? 'Tipo' : 'Type'} | ${isEs ? 'Memoria (RSS)' : 'Memory (RSS)'} |\n`;
        md += `| :--- | :---: | :---: | :---: | ---: |\n`;
        topProcs.forEach(p => {
            md += `| **${p.name}** | \`:${p.port}\` | \`${p.pid}\` | \`${p.type}\` | **${p.memMB} MB** |\n`;
        });
        md += `\n`;

        md += `## 3. ${isEs ? 'Matriz de Latencias y Endpoints Web (HTTP)' : 'HTTP Latencies & Endpoints Matrix'}\n\n`;
        md += `| ${isEs ? 'Puerto' : 'Port'} | ${isEs ? 'Nombre de Servicio' : 'Service Name'} | ${isEs ? 'Estado' : 'Status'} | ${isEs ? 'Código HTTP' : 'HTTP Code'} | ${isEs ? 'Latencia (RTT)' : 'Latency (RTT)'} |\n`;
        md += `| :---: | :--- | :---: | :---: | ---: |\n`;
        httpEndpoints.forEach(h => {
            md += `| \`:${h.port}\` | ${h.name} | \`${h.status}\` | \`${h.statusCode}\` | **${h.latencyMs} ms** |\n`;
        });
        md += `\n---\n*Report generated automatically by [scaport](https://github.com/eyejdev/scaport) — GOENMA Developer Tools.*`;

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scaport-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t('telemetryExportedMd'), 'success');
        recordAction('📥 EXPORT TELEMETRY', 'Markdown telemetry report exported', true);
    }
}

// Start SSE & Tips Carousel on page load
window.addEventListener('DOMContentLoaded', () => {
    initSSE();
    startTipsCarousel();
});
