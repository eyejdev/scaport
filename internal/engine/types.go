package engine

import (
	"time"
)

// ProcessInfo contains metadata about a process listening on a port.
type ProcessInfo struct {
	PID         int32     `json:"pid"`
	Name        string    `json:"name"`
	Cmdline     string    `json:"cmdline"`
	Cwd         string    `json:"cwd"`
	ProjectName string    `json:"projectName"`
	ProjectType string    `json:"projectType"` // Node.js, Go, Rust, Python, Docker, Database, System, etc.
	Description string    `json:"description,omitempty"`
	IsProtected bool      `json:"isProtected"`
	IsDatabase  bool      `json:"isDatabase"`
	CPUPercent  float64   `json:"cpuPercent"`
	MemoryRSS   uint64    `json:"memoryRSS"` // in bytes
	MemoryMB    float64   `json:"memoryMB"`
	CreateTime  time.Time `json:"createTime"`
	Uptime      string    `json:"uptime"`
	Username    string    `json:"username"`
}

// HealthStatus represents the health check result for an endpoint.
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"   // 2xx, 3xx
	HealthStatusDegraded  HealthStatus = "degraded"  // 4xx, 5xx
	HealthStatusUnhealthy HealthStatus = "unhealthy" // Connection refused / timeout
	HealthStatusUnknown   HealthStatus = "unknown"   // Not checked yet
)

// PortEntry represents an active listening port.
type PortEntry struct {
	Port         int          `json:"port"`
	Protocol     string       `json:"protocol"` // tcp, tcp6, udp, udp6
	IP           string       `json:"ip"`
	Process      *ProcessInfo `json:"process,omitempty"`
	Health       HealthStatus `json:"health"`
	HealthCode   int          `json:"healthCode,omitempty"`
	HealthTimeMs int64        `json:"healthTimeMs,omitempty"`
	LastSeen     time.Time    `json:"lastSeen"`
}

// ScanResult holds the overall snapshot of open ports.
type ScanResult struct {
	Timestamp time.Time    `json:"timestamp"`
	Total     int          `json:"total"`
	Ports     []*PortEntry `json:"ports"`
}
