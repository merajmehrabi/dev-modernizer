# Project: Automated Repository Analysis and Modernization with Amazon Q CLI

This repository ships a helper CLI that clones a target project into a workspace directory and drives the Amazon Q CLI with a curated modernization prompt.

## Quick Start

Install dependencies:

```bash
npm install
```

### Launch the Web UI

Start the local web interface to configure and run modernization jobs without the CLI:

```bash
npm run web
```

Then open http://localhost:3000 to:

* Preview the generated Amazon Q prompt for a repository folder.
* Trigger dry runs or full modernization runs with logging in the browser.
* Customize workspace directory, folder name, and overwrite behavior.

### Run Against a Repository

Clone the repository into `./workspaces/<folder>` and run Amazon Q from the workspace root:

```bash
npx aq-modernize --repository https://github.com/merajmehrabi/agentic-ai-hackaton-legacy-monolith-service.git
```

Useful options:

* `--directory <path>` – Workspace root (default `./workspaces`). Amazon Q runs from this directory.
* `--folder <name>` – Custom folder name for the clone (defaults to the repo name).
* `--force` – Remove any existing clone before cloning again.
* `--dry-run` – Show what would happen without cloning or calling Amazon Q.

### Inspect the Prompt

```bash
npx aq-modernize prompt --repo-dir my-project
```

or use the alias:

```bash
npx aq-modernize print --repo-dir my-project
```

## Prompt Contents

The CLI injects the relative repository directory into this prompt and passes it to Amazon Q:

```
You are assisting with repository analysis and modernization.

Task:
1. Analyze the repository located at "./<folder>" relative to the current working directory (typically ./workspaces). Change into that directory before running tools.
2. Perform the following checks:
   - Identify deprecated, vulnerable, or outdated dependencies.
   - Detect potential code quality issues and smells.
   - Highlight weak points in application architecture or design.
   - Note testing coverage gaps or missing best practices.
3. Produce a report in **Markdown** format named `review.md` containing:
   - A summary of the overall health of the project.
   - Detailed issues with examples (dependencies, code, architecture).
   - Risks or potential problems during maintenance or scaling.
4. Produce an actionable modernization roadmap in **Markdown** format named `plan.md`:
   - Step-by-step instructions to fix identified issues.
   - Dependency upgrade and replacement strategy.
   - Suggested tooling or framework modernization.
   - Architectural improvements with reasoning.
5. Execute the roadmap iteratively:
   - Apply changes step by step.
   - After each step, verify that the project builds and runs.
   - Stop any lingering processes when checks are complete.
   - Commit each change to a dedicated branch named `modernization`.
   - Update `changelog.md` with a description of what was changed and why.
6. Continue until the entire plan is implemented.

Output Requirements:
- Use clear, structured **Markdown** for `review.md` and `plan.md`.
- Write concise and descriptive **git commit messages**.
- Update `changelog.md` incrementally with every applied change.
- Confirm at the end that the repository runs successfully and is modernized.
```

Adjust `src/prompt.js` if you need to customize the wording before running the CLI.
