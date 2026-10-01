package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/eyejdev/scaport/internal/engine"
	"github.com/eyejdev/scaport/internal/output"
	"github.com/eyejdev/scaport/web"
)

// Server handles the Web UI and SSE real-time streaming.
type Server struct {
	Port         int
	PollInterval time.Duration
	mu           sync.RWMutex
	lastScan     *engine.ScanResult
	clients      map[chan string]struct{}
}

// NewServer initializes a new Web UI server instance.
func NewServer(port int, interval time.Duration) *Server {
	return &Server{
		Port:         port,
		PollInterval: interval,
		clients:      make(map[chan string]struct{}),
	}
}

// Start runs the HTTP server and background poll worker.
func (s *Server) Start(ctx context.Context) error {
	// Background polling goroutine
	go s.startPoller(ctx)

	mux := http.NewServeMux()

	// Static web assets
	distFS, err := fs.Sub(web.Assets, ".")
	if err != nil {
		return err
	}
	mux.Handle("/", http.FileServer(http.FS(distFS)))

	// API routes
	mux.HandleFunc("/api/events", s.handleSSE)
	mux.HandleFunc("/api/scan", s.handleScan)
	mux.HandleFunc("/api/kill", s.handleKill)
	mux.HandleFunc("/api/restart", s.handleRestart)
	mux.HandleFunc("/api/healthcheck", s.handleHealthCheck)
	mux.HandleFunc("/api/export", s.handleExport)
	mux.HandleFunc("/api/open-browser", s.handleOpenBrowser)

	addr := fmt.Sprintf("0.0.0.0:%d", s.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	url := fmt.Sprintf("http://localhost:%d", s.Port)
	fmt.Printf("\n⚡ [GOENMA] scaport Web UI running at %s\n", url)
	fmt.Println("👉 Press Ctrl+C in this terminal to stop the server.")

	// Automatically open the default browser for zero-friction UX
	go func() {
		time.Sleep(300 * time.Millisecond)
		openBrowser(url)
	}()

	return server.ListenAndServe()
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default: // linux, bsd, etc.
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func (s *Server) startPoller(ctx context.Context) {
	ticker := time.NewTicker(s.PollInterval)
	defer ticker.Stop()

	// Initial scan with full health checks to provide instant latency and status data
	s.runScan(true)

	tickCount := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tickCount++
			// Fast socket scan on every tick; run deep HTTP health probe every 10 ticks (~15 seconds)
			withHealth := (tickCount%10 == 0)
			s.runScan(withHealth)
		}
	}
}

func (s *Server) runScan(withHealth bool) {
	scan, err := engine.ScanPorts(withHealth)
	if err != nil {
		return
	}

	s.mu.Lock()
	s.lastScan = scan
	s.mu.Unlock()

	data, err := json.Marshal(scan)
	if err != nil {
		return
	}

	s.broadcast(string(data))
}

func (s *Server) broadcast(msg string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for ch := range s.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	msgChan := make(chan string, 10)
	s.mu.Lock()
	s.clients[msgChan] = struct{}{}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, msgChan)
		close(msgChan)
		s.mu.Unlock()
	}()

	// Send current state immediately if available
	s.mu.RLock()
	if s.lastScan != nil {
		if data, err := json.Marshal(s.lastScan); err == nil {
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
	s.mu.RUnlock()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-msgChan:
			_, err := fmt.Fprintf(w, "data: %s\n\n", msg)
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	scan := s.lastScan
	s.mu.RUnlock()

	if scan == nil {
		var err error
		scan, err = engine.ScanPorts(false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(scan)
}

func (s *Server) handleKill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pidStr := r.URL.Query().Get("pid")
	portStr := r.URL.Query().Get("port")

	var err error
	if pidStr != "" && pidStr != "0" {
		pid, _ := strconv.Atoi(pidStr)
		err = engine.KillProcess(int32(pid), true)
	} else if portStr != "" {
		port, _ := strconv.Atoi(portStr)
		err = engine.KillPort(port, true)
	} else {
		http.Error(w, "pid or port required", http.StatusBadRequest)
		return
	}

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// Trigger immediate re-scan
	go s.runScan(false)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pidStr := r.URL.Query().Get("pid")
	pid, err := strconv.Atoi(pidStr)
	if err != nil || pid <= 0 {
		http.Error(w, "invalid pid", http.StatusBadRequest)
		return
	}

	newProc, err := engine.HotCycle(int32(pid))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	go s.runScan(false)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":     true,
		"newPid": newProc.PID,
	})
}

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	go s.runScan(true)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	format := strings.ToLower(r.URL.Query().Get("format"))

	s.mu.RLock()
	scan := s.lastScan
	s.mu.RUnlock()

	if scan == nil {
		var err error
		scan, err = engine.ScanPorts(false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	switch format {
	case "json":
		w.Header().Set("Content-Disposition", "attachment; filename=scaport-ports.json")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		data, _ := output.ToJSON(scan)
		_, _ = w.Write([]byte(data))

	case "csv":
		w.Header().Set("Content-Disposition", "attachment; filename=scaport-ports.csv")
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		csvData, err := output.ToCSV(scan)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(csvData))

	case "html":
		w.Header().Set("Content-Disposition", "inline; filename=scaport-report.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		htmlData := output.ToHTML(scan)
		_, _ = w.Write([]byte(htmlData))

	default: // markdown by default
		w.Header().Set("Content-Disposition", "attachment; filename=scaport-ports.md")
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		md := output.ToMarkdown(scan)
		_, _ = w.Write([]byte(md))
	}
}

func (s *Server) handleOpenBrowser(w http.ResponseWriter, r *http.Request) {
	portStr := r.URL.Query().Get("port")
	port, err := strconv.Atoi(portStr)
	if err != nil || port <= 0 {
		http.Error(w, "invalid port", http.StatusBadRequest)
		return
	}

	url := fmt.Sprintf("http://localhost:%d", port)
	openBrowser(url)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
