package cmd

import (
	"fmt"
	"os"

	"github.com/eyejdev/scaport/internal/engine"
	"github.com/spf13/cobra"
)

var checkCmd = &cobra.Command{
	Use:   "check [ports...]",
	Short: "Validate if one or more ports are free before launching dev tools (Sentinel)",
	Long: `Check ensures that required development ports are free before starting servers.
Exits with code 0 if all ports are free.
Exits with code 1 and prints collision details if any port is currently occupied.`,
	Example: `  scaport check 3000 8080 5432
  scaport check :3000`,
	Args: cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		scan, err := engine.ScanPorts(false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error scanning ports: %v\n", err)
			os.Exit(2)
		}

		occupiedMap := make(map[int]*engine.PortEntry)
		for _, p := range scan.Ports {
			occupiedMap[p.Port] = p
		}

		hasCollisions := false
		fmt.Println("\n🛡️  [SCAPORT] Port Collision Sentinel Check:")

		for _, arg := range args {
			port, err := engine.ParsePort(arg)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ❌ %v\n", err)
				hasCollisions = true
				continue
			}

			if entry, occupied := occupiedMap[port]; occupied {
				hasCollisions = true
				procName := "Unknown"
				pid := 0
				if entry.Process != nil {
					procName = entry.Process.Name
					pid = int(entry.Process.PID)
				}
				fmt.Printf("  🔴 Port :%d is OCCUPIED by PID %d (%s)\n", port, pid, procName)
			} else {
				fmt.Printf("  🟢 Port :%d is FREE\n", port)
			}
		}

		if hasCollisions {
			fmt.Println("\n❌ Port collision detected! Free up ports or terminate conflicting processes.")
			os.Exit(1)
		}

		fmt.Println("\n✨ All requested ports are free and ready for use.")
		os.Exit(0)
	},
}

func init() {
	rootCmd.AddCommand(checkCmd)
}
