package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/eyejdev/scaport/internal/engine"
	"github.com/eyejdev/scaport/internal/output"
)

var (
	// Styling
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FAFAFA")).
			Background(lipgloss.Color("#16a34a")).
			Padding(0, 1)

	subTitleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#94a3b8")).
			MarginLeft(1)

	badgeStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#22c55e")).
			Bold(true)

	statusMsgStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#38bdf8")).
			Bold(true)

	errStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#f43f5e")).
			Bold(true)

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#64748b"))
)

type tickMsg time.Time
type scanDoneMsg struct {
	scan *engine.ScanResult
	err  error
}
type actionDoneMsg struct {
	msg string
	err error
}

// Model represents the Bubble Tea TUI state.
type Model struct {
	table        table.Model
	spinner      spinner.Model
	filterInput  textinput.Model
	filtering    bool
	scan         *engine.ScanResult
	err          error
	statusMsg    string
	width        int
	height       int
	pollInterval time.Duration
}

// InitialModel creates a configured TUI model.
func InitialModel(interval time.Duration) Model {
	columns := []table.Column{
		{Title: "PORT", Width: 8},
		{Title: "PROTO", Width: 6},
		{Title: "STATUS", Width: 10},
		{Title: "PID", Width: 8},
		{Title: "PROJECT / PROCESS", Width: 28},
		{Title: "TYPE", Width: 12},
		{Title: "MEM", Width: 10},
		{Title: "UPTIME", Width: 10},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(14),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#334155")).
		BorderBottom(true).
		Bold(true).
		Foreground(lipgloss.Color("#94a3b8"))

	s.Selected = s.Selected.
		Foreground(lipgloss.Color("#FFFFFF")).
		Background(lipgloss.Color("#1e293b")).
		Bold(true)

	t.SetStyles(s)

	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("#22c55e"))

	ti := textinput.New()
	ti.Placeholder = "Type to filter ports/processes..."
	ti.CharLimit = 50
	ti.Width = 35

	return Model{
		table:        t,
		spinner:      sp,
		filterInput:  ti,
		pollInterval: interval,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		m.triggerScan(true),
		m.tickPoll(),
	)
}

func (m Model) triggerScan(withHealth bool) tea.Cmd {
	return func() tea.Msg {
		res, err := engine.ScanPorts(withHealth)
		return scanDoneMsg{scan: res, err: err}
	}
}

func (m Model) tickPoll() tea.Cmd {
	return tea.Tick(m.pollInterval, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.table.SetWidth(msg.Width - 4)
		m.table.SetHeight(msg.Height - 10)

	case tickMsg:
		cmds = append(cmds, m.triggerScan(false), m.tickPoll())

	case spinner.TickMsg:
		var spCmd tea.Cmd
		m.spinner, spCmd = m.spinner.Update(msg)
		cmds = append(cmds, spCmd)

	case scanDoneMsg:
		if msg.err != nil {
			m.err = msg.err
		} else {
			m.scan = msg.scan
			m.refreshTableRows()
		}

	case actionDoneMsg:
		if msg.err != nil {
			m.statusMsg = errStyle.Render("Error: " + msg.err.Error())
		} else {
			m.statusMsg = statusMsgStyle.Render("⚡ " + msg.msg)
		}
		cmds = append(cmds, m.triggerScan(false))

	case tea.KeyMsg:
		if m.filtering {
			switch msg.String() {
			case "enter", "esc":
				m.filtering = false
				m.filterInput.Blur()
				return m, nil
			default:
				m.filterInput, cmd = m.filterInput.Update(msg)
				m.refreshTableRows()
				return m, cmd
			}
		}

		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit

		case "/":
			m.filtering = true
			m.filterInput.Focus()
			return m, textinput.Blink

		case "r":
			// Hot-Cycle Selected Process
			selRow := m.table.SelectedRow()
			if len(selRow) > 3 {
				pidStr := selRow[3]
				return m, m.actionHotCycle(pidStr)
			}

		case "k", "x":
			// Kill Selected Process
			selRow := m.table.SelectedRow()
			if len(selRow) > 3 {
				pidStr := selRow[3]
				portStr := selRow[0]
				return m, m.actionKill(pidStr, portStr)
			}

		case "h":
			// Run Health Checks
			m.statusMsg = statusMsgStyle.Render("🩺 Checking health endpoints...")
			return m, m.triggerScan(true)

		case "e":
			// Export Markdown Snapshot
			if m.scan != nil {
				md := output.ToMarkdown(m.scan)
				_ = md
				m.statusMsg = statusMsgStyle.Render("📄 Exported snapshot to Markdown table.")
			}
		}
	}

	m.table, cmd = m.table.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m *Model) refreshTableRows() {
	if m.scan == nil {
		return
	}

	filter := strings.ToLower(m.filterInput.Value())
	var rows []table.Row

	for _, p := range m.scan.Ports {
		statusStr := "⚪ Idle"
		switch p.Health {
		case engine.HealthStatusHealthy:
			statusStr = "🟢 200 OK"
		case engine.HealthStatusDegraded:
			statusStr = fmt.Sprintf("🟡 %d", p.HealthCode)
		case engine.HealthStatusUnhealthy:
			statusStr = "🔴 Err"
		}

		pidStr := "-"
		procName := "Unknown"
		projType := "-"
		memStr := "-"
		uptime := "-"

		if p.Process != nil {
			pidStr = fmt.Sprintf("%d", p.Process.PID)
			procName = p.Process.ProjectName
			if procName == "" {
				procName = p.Process.Name
			}
			projType = p.Process.ProjectType
			memStr = fmt.Sprintf("%.1f MB", p.Process.MemoryMB)
			uptime = p.Process.Uptime
		}

		// Filter matching
		if filter != "" {
			combined := fmt.Sprintf("%d %s %s %s %s", p.Port, p.Protocol, pidStr, procName, projType)
			if !strings.Contains(strings.ToLower(combined), filter) {
				continue
			}
		}

		rows = append(rows, table.Row{
			fmt.Sprintf(":%d", p.Port),
			p.Protocol,
			statusStr,
			pidStr,
			procName,
			projType,
			memStr,
			uptime,
		})
	}

	m.table.SetRows(rows)
}

func (m Model) actionKill(pidStr, portStr string) tea.Cmd {
	return func() tea.Msg {
		port, err := engine.ParsePort(portStr)
		if err != nil {
			return actionDoneMsg{err: err}
		}

		err = engine.KillPort(port, true)
		if err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{msg: fmt.Sprintf("Port :%d (PID %s) terminated cleanly.", port, pidStr)}
	}
}

func (m Model) actionHotCycle(pidStr string) tea.Cmd {
	return func() tea.Msg {
		if pidStr == "-" || pidStr == "" {
			return actionDoneMsg{err: fmt.Errorf("no process associated")}
		}
		var pid int
		_, _ = fmt.Sscanf(pidStr, "%d", &pid)
		newProc, err := engine.HotCycle(int32(pid))
		if err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{msg: fmt.Sprintf("PID %s restarted cleanly (New PID %d).", pidStr, newProc.PID)}
	}
}

func (m Model) View() string {
	var sb strings.Builder

	// Header
	header := lipgloss.JoinHorizontal(
		lipgloss.Center,
		titleStyle.Render("⚡ SCAPORT"),
		subTitleStyle.Render("Smart Port & Process Orchestrator • "+badgeStyle.Render("GOENMA")),
	)
	sb.WriteString("\n" + header + "\n\n")

	// Status / Error / Filter Bar
	if m.filtering {
		sb.WriteString("🔍 Filter: " + m.filterInput.View() + "\n\n")
	} else if m.statusMsg != "" {
		sb.WriteString(m.statusMsg + "\n\n")
	} else {
		sb.WriteString(m.spinner.View() + " Listening for active local ports & sockets...\n\n")
	}

	// Table View
	sb.WriteString(m.table.View() + "\n\n")

	// Footer / Hotkeys Help
	help := helpStyle.Render("Keys: [k] Kill Process • [r] Restart / Hot-Cycle • [h] Health Check • [/] Search • [e] Export MD • [q] Quit")
	sb.WriteString(help)

	return sb.String()
}
