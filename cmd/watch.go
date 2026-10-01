package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/eyejdev/scaport/internal/engine"
	"github.com/spf13/cobra"
)

var (
	watchInterval int
)

var watchCmd = &cobra.Command{
	Use:   "watch [ports...]",
	Short: "Continuously watch key dev ports and notify in console when any service goes down or is blocked",
	Example: `  scaport watch 3000 8080 5432
  scaport watch --interval 2000 3000`,
	Args: cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer cancel()

		var targetPorts []int
		for _, arg := range args {
			p, err := engine.ParsePort(arg)
			if err != nil {
				fmt.Fprintf(os.Stderr, "❌ Invalid port: %v\n", err)
				os.Exit(1)
			}
			targetPorts = append(targetPorts, p)
		}

		interval := time.Duration(watchInterval) * time.Millisecond
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		fmt.Printf("\n👁️  [SCAPORT WATCH] Monitoring %d port(s) every %v:\n", len(targetPorts), interval)
		for _, p := range targetPorts {
			fmt.Printf("   • Port :%d\n", p)
		}
		fmt.Println("👉 Press Ctrl+C to stop watch daemon.")

		// State cache
		lastState := make(map[int]engine.HealthStatus)

		checkOnce := func() {
			scan, err := engine.ScanPorts(true)
			if err != nil {
				return
			}

			occupiedMap := make(map[int]*engine.PortEntry)
			for _, p := range scan.Ports {
				occupiedMap[p.Port] = p
			}

			now := time.Now().Format("15:04:05")

			for _, port := range targetPorts {
				entry, occupied := occupiedMap[port]
				prev := lastState[port]

				if !occupied {
					if prev != "free" {
						fmt.Printf("[%s] ⚪ Port :%d became FREE (No listener)\n", now, port)
						lastState[port] = "free"
					}
					continue
				}

				// Occupied: inspect health
				currentHealth := entry.Health
				procName := "Process"
				if entry.Process != nil && entry.Process.Name != "" {
					procName = entry.Process.Name
				}

				if prev != currentHealth {
					switch currentHealth {
					case engine.HealthStatusHealthy:
						fmt.Printf("[%s] 🟢 Port :%d is HEALTHY (200 OK) -> %s (PID %d)\n", now, port, procName, entry.Process.PID)
					case engine.HealthStatusDegraded:
						fmt.Printf("[%s] 🟡 Port :%d returned WARNING (Code %d) -> %s\n", now, port, entry.HealthCode, procName)
					case engine.HealthStatusUnhealthy:
						fmt.Printf("[%s] 🔴 ALERT! Port :%d is UNHEALTHY / FROZEN -> %s (PID %d)\n", now, port, procName, entry.Process.PID)
					default:
						fmt.Printf("[%s] 🔌 Port :%d is listening -> %s\n", now, port, procName)
					}
					lastState[port] = currentHealth
				}
			}
		}

		// Initial check
		checkOnce()

		for {
			select {
			case <-ctx.Done():
				fmt.Println("\n🛑 Watch mode terminated cleanly.")
				return
			case <-ticker.C:
				checkOnce()
			}
		}
	},
}

func init() {
	watchCmd.Flags().IntVarP(&watchInterval, "interval", "i", 2000, "Polling interval in milliseconds")
	rootCmd.AddCommand(watchCmd)
}
