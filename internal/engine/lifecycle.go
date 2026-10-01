package engine

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

// Protected System PIDs and names
var protectedProcessNames = []string{
	"system", "system idle process", "smss.exe", "csrss.exe", "wininit.exe",
	"services.exe", "lsass.exe", "svchost.exe", "dashost.exe", "spoolsv.exe",
	"dwm.exe", "explorer.exe", "launchd", "systemd", "kernel_task",
}

// IsSystemProtected checks if a process should be shielded from termination.
func IsSystemProtected(pid int32, name string) bool {
	if pid <= 4 {
		return true
	}
	if name == "" {
		name = getFallbackProcessName(pid)
	}
	clean := strings.ToLower(strings.TrimSpace(name))
	for _, p := range protectedProcessNames {
		if clean == p || strings.HasPrefix(clean, p) {
			return true
		}
	}
	return false
}

// KillProcess attempts to terminate a process gracefully, falling back to force kill if requested.
func KillProcess(pid int32, force bool) error {
	if pid <= 0 {
		return fmt.Errorf("invalid PID: %d", pid)
	}

	p, err := process.NewProcess(pid)
	var name string
	if err == nil {
		name, _ = p.Name()
	}
	if name == "" {
		name = getFallbackProcessName(pid)
	}

	if IsSystemProtected(pid, name) {
		return fmt.Errorf("🛡️ ACTION BLOCKED: PID %d (%s) is a protected system process and cannot be terminated", pid, name)
	}

	if p == nil {
		return nil
	}

	if force {
		return p.Kill()
	}

	// Try graceful termination first
	if err := p.Terminate(); err != nil {
		return p.Kill()
	}

	// Wait up to 1 second for termination, otherwise kill forcefully
	deadline := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadline) {
		running, _ := p.IsRunning()
		if !running {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	return p.Kill()
}

// KillPort finds any process bound to the specified port and terminates it.
func KillPort(port int, force bool) error {
	scan, err := ScanPorts(false)
	if err != nil {
		return err
	}

	var targetPID int32 = -1
	for _, p := range scan.Ports {
		if p.Port == port && p.Process != nil && p.Process.PID > 0 {
			targetPID = p.Process.PID
			break
		}
	}

	if targetPID == -1 {
		return fmt.Errorf("no process found listening on port %d", port)
	}

	return KillProcess(targetPID, force)
}

// HotCycle restarts a process by terminating it and re-spawning it with its original arguments in its CWD.
func HotCycle(pid int32) (*ProcessInfo, error) {
	if pid <= 0 {
		return nil, fmt.Errorf("invalid PID: %d", pid)
	}

	info, err := InspectProcess(pid, 0)
	if err != nil || info == nil {
		return nil, fmt.Errorf("could not inspect process with PID %d: %w", pid, err)
	}

	cmdline := info.Cmdline
	cwd := info.Cwd

	if cmdline == "" {
		return nil, fmt.Errorf("cannot restart process: command line args unavailable")
	}

	// Terminate existing process
	if err := KillProcess(pid, true); err != nil {
		return nil, fmt.Errorf("failed to terminate existing process: %w", err)
	}

	// Give the OS socket a brief moment to free
	time.Sleep(300 * time.Millisecond)

	// Launch new process
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", cmdline)
	} else {
		cmd = exec.Command("sh", "-c", cmdline)
	}

	if cwd != "" {
		cmd.Dir = cwd
	}

	// Detach process so it outlives scaport
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to restart process: %w", err)
	}

	newPID := int32(cmd.Process.Pid)
	return &ProcessInfo{
		PID:         newPID,
		Name:        info.Name,
		Cmdline:     info.Cmdline,
		Cwd:         info.Cwd,
		ProjectName: info.ProjectName,
		ProjectType: info.ProjectType,
		Uptime:      "0s",
	}, nil
}

// ParsePort helper
func ParsePort(str string) (int, error) {
	str = strings.TrimPrefix(str, ":")
	p, err := strconv.Atoi(str)
	if err != nil || p < 1 || p > 65535 {
		return 0, fmt.Errorf("invalid port number: %s (must be between 1 and 65535)", str)
	}
	return p, nil
}
