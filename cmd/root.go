package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/eyejdev/scaport/internal/engine"
	"github.com/eyejdev/scaport/internal/output"
	"github.com/eyejdev/scaport/internal/server"
	"github.com/eyejdev/scaport/internal/tui"
	"github.com/spf13/cobra"
)

var (
	webMode      bool
	webPort      int
	pollInterval int
	jsonOutput   bool
	mdOutput     bool
	csvOutput    bool
	htmlOutput   bool
)

var rootCmd = &cobra.Command{
	Use:   "scaport",
	Short: "⚡ scaport - Smart Port & Process Orchestrator for Developers (GOENMA)",
	Long: `⚡ scaport (by GOENMA & eyejdev)
The ultra-lightweight, cross-platform port & process orchestrator for modern developers.
Inspect sockets, monitor HTTP health, hot-cycle frozen processes, and prevent port collisions.`,
	Run: func(cmd *cobra.Command, args []string) {
		interval := time.Duration(pollInterval) * time.Millisecond

		// Direct Snapshot Output (JSON / Markdown / CSV / HTML)
		if jsonOutput || mdOutput || csvOutput || htmlOutput {
			scan, err := engine.ScanPorts(true)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error scanning ports: %v\n", err)
				os.Exit(1)
			}
			if jsonOutput {
				out, _ := output.ToJSON(scan)
				fmt.Println(out)
			} else if csvOutput {
				out, _ := output.ToCSV(scan)
				fmt.Print(out)
			} else if htmlOutput {
				fmt.Print(output.ToHTML(scan))
			} else {
				fmt.Print(output.ToMarkdown(scan))
			}
			return
		}

		// Web UI Dashboard Mode
		if webMode {
			ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer cancel()

			srv := server.NewServer(webPort, interval)
			if err := srv.Start(ctx); err != nil {
				fmt.Fprintf(os.Stderr, "Web server error: %v\n", err)
				os.Exit(1)
			}
			return
		}

		// Default: Bubble Tea Interactive TUI
		p := tea.NewProgram(
			tui.InitialModel(interval),
			tea.WithAltScreen(),
			tea.WithMouseCellMotion(),
		)

		if _, err := p.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "TUI error: %v\n", err)
			os.Exit(1)
		}
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.Flags().BoolVarP(&webMode, "web", "w", false, "Start embedded real-time Web Dashboard (SSE)")
	rootCmd.Flags().IntVarP(&webPort, "port", "p", 9119, "Port for the embedded Web UI server")
	rootCmd.Flags().IntVarP(&pollInterval, "interval", "i", 1500, "Polling interval in milliseconds")
	rootCmd.Flags().BoolVar(&jsonOutput, "json", false, "Output snapshot of active ports in JSON format")
	rootCmd.Flags().BoolVar(&mdOutput, "md", false, "Output snapshot of active ports in Markdown table format")
	rootCmd.Flags().BoolVar(&csvOutput, "csv", false, "Output snapshot of active ports in CSV format (Excel/Sheets)")
	rootCmd.Flags().BoolVar(&htmlOutput, "html", false, "Output snapshot of active ports in standalone HTML format")
}
