package output

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/eyejdev/scaport/internal/engine"
)

// ToJSON converts the scan result to indented JSON string.
func ToJSON(scan *engine.ScanResult) (string, error) {
	bytes, err := json.MarshalIndent(scan, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ToMarkdown converts the scan result to a GitHub-flavored Markdown table.
func ToMarkdown(scan *engine.ScanResult) string {
	var sb strings.Builder

	sb.WriteString("# ⚡ scaport - Active Ports Snapshot\n\n")
	sb.WriteString(fmt.Sprintf("> **Generated at:** %s | **Total Active Ports:** %d | **Tool:** [scaport](https://github.com/eyejdev/scaport) by eyejdev (GOENMA)\n\n",
		scan.Timestamp.Format(time.RFC3339), scan.Total))

	sb.WriteString("| Port | Proto | Status | PID | Process / Project | Type | CPU | Memory | Uptime |\n")
	sb.WriteString("| :--- | :---: | :----: | :-: | :---------------- | :--: | --: | -----: | :----- |\n")

	for _, p := range scan.Ports {
		statusEmoji := "⚪ Idle"
		switch p.Health {
		case engine.HealthStatusHealthy:
			statusEmoji = "🟢 200 OK"
		case engine.HealthStatusDegraded:
			statusEmoji = fmt.Sprintf("🟡 %d", p.HealthCode)
		case engine.HealthStatusUnhealthy:
			statusEmoji = "🔴 Err"
		}

		pidStr := "-"
		procName := "Unknown"
		projType := "-"
		cpuStr := "-"
		memStr := "-"
		uptime := "-"

		if p.Process != nil {
			pidStr = fmt.Sprintf("%d", p.Process.PID)
			procName = p.Process.Name
			if p.Process.ProjectName != "" && p.Process.ProjectName != p.Process.Name {
				procName = fmt.Sprintf("%s (%s)", p.Process.ProjectName, p.Process.Name)
			}
			projType = p.Process.ProjectType
			cpuStr = fmt.Sprintf("%.1f%%", p.Process.CPUPercent)
			memStr = fmt.Sprintf("%.1f MB", p.Process.MemoryMB)
			uptime = p.Process.Uptime
		}

		sb.WriteString(fmt.Sprintf("| **%d** | `%s` | %s | `%s` | %s | `%s` | %s | %s | %s |\n",
			p.Port, p.Protocol, statusEmoji, pidStr, procName, projType, cpuStr, memStr, uptime))
	}

	sb.WriteString("\n---\n*Report generated automatically by [scaport](https://github.com/eyejdev/scaport) — GOENMA Ecosystem (eyejdev).* \n")
	return sb.String()
}

// ToCSV converts the scan result to standard RFC 4180 CSV format (compatible with Excel & Sheets).
func ToCSV(scan *engine.ScanResult) (string, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// CSV Header
	header := []string{
		"Port",
		"Protocol",
		"Health",
		"HealthCode",
		"HealthLatencyMs",
		"PID",
		"ProcessName",
		"ProjectName",
		"ProjectType",
		"MemoryMB",
		"CPUPercent",
		"Uptime",
		"CommandLine",
		"WorkingDirectory",
	}
	if err := writer.Write(header); err != nil {
		return "", err
	}

	for _, p := range scan.Ports {
		pidStr := ""
		procName := ""
		projName := ""
		projType := ""
		memStr := "0"
		cpuStr := "0"
		uptime := ""
		cmdline := ""
		cwd := ""

		if p.Process != nil {
			pidStr = fmt.Sprintf("%d", p.Process.PID)
			procName = p.Process.Name
			projName = p.Process.ProjectName
			projType = p.Process.ProjectType
			memStr = fmt.Sprintf("%.2f", p.Process.MemoryMB)
			cpuStr = fmt.Sprintf("%.2f", p.Process.CPUPercent)
			uptime = p.Process.Uptime
			cmdline = p.Process.Cmdline
			cwd = p.Process.Cwd
		}

		row := []string{
			fmt.Sprintf("%d", p.Port),
			p.Protocol,
			string(p.Health),
			fmt.Sprintf("%d", p.HealthCode),
			fmt.Sprintf("%d", p.HealthTimeMs),
			pidStr,
			procName,
			projName,
			projType,
			memStr,
			cpuStr,
			uptime,
			cmdline,
			cwd,
		}

		if err := writer.Write(row); err != nil {
			return "", err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// ToHTML generates a standalone, self-contained offline dark-theme HTML report.
func ToHTML(scan *engine.ScanResult) string {
	var sb strings.Builder

	sb.WriteString(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>scaport - Active Ports Report</title>
    <style>
        :root {
            --bg: #090d16;
            --card-bg: #0f172a;
            --border: #1e293b;
            --text: #e2e8f0;
            --text-muted: #94a3b8;
            --primary: #10b981;
            --primary-bg: rgba(16, 185, 129, 0.1);
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 30px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            padding-bottom: 20px;
            margin-bottom: 25px;
            flex-wrap: wrap;
            gap: 15px;
        }
        h1 { margin: 0; font-size: 24px; color: #fff; display: flex; align-items: center; gap: 8px; }
        .meta { font-size: 12px; color: var(--text-muted); }
        .badge {
            background: var(--primary-bg);
            color: var(--primary);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 25px;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
        }
        .card-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
        .card-val { font-size: 24px; font-weight: bold; color: #fff; margin-top: 4px; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
            font-size: 13px;
        }
        th {
            background: #0b1120;
            padding: 12px 14px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border);
        }
        td {
            padding: 12px 14px;
            border-bottom: 1px solid #1e293b50;
            color: var(--text);
        }
        tr:hover { background: rgba(30, 41, 59, 0.4); }
        .port-tag { color: var(--primary); font-weight: bold; font-family: monospace; }
        .health-ok { color: #34d399; font-weight: bold; }
        .health-warn { color: #fbbf24; font-weight: bold; }
        .health-err { color: #f87171; font-weight: bold; }
        .health-idle { color: #94a3b8; }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            padding-top: 20px;
        }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>⚡ scaport Report</h1>
                <div class="meta">Generated: ` + scan.Timestamp.Format("2006-01-02 15:04:05 MST") + ` | Ecosystem: <strong>GOENMA</strong> by <strong>eyejdev</strong></div>
            </div>
            <span class="badge">OFFLINE AUDIT REPORT</span>
        </div>

        <div class="stats">
            <div class="card">
                <div class="card-label">Active Sockets</div>
                <div class="card-val">` + fmt.Sprintf("%d", scan.Total) + `</div>
            </div>
            <div class="card">
                <div class="card-label">Generated At</div>
                <div class="card-val" style="font-size: 18px; margin-top: 8px;">` + scan.Timestamp.Format("15:04:05") + `</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Port / Proto</th>
                    <th>Health</th>
                    <th>PID</th>
                    <th>Process / Project</th>
                    <th>Type</th>
                    <th>Memory</th>
                    <th>CPU</th>
                    <th>Uptime</th>
                </tr>
            </thead>
            <tbody>`)

	for _, p := range scan.Ports {
		healthHtml := `<span class="health-idle">⚪ Idle</span>`
		switch p.Health {
		case engine.HealthStatusHealthy:
			healthHtml = fmt.Sprintf(`<span class="health-ok">🟢 200 OK (%dms)</span>`, p.HealthTimeMs)
		case engine.HealthStatusDegraded:
			healthHtml = fmt.Sprintf(`<span class="health-warn">🟡 %d (%dms)</span>`, p.HealthCode, p.HealthTimeMs)
		case engine.HealthStatusUnhealthy:
			healthHtml = `<span class="health-err">🔴 Unhealthy</span>`
		}

		pidStr := "-"
		procName := "Unknown"
		projType := "-"
		memStr := "-"
		cpuStr := "-"
		uptime := "-"

		if p.Process != nil {
			pidStr = fmt.Sprintf("%d", p.Process.PID)
			procName = html.EscapeString(p.Process.Name)
			if p.Process.ProjectName != "" && p.Process.ProjectName != p.Process.Name {
				procName = fmt.Sprintf("<strong>%s</strong> (%s)", html.EscapeString(p.Process.ProjectName), html.EscapeString(p.Process.Name))
			}
			projType = html.EscapeString(p.Process.ProjectType)
			memStr = fmt.Sprintf("%.1f MB", p.Process.MemoryMB)
			cpuStr = fmt.Sprintf("%.1f%%", p.Process.CPUPercent)
			uptime = html.EscapeString(p.Process.Uptime)
		}

		sb.WriteString(fmt.Sprintf(`
                <tr>
                    <td><span class="port-tag">:%d</span> <span style="font-size:10px; color:#64748b; text-transform:uppercase;">%s</span></td>
                    <td>%s</td>
                    <td style="font-family: monospace;">%s</td>
                    <td>%s</td>
                    <td><span style="font-size:11px; background:#1e293b; padding:2px 6px; border-radius:4px;">%s</span></td>
                    <td>%s</td>
                    <td>%s</td>
                    <td>%s</td>
                </tr>`, p.Port, p.Protocol, healthHtml, pidStr, procName, projType, memStr, cpuStr, uptime))
	}

	sb.WriteString(`
            </tbody>
        </table>

        <div class="footer">
            Report generated with <a href="https://github.com/eyejdev/scaport" target="_blank"><strong>scaport</strong></a> by <a href="https://github.com/eyejdev" target="_blank"><strong>eyejdev</strong></a> — Part of the <strong>GOENMA</strong> developer tools ecosystem.
        </div>
    </div>
</body>
</html>`)

	return sb.String()
}

// ToPlainText outputs a clean CLI table format.
func ToPlainText(scan *engine.ScanResult) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("PORT\tPROTO\tHEALTH\tPID\tPROJECT\tTYPE\tMEM\n"))
	for _, p := range scan.Ports {
		health := string(p.Health)
		pid := "-"
		name := "-"
		pType := "-"
		mem := "-"
		if p.Process != nil {
			pid = fmt.Sprintf("%d", p.Process.PID)
			name = p.Process.ProjectName
			pType = p.Process.ProjectType
			mem = fmt.Sprintf("%.1fMB", p.Process.MemoryMB)
		}
		sb.WriteString(fmt.Sprintf("%d\t%s\t%s\t%s\t%s\t%s\t%s\n",
			p.Port, p.Protocol, health, pid, name, pType, mem))
	}
	return sb.String()
}
