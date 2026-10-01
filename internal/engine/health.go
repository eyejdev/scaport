package engine

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"sync"
	"time"
)

var (
	httpClient = &http.Client{
		Timeout: 700 * time.Millisecond,
		Transport: &http.Transport{
			TLSClientConfig:   &tls.Config{InsecureSkipVerify: true}, // nolint:gosec
			DisableKeepAlives: true,
		},
	}
)

// CheckHealth performs an asynchronous health check against an open port.
func CheckHealth(port int) (HealthStatus, int, int64) {
	endpoints := []string{
		fmt.Sprintf("http://127.0.0.1:%d/health", port),
		fmt.Sprintf("http://127.0.0.1:%d/api/health", port),
		fmt.Sprintf("http://127.0.0.1:%d/", port),
	}

	start := time.Now()
	for _, url := range endpoints {
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "scaport-healthcheck/1.0")

		resp, err := httpClient.Do(req)
		if err == nil {
			elapsed := time.Since(start).Milliseconds()
			_ = resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				return HealthStatusHealthy, resp.StatusCode, elapsed
			}
			return HealthStatusDegraded, resp.StatusCode, elapsed
		}
	}

	// Try HTTPS fallback if HTTP refused or failed
	httpsURL := fmt.Sprintf("https://127.0.0.1:%d/", port)
	req, err := http.NewRequest(http.MethodGet, httpsURL, nil)
	if err == nil {
		req.Header.Set("User-Agent", "scaport-healthcheck/1.0")
		resp, err := httpClient.Do(req)
		if err == nil {
			elapsed := time.Since(start).Milliseconds()
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				return HealthStatusHealthy, resp.StatusCode, elapsed
			}
			return HealthStatusDegraded, resp.StatusCode, elapsed
		}
	}

	return HealthStatusUnhealthy, 0, time.Since(start).Milliseconds()
}

// CheckAllHealth checks health for all port entries concurrently.
func CheckAllHealth(entries []*PortEntry) {
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20) // Limit concurrency to avoid socket exhaustion

	for _, entry := range entries {
		if entry.Protocol != "tcp" && entry.Protocol != "tcp6" {
			continue
		}

		wg.Add(1)
		go func(e *PortEntry) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			status, code, durMs := CheckHealth(e.Port)
			e.Health = status
			e.HealthCode = code
			e.HealthTimeMs = durMs
		}(entry)
	}

	wg.Wait()
}
