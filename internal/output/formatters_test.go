package output

import (
	"strings"
	"testing"
	"time"

	"github.com/eyejdev/scaport/internal/engine"
)

func sampleScanResult() *engine.ScanResult {
	return &engine.ScanResult{
		Timestamp: time.Now(),
		Total:     2,
		Ports: []*engine.PortEntry{
			{
				Port:         3000,
				Protocol:     "tcp",
				Health:       engine.HealthStatusHealthy,
				HealthCode:   200,
				HealthTimeMs: 12,
				Process: &engine.ProcessInfo{
					PID:         1234,
					Name:        "node",
					ProjectName: "my-nextjs-app",
					ProjectType: "Next.js",
					Cmdline:     "node server.js",
					Cwd:         "/projects/app",
					MemoryMB:    84.5,
					CPUPercent:  1.2,
					Uptime:      "15m",
				},
			},
			{
				Port:         5432,
				Protocol:     "tcp",
				Health:       engine.HealthStatusUnknown,
				HealthCode:   0,
				HealthTimeMs: 0,
				Process: &engine.ProcessInfo{
					PID:         5678,
					Name:        "postgres",
					ProjectName: "postgres",
					ProjectType: "Database",
					Cmdline:     "postgres -D /data",
					Cwd:         "/var/lib/postgresql",
					MemoryMB:    120.0,
					CPUPercent:  0.4,
					Uptime:      "2h",
				},
			},
		},
	}
}

func TestToJSON(t *testing.T) {
	scan := sampleScanResult()
	out, err := ToJSON(scan)
	if err != nil {
		t.Fatalf("ToJSON error: %v", err)
	}
	if !strings.Contains(out, `"port": 3000`) {
		t.Errorf("expected json to contain port 3000")
	}
	if !strings.Contains(out, `"projectName": "my-nextjs-app"`) {
		t.Errorf("expected json to contain project name")
	}
}

func TestToMarkdown(t *testing.T) {
	scan := sampleScanResult()
	out := ToMarkdown(scan)
	if !strings.Contains(out, "| **3000** |") {
		t.Errorf("expected markdown to contain port 3000 row")
	}
	if !strings.Contains(out, "my-nextjs-app") {
		t.Errorf("expected markdown to contain project name")
	}
	if !strings.Contains(out, "eyejdev") {
		t.Errorf("expected markdown to attribute to eyejdev")
	}
}

func TestToCSV(t *testing.T) {
	scan := sampleScanResult()
	out, err := ToCSV(scan)
	if err != nil {
		t.Fatalf("ToCSV error: %v", err)
	}
	if !strings.Contains(out, "Port,Protocol,Health") {
		t.Errorf("expected CSV header")
	}
	if !strings.Contains(out, "3000,tcp,healthy,200,12,1234,node,my-nextjs-app,Next.js") {
		t.Errorf("expected CSV data row for port 3000")
	}
}

func TestToHTML(t *testing.T) {
	scan := sampleScanResult()
	out := ToHTML(scan)
	if !strings.Contains(out, "<!DOCTYPE html>") {
		t.Errorf("expected valid HTML document")
	}
	if !strings.Contains(out, ":3000") {
		t.Errorf("expected HTML to contain port :3000")
	}
	if !strings.Contains(out, "eyejdev") {
		t.Errorf("expected HTML to credit eyejdev")
	}
}
