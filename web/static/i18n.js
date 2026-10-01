// scaport Internationalization (i18n) Dictionary: Spanish (es) & English (en)
// Author: eyejdev | Ecosystem: GOENMA

const translations = {
    es: {
        // App brand & subheadings
        appSubtitle: "Smart Port & Process Orchestrator",
        sseConnected: "SSE CONECTADO",
        sseLive: "SSE EN VIVO",
        reconnecting: "RECONECTANDO...",
        
        // Navigation buttons & toggles
        langBtnTitle: "Cambiar idioma (Español / English)",
        themeBtnTitle: "Alternar tema Claro / Oscuro",
        watchOff: "Watch: OFF",
        watchOn: "Watch: ACTIVO",
        watchTitle: "Activa la vigilancia continua de puertos con auto-sondeo y alertas de audio/visuales",
        telemetryBtn: "📊 Telemetría",
        telemetryTitle: "Abrir monitor de telemetría y rendimiento en tiempo real",
        healthCheckBtn: "🩺 Health Check",
        healthCheckTitle: "Lanzar sondeo HTTP inmediato en todos los puertos",
        historyBtn: "📜 Historial",
        historyTitle: "Abrir registro histórico de acciones",
        guideBtn: "💡 Guía & FAQs",
        guideTitle: "Abrir guía de uso y preguntas frecuentes",
        exportBtn: "📥 Exportar",
        
        // Export menu
        exportJsonTitle: "Datos JSON (.json)",
        exportJsonSub: "Para scripts, jq y CI/CD",
        exportMdTitle: "Tabla Markdown (.md)",
        exportMdSub: "Para GitHub, PRs y Docs",
        exportCsvTitle: "Hoja de Cálculo CSV (.csv)",
        exportCsvSub: "Para Excel y Google Sheets",
        exportHtmlTitle: "HTML Autónomo (.html)",
        exportHtmlSub: "Reporte visual offline listo",
        exportTelemMdTitle: "Informe Telemetría (.md)",
        exportTelemMdSub: "Informe de telemetría y latencias",
        exportTelemJsonTitle: "Telemetría JSON (.json)",
        exportTelemJsonSub: "Muestreo crudo de series temporales",

        // Advisor banner
        advisorTitleDefault: "Consejo de Desarrollo & Arquitectura GOENMA",
        advisorTagDefault: "SABIDURÍA DEV",
        advisorTipPrefix: "💡 Consejo #",
        analyzingAdvisor: "Analizando comportamiento de puertos y entorno...",
        prevTipTitle: "Consejo anterior",
        randomTipTitle: "Consejo aleatorio",
        nextTipTitle: "Siguiente consejo (Auto-rotación cada 15s)",
        nextTipBtn: "Siguiente ▶",

        // Alert titles & messages
        alertUnhealthyTitle: "Alerta: Servicio Web Bloqueado o Sin Respuesta",
        alertUnhealthyTag: "ALERTA CRÍTICA",
        alertCollisionTitle: "Múltiples Puertos de Desarrollo en Uso",
        alertCollisionTag: "AVISO DE PUERTOS",
        alertMemTitle: "Aviso de Consumo Elevado de RAM en Proceso",
        alertMemTag: "AVISO DE MEMORIA",

        // Card 1: Active Sockets
        cardSocketsTitle: "Sockets Activos",
        unitSockets: "puertos",
        scaleSockets: "Escala: Min: {min} | Max: {max} sockets",
        timeScale: "-60s ─── 0s",
        devOnlyChip: "Dev",
        dbChip: "DB",
        sysChip: "Sys",
        devOnlyChipTitle: "Filtrar proyectos y puertos dev",
        dbChipTitle: "Filtrar bases de datos",
        sysChipTitle: "Filtrar procesos protegidos del sistema",

        // Card 2: Health & Traffic
        cardHealthTitle: "Salud & Tráfico",
        probeNowTitle: "Lanzar sondeo HTTP inmediato",
        healthDistTitle: "Distribución de salud HTTP",
        healthOnline: "Online",
        healthIdle: "Idle",
        healthBlocked: "Bloqueado",
        healthOnlineTitle: "Servicios respondiendo HTTP 200 OK",
        healthIdleTitle: "Sockets a la escucha sin servidor HTTP",
        healthBlockedTitle: "Servicios sin respuesta o con error",

        // Card 3: Total Memory
        cardMemoryTitle: "Memoria Total (RSS)",
        scaleMem: "Escala: Min: {min} | Max: {max}",
        topConsumerTitle: "Mayor consumidor: {name} con {mem} MB",
        topConsumerEmpty: "Sin actividad alta",
        memStatusNormal: "Normal",
        memStatusModerate: "Moderado",
        memStatusHigh: "Elevado (>3GB)",

        // Card 4: Dev Ecosystem
        cardEcosystemTitle: "Ecosistema Dev",
        unitProjects: "proyectos",
        stackDistTitle: "Distribución de tecnologías activas",
        detectingStack: "Detectando stack...",
        noFrameworks: "Ningún framework detectado",

        // Search & Controls Bar
        searchPlaceholder: "Buscar puerto, PID, proyecto, tecnología...",
        devOnlyBtn: "⚡ Solo Dev",
        devOnlyBtnTitle: "Mostrar únicamente proyectos de desarrollo (ocultar puertos de sistema)",
        allTechOption: "Todas las Tecnologías",
        dbTechOption: "Bases de Datos",
        sysTechOption: "Sistema & Protegidos",
        viewTable: "Tabla",
        viewGrid: "Cuadrícula",

        // Table Headers
        thPortProto: "Puerto / Proto",
        thHealth: "Salud",
        thHealthTooltip: "Estado de Salud: Muestra si un endpoint HTTP/HTTPS responde. Haz clic en 'Health Check' arriba para sondear.",
        thPID: "PID",
        thProjectProcess: "Proyecto / Proceso",
        thType: "Tipo",
        thMemory: "Memoria",
        thUptime: "Tiempo Activo",
        thActions: "Acciones",
        noPortsFound: "No se encontraron puertos activos que coincidan con el filtro.",

        // Action Buttons & Badges
        openBrowserTitle: "Abrir http://localhost:{port} en el navegador",
        hotCycleTitle: "Hot-Cycle: Finaliza y vuelve a arrancar este proceso en su misma carpeta",
        restartBtn: "Reiniciar",
        shieldBadge: "Shield",
        shieldTitle: "Servicio del sistema protegido por System Shield contra terminación accidental",
        killDbBtn: "Kill DB",
        killDbTitle: "Base de Datos activa: Finalizar con precaución",
        killBtn: "Kill",
        killTitle: "Kill: Mata el proceso y libera el puerto de inmediato",
        copyCurlTitle: "Copiar comando curl para probar endpoint en terminal",
        copyCurlSuccess: "Comando curl copiado al portapapeles",

        // Drawer History
        historyDrawerTitle: "Historial de Acciones & Auditoría",
        historyClearBtn: "Limpiar",
        historyEmpty: "No se han ejecutado acciones aún.",

        // Telemetry Modal
        telemetryModalTitle: "Telemetría de Rendimiento y Tráfico en Vivo",
        telemetryModalSub: "Historial en tiempo real de sockets, memoria física y latencias HTTP",
        telemetryMemChartTitle: "Evolución de RAM (RSS)",
        telemetryPortsChartTitle: "Sockets Activos & Dev Ports",
        yAxisMB: "Eje Y: Consumo en MB",
        yAxisSockets: "Eje Y: Cantidad de sockets",
        xAxisTime: "Eje X: Tiempo transcurrido",
        topProcsHeader: "Top Consumo de Memoria por Proceso",
        httpMatrixHeader: "Latencia de Endpoints Web (HTTP)",
        testBtn: "Probar",
        noHttpEndpoints: "No se detectaron servidores web. Pulsa Test para escanear.",
        noMemTelemetry: "No hay telemetría de memoria en procesos de usuario.",
        protocolMatrixHeader: "Matriz de Protocolos de Red (TCP / UDP / IPv6)",
        tcpSockets: "Sockets TCP",
        udpSockets: "Sockets UDP",
        ipv6Sockets: "IPv6 / Dual-Stack",
        shieldedSockets: "System Shield",
        exportReportLabel: "Exportar informe:",
        closeTelemetryBtn: "Cerrar Monitor",

        // Help Modal
        helpModalTitle: "Guía de Uso & Conceptos Clave (scaport)",
        helpModalSub: "Aprende a interpretar estados, resolver bloqueos y usar atajos",
        understoodBtn: "Entendido",
        
        // Help Sections Content
        helpSec1Title: "👁️ ¿Qué es y qué hace el \"Modo Monitor / Watch Daemon\"?",
        helpSec1Intro: "scaport cuenta con dos niveles de supervisión:",
        helpSec1Item1Title: "1. Descubrimiento Pasivo (SSE):",
        helpSec1Item1Desc: "Lee la tabla de sockets del Sistema Operativo en tiempo real sin enviar tráfico de red. Consume menos de 0.1% de CPU y está activo por defecto.",
        helpSec1Item2Title: "2. Watch Daemon Activo (Botón 👁️):",
        helpSec1Item2Desc: "Además de leer sockets, envía peticiones HTTP periódicas para comprobar si el servidor está respondiendo o congelado en bucle infinito (deadlock).",
        helpSec2Title: "🩺 ¿Qué significa la columna \"Health\"?",
        helpSec2Intro: "Evalúa la disponibilidad real del servidor web realizando peticiones HTTP asíncronas:",
        helpSec2Idle: "⚪ Idle: Socket abierto a nivel de OS, en espera de healthcheck o servicio no-HTTP.",
        helpSec2Ok: "🟢 200 OK: Servicio web activo y respondiendo exitosamente.",
        helpSec2Warn: "🟡 4xx/5xx: El servidor responde pero devuelve código de error o ruta raíz 404.",
        helpSec2Err: "🔴 Unhealthy / Err: Timeout o conexión rechazada. Posible proceso colgado.",
        helpSec3Title: "🔄 ¿Qué es \"Hot-Cycle\" (Reinicio Rápido)?",
        helpSec3Desc: "Si tu servidor (Vite, Next.js, FastAPI, Go) se congela o no detecta cambios, el botón Restart (Hot-Cycle) mata el proceso y lo vuelve a lanzar automáticamente en su mismo directorio de trabajo (CWD) con sus argumentos originales.",
        helpSec4Title: "🛑 ¿Se pueden cerrar los procesos sin consumo con el botón Kill?",
        helpSec4Intro: "Algunos puertos en el rango alto (49000+) muestran - MB o unknown porque pertenecen a servicios del sistema donde el OS restringe la telemetría a usuarios estándar:",
        helpSec4Item1Title: "✅ Procesos de Usuario en Segundo Plano:",
        helpSec4Item1Desc: "Si el puerto fue abierto por una app de usuario (Discord, workers, etc.), al pulsar Kill se finaliza y el puerto se libera de inmediato.",
        helpSec4Item2Title: "🛡️ Procesos del Kernel (PID 4, System):",
        helpSec4Item2Desc: "scaport muestra la insignia Shield y bloquea el botón para evitar inestabilidad en tu sistema operativo.",
        helpSec4Item3Title: "🔒 Servicios Protegidos por Windows:",
        helpSec4Item3Desc: "Si un servicio requiere permisos de administrador y se intenta matar, Windows denegará el acceso y scaport te informará con un aviso seguro.",
        helpSec5Title: "🛡️ Acciones Recomendadas ante Bloqueos",
        helpSec5Item1: "Error de Puerto Ocupado (EADDRINUSE): Usa el botón Kill para liberar el puerto inmediatamente.",
        helpSec5Item2: "Procesos del Sistema (PID 4, System): scaport los protege con su escudo para evitar inestabilidad en tu OS.",
        helpSec5Item3: "Filtro ⚡ Dev Only: Oculta sockets del sistema y muestra únicamente proyectos de desarrollo reconocidos.",
        helpSec6Title: "⌨️ Comandos CLI Útiles",

        // Confirmation Prompts & Toast Messages
        killConfirmPrompt: "¿Estás seguro de finalizar el proceso con PID {pid}{label} en el puerto :{port}?",
        killDbWarningPrompt: "⚠️ PRECAUCIÓN: El puerto :{port} corresponde a un motor de base de datos{label}.\n\nFinalizarlo de forma forzada puede causar pérdida de transacciones no guardadas o desconectar servicios dependientes.\n\n¿Estás completamente seguro de que deseas forzar el cierre del PID {pid}?",
        restartConfirmPrompt: "¿Deseas reiniciar (Hot-Cycle) el PID {pid} en el puerto :{port} con sus argumentos originales?",
        processKilledSuccess: "Proceso en el puerto :{port} (PID {pid}) terminado limpiamente.",
        processRestartedSuccess: "Proceso en puerto :{port} reiniciado con éxito (Nuevo PID: {newPid}).",
        healthCheckLaunched: "Ejecutando sondeo de salud HTTP en todos los puertos activos...",
        telemetryExportedMd: "📥 Informe de telemetría exportado en Markdown.",
        telemetryExportedJson: "📥 Informe de telemetría exportado en JSON.",
        dataExported: "Reporte exportado en formato {format}",
        watchActiveToast: "👁️ Watch Daemon activado: Sondeando salud continua cada 3 segundos.",
        watchDisabledToast: "Watch Daemon desactivado.",
        themeSwitched: "Tema cambiado a {theme}.",
        langSwitched: "Idioma cambiado a Español."
    },
    en: {
        // App brand & subheadings
        appSubtitle: "Smart Port & Process Orchestrator",
        sseConnected: "SSE CONNECTED",
        sseLive: "SSE LIVE",
        reconnecting: "RECONNECTING...",
        
        // Navigation buttons & toggles
        langBtnTitle: "Switch language (Spanish / English)",
        themeBtnTitle: "Toggle Light / Dark theme",
        watchOff: "Watch: OFF",
        watchOn: "Watch: ON",
        watchTitle: "Enable continuous port supervision with auto-probing and audio/visual alerts",
        telemetryBtn: "📊 Telemetry",
        telemetryTitle: "Open real-time performance & network telemetry monitor",
        healthCheckBtn: "🩺 Health Check",
        healthCheckTitle: "Trigger immediate HTTP health probe across all active ports",
        historyBtn: "📜 History",
        historyTitle: "Open action history and audit drawer",
        guideBtn: "💡 Guide & FAQs",
        guideTitle: "Open user guide and frequently asked questions",
        exportBtn: "📥 Export",
        
        // Export menu
        exportJsonTitle: "JSON Data (.json)",
        exportJsonSub: "For scripts, jq and CI/CD pipelines",
        exportMdTitle: "Markdown Table (.md)",
        exportMdSub: "For GitHub, PR summaries and Docs",
        exportCsvTitle: "CSV Spreadsheet (.csv)",
        exportCsvSub: "For Excel and Google Sheets",
        exportHtmlTitle: "Standalone HTML (.html)",
        exportHtmlSub: "Offline interactive visual report",
        exportTelemMdTitle: "Telemetry Report (.md)",
        exportTelemMdSub: "Telemetry summary and HTTP latencies",
        exportTelemJsonTitle: "Telemetry JSON (.json)",
        exportTelemJsonSub: "Raw time-series sampling dump",

        // Advisor banner
        advisorTitleDefault: "GOENMA Architecture & Development Tip",
        advisorTagDefault: "DEV WISDOM",
        advisorTipPrefix: "💡 Pro Tip #",
        analyzingAdvisor: "Analyzing port behavior and runtime environment...",
        prevTipTitle: "Previous tip",
        randomTipTitle: "Random tip",
        nextTipTitle: "Next tip (Auto-rotates every 15s)",
        nextTipBtn: "Next ▶",

        // Alert titles & messages
        alertUnhealthyTitle: "Alert: Web Service Frozen or Unresponsive",
        alertUnhealthyTag: "CRITICAL ALERT",
        alertCollisionTitle: "Multiple Development Ports in Use",
        alertCollisionTag: "PORT ADVISORY",
        alertMemTitle: "High Memory Usage Detected on Process",
        alertMemTag: "MEMORY ADVISOR",

        // Card 1: Active Sockets
        cardSocketsTitle: "Active Sockets",
        unitSockets: "ports",
        scaleSockets: "Scale: Min: {min} | Max: {max} sockets",
        timeScale: "-60s ─── 0s",
        devOnlyChip: "Dev",
        dbChip: "DB",
        sysChip: "Sys",
        devOnlyChipTitle: "Filter active dev projects and ports",
        dbChipTitle: "Filter database engines",
        sysChipTitle: "Filter protected system processes",

        // Card 2: Health & Traffic
        cardHealthTitle: "Health & Traffic",
        probeNowTitle: "Trigger immediate HTTP health probe",
        healthDistTitle: "HTTP health distribution",
        healthOnline: "Online",
        healthIdle: "Idle",
        healthBlocked: "Blocked",
        healthOnlineTitle: "Services returning HTTP 200 OK",
        healthIdleTitle: "Listening sockets without HTTP servers",
        healthBlockedTitle: "Unresponsive services or connection errors",

        // Card 3: Total Memory
        cardMemoryTitle: "Total Memory (RSS)",
        scaleMem: "Scale: Min: {min} | Max: {max}",
        topConsumerTitle: "Top consumer: {name} with {mem} MB",
        topConsumerEmpty: "No heavy activity",
        memStatusNormal: "Normal",
        memStatusModerate: "Moderate",
        memStatusHigh: "High (>3GB)",

        // Card 4: Dev Ecosystem
        cardEcosystemTitle: "Dev Ecosystem",
        unitProjects: "projects",
        stackDistTitle: "Active technology stack distribution",
        detectingStack: "Detecting stack...",
        noFrameworks: "No framework detected",

        // Search & Controls Bar
        searchPlaceholder: "Search port, PID, project, technology...",
        devOnlyBtn: "⚡ Dev Only",
        devOnlyBtnTitle: "Show only development projects (hide OS system sockets)",
        allTechOption: "All Technologies",
        dbTechOption: "Databases",
        sysTechOption: "System & Protected",
        viewTable: "Table",
        viewGrid: "Grid",

        // Table Headers
        thPortProto: "Port / Proto",
        thHealth: "Health",
        thHealthTooltip: "Health Status: Shows whether an HTTP/HTTPS endpoint responds. Click 'Health Check' above to probe.",
        thPID: "PID",
        thProjectProcess: "Project / Process",
        thType: "Type",
        thMemory: "Memory",
        thUptime: "Uptime",
        thActions: "Actions",
        noPortsFound: "No active ports found matching filter.",

        // Action Buttons & Badges
        openBrowserTitle: "Open http://localhost:{port} in browser",
        hotCycleTitle: "Hot-Cycle: Terminate and respawn this process in its working directory",
        restartBtn: "Restart",
        shieldBadge: "Shield",
        shieldTitle: "System service protected by System Shield against accidental termination",
        killDbBtn: "Kill DB",
        killDbTitle: "Active Database: Terminate with caution",
        killBtn: "Kill",
        killTitle: "Kill: Force stop process and free the port immediately",
        copyCurlTitle: "Copy curl command to test endpoint in terminal",
        copyCurlSuccess: "curl command copied to clipboard",

        // Drawer History
        historyDrawerTitle: "Action & Audit History",
        historyClearBtn: "Clear",
        historyEmpty: "No actions executed yet.",

        // Telemetry Modal
        telemetryModalTitle: "Live Performance & Traffic Telemetry",
        telemetryModalSub: "Real-time historical timeline of sockets, physical memory (RSS) and HTTP latencies",
        telemetryMemChartTitle: "RAM Evolution (RSS)",
        telemetryPortsChartTitle: "Active Sockets & Dev Ports",
        yAxisMB: "Y-Axis: Usage in MB",
        yAxisSockets: "Y-Axis: Socket Count",
        xAxisTime: "X-Axis: Time Elapsed",
        topProcsHeader: "Top Memory Consumers by Process",
        httpMatrixHeader: "Web Endpoints Latency (HTTP)",
        testBtn: "Test",
        noHttpEndpoints: "No active HTTP web servers detected yet. Click Test to probe.",
        noMemTelemetry: "No memory telemetry available for user processes.",
        protocolMatrixHeader: "Network Protocol Matrix (TCP / UDP / IPv6)",
        tcpSockets: "TCP Sockets",
        udpSockets: "UDP Sockets",
        ipv6Sockets: "IPv6 / Dual-Stack",
        shieldedSockets: "System Shield",
        exportReportLabel: "Export report:",
        closeTelemetryBtn: "Close Monitor",

        // Help Modal
        helpModalTitle: "User Guide & Core Concepts (scaport)",
        helpModalSub: "Learn to interpret health states, resolve port collisions and master shortcuts",
        understoodBtn: "Understood",

        // Help Sections Content
        helpSec1Title: "👁️ What is \"Monitor Mode / Watch Daemon\" and what does it do?",
        helpSec1Intro: "scaport provides two monitoring tiers:",
        helpSec1Item1Title: "1. Passive Discovery (SSE):",
        helpSec1Item1Desc: "Reads the OS socket table in real-time with zero network traffic. Uses less than 0.1% CPU and is active by default.",
        helpSec1Item2Title: "2. Active Watch Daemon (👁️ Button):",
        helpSec1Item2Desc: "In addition to reading sockets, sends periodic HTTP probes to check if the server is responding or frozen in a deadlock.",
        helpSec2Title: "🩺 What does the \"Health\" column indicate?",
        helpSec2Intro: "Evaluates actual web server responsiveness via asynchronous HTTP requests:",
        helpSec2Idle: "⚪ Idle: Socket open at OS level, awaiting health check or non-HTTP service.",
        helpSec2Ok: "🟢 200 OK: Web service active and responding successfully.",
        helpSec2Warn: "🟡 4xx/5xx: Server responds but returns error status or 404 root route.",
        helpSec2Err: "🔴 Unhealthy / Err: Timeout or connection refused. Likely frozen process.",
        helpSec3Title: "🔄 What is \"Hot-Cycle\" (Fast Restart)?",
        helpSec3Desc: "If your server (Vite, Next.js, FastAPI, Go) freezes or fails to pick up code changes, Restart (Hot-Cycle) kills the process and automatically respawns it in its working directory (CWD) with its original CLI flags.",
        helpSec4Title: "🛑 Can zero-memory processes be safely closed with the Kill button?",
        helpSec4Intro: "Some high-range ports (49000+) display - MB or unknown uptime because they belong to OS system services where telemetry is restricted:",
        helpSec4Item1Title: "✅ Background User Processes:",
        helpSec4Item1Desc: "If the port was opened by a user application (Discord, browser workers, etc.), clicking Kill terminates it and frees the port immediately.",
        helpSec4Item2Title: "🛡️ Kernel Processes (PID 4, System):",
        helpSec4Item2Desc: "scaport displays the Shield badge and disables the button to protect OS stability against blue screens.",
        helpSec4Item3Title: "🔒 Windows Protected Services:",
        helpSec4Item3Desc: "If a service requires elevated privileges to terminate, Windows denies access and scaport notifies you with a safe prompt.",
        helpSec5Title: "🛡️ Recommended Recovery Actions",
        helpSec5Item1: "Port Collision (EADDRINUSE): Click the Kill button to release the socket immediately.",
        helpSec5Item2: "System Processes (PID 4, System): scaport guards them with System Shield to ensure stability.",
        helpSec5Item3: "⚡ Dev Only Filter: Hides background OS sockets and displays only recognized dev projects.",
        helpSec6Title: "⌨️ Useful CLI Commands",

        // Confirmation Prompts & Toast Messages
        killConfirmPrompt: "Are you sure you want to terminate PID {pid}{label} on port :{port}?",
        killDbWarningPrompt: "⚠️ CAUTION: Port :{port} belongs to a database engine{label}.\n\nForcing termination may result in unsaved transaction loss or disconnect dependent microservices.\n\nAre you sure you want to force terminate PID {pid}?",
        restartConfirmPrompt: "Do you want to restart (Hot-Cycle) PID {pid} on port :{port} with its original arguments?",
        processKilledSuccess: "Process on port :{port} (PID {pid}) terminated cleanly.",
        processRestartedSuccess: "Process on port :{port} restarted successfully (New PID: {newPid}).",
        healthCheckLaunched: "Running HTTP health probe across all active ports...",
        telemetryExportedMd: "📥 Telemetry report exported as Markdown.",
        telemetryExportedJson: "📥 Telemetry report exported as JSON.",
        dataExported: "Report exported in {format} format",
        watchActiveToast: "👁️ Watch Daemon active: Probing health continuously every 3 seconds.",
        watchDisabledToast: "Watch Daemon deactivated.",
        themeSwitched: "Theme switched to {theme}.",
        langSwitched: "Language switched to English."
    }
};

let currentLang = localStorage.getItem('scaport_lang') || 'es';
let currentTheme = localStorage.getItem('scaport_theme') || 'dark';

function t(key, params = {}) {
    const dict = translations[currentLang] || translations.es;
    let str = dict[key] || translations.es[key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
}

function setLanguage(lang) {
    if (lang !== 'es' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem('scaport_lang', lang);
    applyTranslations();
    if (typeof renderView === 'function') renderView();
    if (typeof updateStats === 'function' && typeof lastSSEData !== 'undefined') updateStats(lastSSEData);
    if (typeof runDiagnostics === 'function' && typeof portsData !== 'undefined') runDiagnostics(portsData);
    if (typeof updateTelemetryModalContent === 'function') updateTelemetryModalContent();
    const langBtnText = document.getElementById('lang-btn-text');
    if (langBtnText) langBtnText.innerText = lang.toUpperCase();
    showToast(t('langSwitched'), 'info');
}

function toggleLanguage() {
    setLanguage(currentLang === 'es' ? 'en' : 'es');
}

function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('scaport_theme', theme);
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (theme === 'dark') {
        html.classList.add('dark');
        if (themeIcon) themeIcon.innerText = '🌙';
        if (themeText) themeText.innerText = 'Dark';
    } else {
        html.classList.remove('dark');
        if (themeIcon) themeIcon.innerText = '☀️';
        if (themeText) themeText.innerText = 'Light';
    }
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    showToast(t('themeSwitched', { theme: currentTheme === 'dark' ? (currentLang === 'es' ? 'Oscuro' : 'Dark') : (currentLang === 'es' ? 'Claro' : 'Light') }), 'info');
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.innerText = t(key);
        }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) {
            el.innerHTML = t(key);
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            el.setAttribute('title', t(key));
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.setAttribute('placeholder', t(key));
        }
    });

    // Update filter dropdown options if present
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        const optAll = typeFilter.querySelector('option[value="ALL"]');
        if (optAll) optAll.innerText = t('allTechOption');
        const optDb = typeFilter.querySelector('option[value="Database"]');
        if (optDb) optDb.innerText = t('dbTechOption');
        const optSys = typeFilter.querySelector('option[value="System"]');
        if (optSys) optSys.innerText = t('sysTechOption');
    }
}

// Initialize theme and language on DOM load
document.addEventListener('DOMContentLoaded', () => {
    setTheme(currentTheme);
    const langBtnText = document.getElementById('lang-btn-text');
    if (langBtnText) langBtnText.innerText = currentLang.toUpperCase();
    applyTranslations();
});
