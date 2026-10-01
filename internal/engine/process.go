package engine

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

// Windows tasklist cache to quickly resolve process names that gopsutil misses
var (
	winProcessCache   = make(map[int32]string)
	winProcessCacheMu sync.RWMutex
	lastCacheRefresh  time.Time
)

// refreshWindowsProcessCache builds a snapshot of PID -> ProcessName on Windows
func refreshWindowsProcessCache() {
	if runtime.GOOS != "windows" {
		return
	}

	winProcessCacheMu.Lock()
	defer winProcessCacheMu.Unlock()

	if time.Since(lastCacheRefresh) < 3*time.Second && len(winProcessCache) > 0 {
		return
	}

	cmd := exec.Command("tasklist", "/FO", "CSV", "/NH")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return
	}

	newCache := make(map[int32]string)
	lines := strings.Split(out.String(), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\",\"")
		if len(parts) >= 2 {
			name := strings.Trim(parts[0], "\"")
			pidStr := strings.Trim(parts[1], "\"")
			if pid, err := strconv.Atoi(pidStr); err == nil {
				newCache[int32(pid)] = name
			}
		}
	}

	winProcessCache = newCache
	lastCacheRefresh = time.Now()
}

func getFallbackProcessName(pid int32) string {
	if runtime.GOOS == "windows" {
		refreshWindowsProcessCache()
		winProcessCacheMu.RLock()
		defer winProcessCacheMu.RUnlock()
		if name, ok := winProcessCache[pid]; ok {
			return name
		}
	}
	return ""
}

// WellKnownPortInfo describes a known network service
type WellKnownPortInfo struct {
	Name        string
	ProjectName string
	ProjectType string
	Description string
	IsProtected bool
	IsDatabase  bool
}

var wellKnownPorts = map[int]WellKnownPortInfo{
	135:   {Name: "svchost.exe", ProjectName: "RPC Endpoint Mapper", ProjectType: "System", Description: "Llamada a procedimiento remoto (RPC) del núcleo de Windows", IsProtected: true},
	137:   {Name: "System", ProjectName: "NetBIOS Name Service", ProjectType: "System", Description: "Resolución de nombres NetBIOS en red local", IsProtected: true},
	138:   {Name: "System", ProjectName: "NetBIOS Datagram", ProjectType: "System", Description: "Servicio de datagramas NetBIOS", IsProtected: true},
	139:   {Name: "System", ProjectName: "NetBIOS Session", ProjectType: "System", Description: "Servicio de sesiones NetBIOS / Archivos compartidos", IsProtected: true},
	445:   {Name: "System", ProjectName: "SMB / NetBIOS File Sharing", ProjectType: "System", Description: "Compartición de archivos e impresoras SMB en Windows", IsProtected: true},
	1433:  {Name: "sqlservr.exe", ProjectName: "Microsoft SQL Server", ProjectType: "Database", Description: "Motor de Base de Datos Relacional Microsoft SQL Server", IsDatabase: true},
	1434:  {Name: "sqlservr.exe", ProjectName: "SQL Server Browser", ProjectType: "Database", Description: "Servicio de resolución de instancias SQL Server", IsDatabase: true},
	1900:  {Name: "svchost.exe", ProjectName: "SSDP Device Discovery", ProjectType: "System", Description: "Detección de dispositivos Plug & Play y multimedia (UPnP)", IsProtected: true},
	2177:  {Name: "svchost.exe", ProjectName: "Windows QWAVE Service", ProjectType: "System", Description: "Calidad de servicio de audio/vídeo para red de Windows", IsProtected: true},
	3306:  {Name: "mysqld", ProjectName: "MySQL Server", ProjectType: "Database", Description: "Base de Datos Relacional MySQL", IsDatabase: true},
	3389:  {Name: "svchost.exe", ProjectName: "Remote Desktop (RDP)", ProjectType: "System", Description: "Servicio de Escritorio Remoto de Windows", IsProtected: true},
	3702:  {Name: "dasHost.exe", ProjectName: "WS-Discovery Host", ProjectType: "System", Description: "Detección de servicios web y dispositivos en red local", IsProtected: true},
	5040:  {Name: "svchost.exe", ProjectName: "Connected Devices Platform", ProjectType: "System", Description: "Sincronización de dispositivos y Bluetooth en Windows", IsProtected: true},
	5050:  {Name: "svchost.exe", ProjectName: "Connected Devices Platform", ProjectType: "System", Description: "Sincronización de dispositivos y Bluetooth en Windows", IsProtected: true},
	5353:  {Name: "mDNS", ProjectName: "Multicast DNS (ZeroConf)", ProjectType: "System", Description: "Resolución de nombres local sin servidor DNS central", IsProtected: true},
	5355:  {Name: "svchost.exe", ProjectName: "LLMNR Name Resolution", ProjectType: "System", Description: "Resolución de nombres multicast para redes locales", IsProtected: true},
	5357:  {Name: "System", ProjectName: "WSDAPI Web Services", ProjectType: "System", Description: "Servicios web en dispositivos para Windows", IsProtected: true},
	5432:  {Name: "postgres", ProjectName: "PostgreSQL Database", ProjectType: "Database", Description: "Base de Datos Relacional PostgreSQL", IsDatabase: true},
	6379:  {Name: "redis-server", ProjectName: "Redis Cache", ProjectType: "Database", Description: "Almacén en memoria y caché Redis", IsDatabase: true},
	7680:  {Name: "svchost.exe", ProjectName: "Windows Update (DoSvc)", ProjectType: "System", Description: "Optimización de distribución de actualizaciones de Windows", IsProtected: true},
	27017: {Name: "mongod", ProjectName: "MongoDB Database", ProjectType: "Database", Description: "Base de Datos NoSQL de documentos MongoDB", IsDatabase: true},
}

// InspectProcess retrieves rich information about a given PID and port.
func InspectProcess(pid int32, port int) (*ProcessInfo, error) {
	if pid <= 0 {
		return &ProcessInfo{
			PID:         pid,
			Name:        "System/Kernel",
			ProjectName: "System Kernel",
			ProjectType: "System",
			IsProtected: true,
		}, nil
	}

	p, err := process.NewProcess(pid)
	var name, cmdline, cwd, username string
	var cpuPercent float64
	var memRSS uint64
	var memMB float64
	var createTime time.Time
	var uptimeStr string = "unknown"

	if err == nil {
		name, _ = p.Name()
		cmdline, _ = p.Cmdline()
		cwd, _ = p.Cwd()
		username, _ = p.Username()
		cpuPercent, _ = p.CPUPercent()
		memInfo, _ := p.MemoryInfo()
		if memInfo != nil {
			memRSS = memInfo.RSS
			memMB = float64(memRSS) / (1024 * 1024)
		}
		if createTimeMs, _ := p.CreateTime(); createTimeMs > 0 {
			createTime = time.UnixMilli(createTimeMs)
			uptimeDur := time.Since(createTime).Round(time.Second)
			uptimeStr = formatDuration(uptimeDur)
		}
	}

	// Fallback to tasklist snapshot if gopsutil couldn't read process name on Windows
	if name == "" {
		name = getFallbackProcessName(pid)
	}

	// Check Well-Known Port Registry
	known, isKnownPort := wellKnownPorts[port]
	if isKnownPort && name == "" {
		name = known.Name
	}

	// Check if port is in Windows RPC dynamic range (49664 - 49685)
	isRPCDynamic := port >= 49664 && port <= 49685

	projectName, projectType, description, isProtected, isDatabase := detectProject(cwd, cmdline, name, pid, port)

	// Apply known port enhancements
	if isKnownPort {
		if known.ProjectName != "" && (projectName == "" || strings.HasPrefix(projectName, "System Service")) {
			projectName = known.ProjectName
		}
		if known.ProjectType != "" {
			projectType = known.ProjectType
		}
		if known.Description != "" {
			description = known.Description
		}
		if known.IsProtected {
			isProtected = true
		}
		if known.IsDatabase {
			isDatabase = true
		}
	} else if isRPCDynamic {
		projectName = "Windows RPC Dynamic Service"
		projectType = "System"
		description = "Punto de enlace dinámico para llamadas a procedimiento remoto del sistema"
		isProtected = true
	}

	// Check global system protection shield
	if IsSystemProtected(pid, name) {
		isProtected = true
	}

	return &ProcessInfo{
		PID:         pid,
		Name:        name,
		Cmdline:     cleanCmdline(cmdline),
		Cwd:         cwd,
		ProjectName: projectName,
		ProjectType: projectType,
		Description: description,
		IsProtected: isProtected,
		IsDatabase:  isDatabase,
		CPUPercent:  cpuPercent,
		MemoryRSS:   memRSS,
		MemoryMB:    memMB,
		CreateTime:  createTime,
		Uptime:      uptimeStr,
		Username:    username,
	}, nil
}

// detectProject attempts to detect the project name and type from CWD, cmdline, PID, and port.
func detectProject(cwd, cmdline, procName string, pid int32, port int) (string, string, string, bool, bool) {
	procLower := strings.ToLower(procName)
	cmdLower := strings.ToLower(cmdline)

	var projType string
	var projName string
	var description string
	var isProtected bool
	var isDatabase bool

	if cwd != "" {
		projName = filepath.Base(cwd)

		// Inspect files in CWD if accessible
		if fileExists(filepath.Join(cwd, "package.json")) {
			projType = "Node.js"
		} else if fileExists(filepath.Join(cwd, "go.mod")) {
			projType = "Go"
		} else if fileExists(filepath.Join(cwd, "Cargo.toml")) {
			projType = "Rust"
		} else if fileExists(filepath.Join(cwd, "requirements.txt")) || fileExists(filepath.Join(cwd, "pyproject.toml")) {
			projType = "Python"
		} else if fileExists(filepath.Join(cwd, "pom.xml")) || fileExists(filepath.Join(cwd, "build.gradle")) {
			projType = "Java"
		} else if fileExists(filepath.Join(cwd, "composer.json")) {
			projType = "PHP"
		} else if fileExists(filepath.Join(cwd, "Gemfile")) {
			projType = "Ruby"
		} else if fileExists(filepath.Join(cwd, "docker-compose.yml")) || fileExists(filepath.Join(cwd, "Dockerfile")) {
			projType = "Docker"
		}
	}

	if projType == "" {
		if strings.Contains(procLower, "node") || strings.Contains(cmdLower, "node") || strings.Contains(cmdLower, "vite") || strings.Contains(cmdLower, "next") {
			projType = "Node.js"
			description = "Servidor de desarrollo JavaScript / Node.js"
		} else if strings.Contains(procLower, "python") || strings.Contains(cmdLower, "python") || strings.Contains(cmdLower, "uvicorn") || strings.Contains(cmdLower, "flask") {
			projType = "Python"
			description = "Servidor de aplicaciones Python / ASGI"
		} else if strings.Contains(procLower, "docker") || strings.Contains(procLower, "containerd") {
			projType = "Docker"
			description = "Motor de Contenedores Docker"
		} else if strings.Contains(procLower, "sqlservr") || strings.Contains(procLower, "postgres") || strings.Contains(procLower, "mysqld") || strings.Contains(procLower, "redis") || strings.Contains(procLower, "mongod") {
			projType = "Database"
			isDatabase = true
			description = "Servicio de Base de Datos Activo"
		} else if strings.Contains(procLower, "go") || strings.Contains(cmdLower, "go run") {
			projType = "Go"
			description = "Binario compilado en Go"
		} else if strings.Contains(procLower, "dotnet") {
			projType = ".NET"
		} else if strings.Contains(procLower, "svchost") || strings.Contains(procLower, "dashost") || strings.Contains(procLower, "system") {
			projType = "System"
			isProtected = true
			description = "Servicio del Sistema Operativo"
		} else {
			projType = "Binary"
		}
	}

	if projName == "" || projName == "." || projName == "/" || projName == "\\" {
		if procName != "" {
			projName = procName
		} else if pid == 4 {
			projName = "System Kernel"
			isProtected = true
		} else if pid > 0 {
			projName = fmt.Sprintf("System Service (PID %d)", pid)
		} else {
			projName = "System"
			isProtected = true
		}
	}

	// Clean up Windows process names (.exe)
	projName = strings.TrimSuffix(projName, ".exe")

	return projName, projType, description, isProtected, isDatabase
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func cleanCmdline(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	if len(cmd) > 200 {
		return cmd[:197] + "..."
	}
	return cmd
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm %ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
	}
	return fmt.Sprintf("%dd %dh", int(d.Hours()/24), int(d.Hours())%24)
}
