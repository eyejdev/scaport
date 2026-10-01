package engine

import (
	"testing"
)

func TestParsePort(t *testing.T) {
	tests := []struct {
		input    string
		expected int
		hasError bool
	}{
		{"3000", 3000, false},
		{":8080", 8080, false},
		{"5432", 5432, false},
		{"0", 0, true},
		{"70000", 0, true},
		{"invalid", 0, true},
	}

	for _, tc := range tests {
		got, err := ParsePort(tc.input)
		if tc.hasError {
			if err == nil {
				t.Errorf("expected error for input %q, got nil", tc.input)
			}
		} else {
			if err != nil {
				t.Errorf("unexpected error for input %q: %v", tc.input, err)
			}
			if got != tc.expected {
				t.Errorf("for input %q: expected %d, got %d", tc.input, tc.expected, got)
			}
		}
	}
}

func TestScanPorts(t *testing.T) {
	result, err := ScanPorts(false)
	if err != nil {
		t.Fatalf("ScanPorts failed: %v", err)
	}

	if result == nil {
		t.Fatal("expected non-nil ScanResult")
	}

	if result.Total != len(result.Ports) {
		t.Errorf("expected Total (%d) to match Ports slice length (%d)", result.Total, len(result.Ports))
	}
}
