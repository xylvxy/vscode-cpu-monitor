# VSCode CPU Monitor

A Node.js process monitor designed to solve the **VS Code high CPU usage problem**.

VS Code's `Code Helper (Plugin)` process often becomes a zombie process with extremely high CPU usage (90%+), causing system lag and battery drain. This tool automatically detects and terminates such runaway processes.

## Features

### Core Features

1. **Process Monitoring** - Periodically scan system processes and detect CPU usage
2. **Zombie Process Detection** - Identify processes with abnormally high CPU usage
3. **Auto Termination** - Kill processes that meet the termination criteria
4. **Watch List** - Only monitor processes in the watch list to avoid killing critical system processes

### Watch List

Initial watch list:

```
Code Helper (Plugin)
```

### Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `cpuThreshold` | CPU usage threshold (%) | 80 |
| `memThreshold` | Memory threshold (MB) | 512 |
| `minRunTime` | Minimum run time (s) | 60 |
| `cpuHitCount` | Consecutive CPU threshold hits | 3 |
| `checkInterval` | Check interval (ms) | 5000 |
| `watchList` | Process watch list | See above |

### White List

Processes in the white list will never be terminated, even if they match the watch list and exceed resource thresholds. Configuration includes common processes and platform-specific system processes.

**Default White List:**

| Category | Processes |
|----------|-----------|
| Common | node, npm, git |
| macOS | launchd, kernel_task, WindowServer, Finder, Dock, etc. |
| Linux | systemd, init, kthreadd, sshd, cron, etc. |
| Windows | System, csrss, svchost, explorer, dwm, etc. |

### Termination Rules

A process will be terminated only when ALL of the following conditions are met:

1. **In watch list** - Process name matches any item in watchList
2. **Not in white list** - Process is not protected by the white list
3. **Run time threshold** - Running time >= `minRunTime` (avoids killing newly started processes)
4. **Resource threshold exceeded** - Either of:
   - CPU exceeds `cpuThreshold` for `cpuHitCount` consecutive checks
   - Memory exceeds `memThreshold`

**Notes:**
- CPU uses consecutive hit counting to avoid false kills from temporary spikes
- CPU counter resets automatically when CPU returns to normal
- Memory threshold triggers immediate termination (no consecutive checks)

### Execution Flow

1. Scan system processes at configured interval
2. Filter processes matching the watch list
3. Skip processes in the white list
4. Check CPU and memory usage
5. Kill processes exceeding thresholds
6. Log all actions

## Installation

```bash
npm i @shawn777/vscode-cpu-monitor
```

Or install globally:
```bash
npm i -g @shawn777/vscode-cpu-monitor
```

## Usage

```bash
# Run monitor
npm start
```

Or if installed globally:
```bash
vscode-cpu-monitor
```

### Logging

- Log directory: `log/`
- Daily log files: `YYYY-MM-DD.log`
- Output to both console and file

**Log Levels:**

| Level | Description |
|-------|-------------|
| `INFO` | General information (startup, process discovery) |
| `WARN` | Warnings (CPU threshold exceeded) |
| `ERROR` | Errors (operation failed) |
| `KILL` | Termination records |

**Log Format:**

```
[2026/2/12 14:05:15] [INFO] === Code Monitor Started ===
[2026/2/12 14:05:15] [WARN] PID: 8888, CPU: 98.8% exceeded threshold 80%
[2026/2/12 14:05:15] [KILL] PID: 8888, Command: Code Helper (Plugin)...
```

## Tech Stack

- Node.js
- Supported Platforms: macOS / Linux / Windows

### Platform Support

| Platform | Get Processes | Kill Process |
|----------|---------------|--------------|
| macOS | `ps -eo pid,%cpu,rss,etime,command` | `kill -9` |
| Linux | `ps -eo pid,%cpu,rss,etime,command` | `kill -9` |
| Windows | PowerShell `Get-Process` | `taskkill /F /PID` |
