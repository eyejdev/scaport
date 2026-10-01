package cmd

import (
	"fmt"
	"os"

	"github.com/eyejdev/scaport/internal/engine"
	"github.com/spf13/cobra"
)

var (
	forceKill bool
)

var killCmd = &cobra.Command{
	Use:   "kill <port|pid>",
	Short: "Immediately terminate the process bound to a specific port or PID",
	Example: `  scaport kill 3000
  scaport kill 8080 --force
  scaport kill :5432`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		target := args[0]
		port, err := engine.ParsePort(target)
		if err == nil {
			// Target is a port
			err = engine.KillPort(port, forceKill)
			if err != nil {
				fmt.Fprintf(os.Stderr, "❌ Failed to terminate process on port %d: %v\n", port, err)
				os.Exit(1)
			}
			fmt.Printf("⚡ Process on port %d terminated successfully.\n", port)
			return
		}

		// Try target as PID
		var pid int
		_, sscanfErr := fmt.Sscanf(target, "%d", &pid)
		if sscanfErr == nil && pid > 0 {
			err = engine.KillProcess(int32(pid), forceKill)
			if err != nil {
				fmt.Fprintf(os.Stderr, "❌ Failed to terminate PID %d: %v\n", pid, err)
				os.Exit(1)
			}
			fmt.Printf("⚡ Process PID %d terminated successfully.\n", pid)
			return
		}

		fmt.Fprintf(os.Stderr, "❌ Invalid port or PID argument: %s\n", target)
		os.Exit(1)
	},
}

func init() {
	killCmd.Flags().BoolVarP(&forceKill, "force", "f", true, "Forcefully kill the process (SIGKILL)")
	rootCmd.AddCommand(killCmd)
}
