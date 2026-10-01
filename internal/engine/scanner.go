package engine

import (
	"sort"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/net"
)

// ScanPorts scans for all listening ports (TCP and UDP) and enriches with process details.
func ScanPorts(withHealth bool) (*ScanResult, error) {
	connections, err := net.Connections("all")
	if err != nil {
		return nil, err
	}

	seen := make(map[string]*PortEntry)

	for _, conn := range connections {
		// Filter for LISTEN sockets or active UDP listeners
		if conn.Status != "LISTEN" && conn.Status != "NONE" && conn.Type != 2 {
			continue
		}

		port := int(conn.Laddr.Port)
		if port == 0 {
			continue
		}

		proto := "tcp"
		if conn.Type == 2 {
			proto = "udp"
		}
		if conn.Family == 2 { // AF_INET6
			proto = proto + "6"
		}

		key := proto + ":" + conn.Laddr.IP + ":" + string(rune(port))

		if _, exists := seen[key]; !exists {
			entry := &PortEntry{
				Port:     port,
				Protocol: proto,
				IP:       conn.Laddr.IP,
				Health:   HealthStatusUnknown,
				LastSeen: time.Now(),
			}

			if conn.Pid > 0 {
				procInfo, _ := InspectProcess(conn.Pid, port)
				entry.Process = procInfo
			}

			seen[key] = entry
		}
	}

	// De-duplicate by port (consolidating IPv4/IPv6 into clean list)
	portMap := make(map[int]*PortEntry)
	for _, entry := range seen {
		existing, ok := portMap[entry.Port]
		if !ok {
			portMap[entry.Port] = entry
		} else {
			// Prioritize IPv4 and entry with valid process info
			if existing.Process == nil && entry.Process != nil {
				portMap[entry.Port] = entry
			}
		}
	}

	resultList := make([]*PortEntry, 0, len(portMap))
	for _, entry := range portMap {
		resultList = append(resultList, entry)
	}

	// Priority helper for developer-focused sorting
	devPortsMap := map[int]bool{
		3000: true, 3001: true, 3333: true, 4000: true, 4200: true, 5000: true, 5173: true, 5174: true,
		8000: true, 8080: true, 8081: true, 8888: true, 9000: true, 9090: true, 9119: true,
	}

	priorityOf := func(p *PortEntry) int {
		if p.Process == nil {
			return 4
		}
		// If it's a protected system process or System project type, push to lowest priority
		if p.Process.IsProtected || p.Process.ProjectType == "System" || strings.EqualFold(p.Process.Name, "System") || p.Process.PID <= 4 {
			return 4
		}
		// Recognized developer projects / frameworks get highest priority (0)
		if p.Process.ProjectType != "" && p.Process.ProjectType != "Binary" && p.Process.ProjectType != "Unknown" && p.Process.ProjectType != "Database" && p.Process.ProjectType != "System" {
			return 0
		}
		// Common dev / test ports in user space get highest priority (0)
		if devPortsMap[p.Port] {
			return 0
		}
		// Databases (PostgreSQL, MySQL, Redis, MongoDB, SQL Server) get priority (1)
		if p.Process.IsDatabase || p.Process.ProjectType == "Database" {
			return 1
		}
		// Named user processes / dev tools get priority (2)
		if p.Process.Name != "" && !strings.Contains(p.Process.ProjectName, "PID Process") {
			return 2
		}
		// Generic processes (3)
		return 3
	}

	// Sort ports: Projects & Dev Ports first, Databases next, User apps next, System processes last
	sort.Slice(resultList, func(i, j int) bool {
		pi := priorityOf(resultList[i])
		pj := priorityOf(resultList[j])
		if pi != pj {
			return pi < pj
		}
		return resultList[i].Port < resultList[j].Port
	})

	if withHealth {
		CheckAllHealth(resultList)
	}

	return &ScanResult{
		Timestamp: time.Now(),
		Total:     len(resultList),
		Ports:     resultList,
	}, nil
}
