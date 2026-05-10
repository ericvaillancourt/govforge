// Command gf is the GovForge developer CLI.
//
// gf is a Go binary that talks to the GovForge backend (Python) over local
// HTTP. The exception is `gf init`, which is autonomous: it creates the
// .govforge/ directory and the SQLite database using a schema embedded via
// the standard library `embed` package, with no backend running.
package main

import (
	"os"

	"github.com/ericvaillancourt/govforge/cli/internal/commands"
)

// Version is set at build time via -ldflags "-X main.Version=v0.1.0".
var Version = "dev"

func main() {
	os.Exit(commands.Execute(Version))
}
