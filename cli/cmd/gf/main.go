// Command gf is the GovForge developer CLI.
//
// gf is a Go binary that talks to the GovForge backend (Python) over local
// HTTP. The exception is "gf init", which is autonomous: it creates the
// .govforge/ directory and the SQLite DB using a schema embedded via the
// standard library embed package, with no backend running.
package main

import (
	"fmt"
	"os"
)

// Version is set at build time via -ldflags "-X main.Version=v0.1.0".
var Version = "dev"

func main() {
	if len(os.Args) >= 2 {
		switch os.Args[1] {
		case "version", "--version", "-V":
			fmt.Printf("gf %s\n", Version)
			return
		case "help", "--help", "-h":
			usage()
			return
		}
	}
	usage()
}

func usage() {
	fmt.Println(`gf — GovForge developer CLI

Usage:
  gf <command> [flags]

Available commands (Phase 1, to be implemented):
  init        Initialize .govforge/ in the current repo
  task        Create / list / show tasks
  decision    Create / show / timeline of decisions
  git         Attach diff / show diff for a decision
  policy      List / check policies
  review      Request / list / show reviews
  approve     Approve a decision
  reject      Reject a decision
  mcp serve   Start the MCP server (spawns Python backend)
  api serve   Start the local HTTP API (spawns Python backend)
  ui serve    Start the local UI cockpit (spawns Next.js)
  version     Print version

Use "gf <command> --help" for more information about a command.

Docs: https://govforge.dev/docs
Repo: https://github.com/ericvaillancourt/govforge`)
}
