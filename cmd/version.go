package cmd

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"
)

var (
	Version   = "1.0.0"
	Commit    = "none"
	BuildDate = "unknown"
	Ecosystem = "GOENMA"
	Author    = "eyejdev"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number and build details of scaport",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("⚡ scaport v%s (%s/%s)\n", Version, runtime.GOOS, runtime.GOARCH)
		fmt.Printf("   Ecosystem:  %s by %s\n", Ecosystem, Author)
		fmt.Printf("   Go Runtime: %s\n", runtime.Version())
		if Commit != "none" {
			fmt.Printf("   Git Commit: %s\n", Commit)
		}
		if BuildDate != "unknown" {
			fmt.Printf("   Build Date: %s\n", BuildDate)
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.Version = Version
}
