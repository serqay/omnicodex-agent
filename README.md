# OmniCodex Agent

Native desktop AI Coding Agent combining **Claude Code** (local filesystem access, terminal execution, autonomous agentic loop) and **OpenAI Codex** (real-time generation, refactoring, and AST-like search-and-replace diff patches) with deep **OmniRouter** integration.

Built with **Electron**, **TypeScript**, **React 18**, **Tailwind CSS**, **Monaco Editor**, and **xterm.js**. Designed in strict accordance with the utilitarian, high-contrast, high-density design system (Linear / Vercel style).

---

## Key Features

1. **Native OmniRouter Integration (OpenAI-compatible protocol)**:
   - Dynamic model discovery via `GET {baseUrl}/models` with Bearer auth.
   - Searchable and filterable model selector with real-time connection status.
   - SSE streaming with live output and native support for reasoning blocks (`reasoning_content` and `<think>` tags).
   - Full function calling / tools support (`tools: [...]`).

2. **Full Agentic Loop (Claude Code + Codex)**:
   - `list_directory(path, recursive, max_depth)`: Inspect workspace files with automatic `.gitignore` exclusion.
   - `read_file(path, start_line, end_line)`: Read source files with line numbering.
   - `write_file(path, content)`: Autonomous full file creation and overwrite.
   - `apply_diff(path, search_block, replace_block)`: Targeted search-and-replace with exact context matching and loose whitespace fallback.
   - `search_files(query, regex)`: Fast workspace regex and text search.
   - `execute_command(command, cwd)`: Real-time shell command execution with live streaming `stdout`/`stderr` directly into xterm.js.

3. **Human-in-the-Loop Safety & Auto-Pilot**:
   - **Safe Mode (Default)**: Read-only operations run automatically, while file writes, diff patches, and shell commands pause for explicit user `Approve` or `Reject` confirmation with live previews.
   - **Auto-Pilot (YOLO Mode)**: One-click toggle allowing the agent to autonomously edit files and run commands until the task is complete.

4. **IDE-Grade 3-Column Dark UI**:
   - **Left Panel**: Workspace file explorer, task history sessions, live Git status (branch, modified/staged count).
   - **Central Panel**: Conversational agent stream, collapsible thinking blocks, interactive tool approval cards, `@file` context autocomplete tags, token counters.
   - **Right Studio Panel**:
     - **Diff Viewer**: Side-by-side or unified Monaco Diff Editor with accept/reject action bars.
     - **Terminal**: Integrated xterm.js terminal with ANSI color support and manual command bar.
     - **Code Editor**: Monaco editor for inspecting and editing workspace source code.

---

## Quick Start & Running

### Prerequisites
- Node.js 18+ (tested on Node 20 & 24)
- npm 9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Development Mode
```bash
npm run dev
```
This automatically compiles the preload and main scripts, starts Vite dev server on port `5173`, and launches the native Electron application.

### 3. Production Build & Start
```bash
# Compile renderer (Vite), preload (esbuild), and main process (esbuild)
npm run build

# Start the built Electron desktop application
npm start
```

### 4. Running Test Suite
```bash
# Run unit & boundary tests across all core systems
npm test

# Run strict TypeScript type check
npm run typecheck
```

### 5. Windows Executable (.exe) Packaging
```bash
# Package both portable executable and NSIS installer
npm run dist

# Or package only the portable single-file executable
npm run dist:portable

# Or package only the NSIS setup installer
npm run dist:nsis
```

The output executables are generated in the `release/` directory:
- `release/OmniCodex Agent-Portable-1.0.0.exe`: Standalone portable executable that runs immediately without installation.
- `release/OmniCodex Agent Setup 1.0.0.exe`: Standard Windows installer wizard that installs the application and creates Start Menu & Desktop shortcuts.
- `release/win-unpacked/OmniCodex Agent.exe`: Unpacked directory distribution for direct execution or portable distribution.

---

## OmniRouter Configuration

1. Click the **Settings** icon (gear) in the top-right corner.
2. Enter your **OmniRouter Base URL** (defaults to `https://api.omnirouter.ai/v1` or custom endpoint like `http://localhost:8000/v1`).
3. Enter your **API Key**.
4. Click **Test Connection**: the application will connect, load available models, and populate the model dropdown automatically.
5. Choose your default model (e.g. `anthropic/claude-3.7-sonnet`, `deepseek/deepseek-r1`, or custom model ID) and click **Save Changes**.
