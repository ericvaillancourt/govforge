package client

import (
	"strings"
	"time"
)

// Time wraps time.Time with a tolerant JSON unmarshaller. The backend sometimes
// emits naive ISO timestamps (no `Z`) because SQLite drops timezone info on
// round-trip; we treat those as UTC rather than failing the whole call.
//
// The wrapper preserves the value exactly as parsed; downstream code can call
// `.Time` to get a `time.Time` or print directly via `.String()`.
type Time struct {
	time.Time
}

const (
	rfc3339NoTZ      = "2006-01-02T15:04:05.999999"
	rfc3339NoTZShort = "2006-01-02T15:04:05"
)

// UnmarshalJSON tries RFC3339 (with timezone) first, then naive UTC variants.
func (t *Time) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		return nil
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		rfc3339NoTZ,
		rfc3339NoTZShort,
	} {
		if parsed, err := time.Parse(layout, s); err == nil {
			t.Time = parsed.UTC()
			return nil
		}
	}
	// Last-resort: hand off to the standard parser so the user sees the real error.
	parsed, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return err
	}
	t.Time = parsed
	return nil
}

// MarshalJSON emits RFC3339Nano. Used only when callers re-marshal a typed
// payload (e.g. `gf X --json` round-trips through the typed struct).
func (t Time) MarshalJSON() ([]byte, error) {
	if t.IsZero() {
		return []byte(`null`), nil
	}
	return []byte(`"` + t.Time.UTC().Format(time.RFC3339Nano) + `"`), nil
}

// Format is a thin pass-through for table rendering.
func (t Time) Format(layout string) string {
	if t.IsZero() {
		return ""
	}
	return t.Time.Format(layout)
}
