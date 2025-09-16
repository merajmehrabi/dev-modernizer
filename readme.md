# Project: Automated Repository Analysis and Modernization with Amazon Q CLI

This project provides both a CLI and a local Web UI to run Amazon Q modernization workflows against a repository. It clones your target repo into a workspace, generates a focused prompt, and runs the Amazon Q CLI while streaming logs to the browser and terminal.

## Prerequisites

- Node.js 18+
- Git installed and on PATH
- Amazon Q CLI installed and on PATH (`q --version` should work)

## Quick Start

- Install dependencies:

  ```bash
  npm install
  ```

- Launch the Web UI:

  ```bash
  npm run web
  ```

  Open http://localhost:3000 to:
  - Configure repository URL, workspace directory, and folder name
  - Preview the generated Amazon Q prompt
  - Run dry runs or full modernization runs
  - Watch real-time execution logs and artifacts as they are produced

## Web UI Features

- Live logs with streaming: execution logs stream to the browser in real time. You can maximize the log in a modal.
- Collapsible panels: while a run is active, Repository Settings and Prompt Preview minimize with animation.
- Artifacts panel with live status and inline preview:
  - Order of creation: Review → Plan → Changelog
  - Status badges show: “analyzing…”, “drafting…”, “updating…”, or “available”
  - Tabbed inline preview renders the selected artifact and updates live as files change

Notes:
- Dry runs do not stream logs; they return a single aggregated log on completion.
- ANSI sequences from the Q CLI are sanitized in the browser for clean display.

## CLI Usage

Run against a repository (clones into `./workspaces/<folder>` by default):

```bash
npx aq-modernize --repository https://github.com/your/repo.git
```

Options:

- `--directory <path>` – Workspace root (default `./workspaces`)
- `--folder <name>` – Folder name for the clone (defaults to repo name)
- `--force` – Overwrite existing folder if it exists
- `--dry-run` – Show planned actions without cloning or calling Q

Behavior:
- The CLI streams Amazon Q output to stdout in real time.

## Prompt Inspection

```bash
npx aq-modernize prompt --repo-dir my-project
```

Or use the alias:

```bash
npx aq-modernize print --repo-dir my-project
```

## Prompt Contents (summary)

The generated prompt asks Q to:

1. Analyze the repo at `./<folder>` relative to the workspace
2. Report issues and risks, then produce:
   - `review.md` (overall report)
   - `plan.md` (modernization steps)
   - `changelog.md` (incremental changes)
3. Execute the plan iteratively, verifying along the way

You can customize wording in `src/prompt.js`.

## Timeouts

- The Amazon Q subprocess timeout is set to 1 hour by default.
  - Code: `src/services/modernizer.js` (execa `timeout: 3600000`)
- The UI’s non-streaming request timeout is also 1 hour.
  - Code: `public/app.js` (AbortController)

## API Endpoints (UI backend)

- `GET /api/health` – Health check
- `GET /api/prompt?repoDir=<folder>` – Render the prompt
- `POST /api/run` – Run modernization and return aggregated log on completion
- `GET /api/run-stream?...` – Server-Sent Events (SSE) with real-time logs
- `GET /api/file?directory=<dir>&folder=<name>&name=<file>` – Fetch file content
- `GET /api/files-stream?directory=<dir>&folder=<name>&names=a,b,c` – SSE stream of artifact changes

## Troubleshooting

- Q CLI not found: ensure `q --version` works in your shell. The server returns an explicit error if Q is missing.
- Logs look garbled: the UI strips ANSI sequences, but browser extensions may still inject console messages; these are harmless.
- No artifact updates: make sure the workspace directory and folder are correct; the server waits for the folder to appear before watching it.

## Scripts

- `npm run web` – Start the Web UI (Express server + static frontend)
- `npm start` – Run the CLI entry (`src/index.js`)

## Workspace Layout

- Default workspace root: `./workspaces`
- Cloned repo path: `./workspaces/<folder>`
- Artifacts produced by Q:
  - `review.md`
  - `plan.md`
  - `changelog.md`
