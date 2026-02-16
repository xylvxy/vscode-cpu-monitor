#!/usr/bin/env node

const { execSync, exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Platform detection
const platform = os.platform(); // 'darwin', 'linux', 'win32'

// CLI argument parsing
const args = process.argv.slice(2);

// Help message
function showHelp() {
  console.log(`
VSCode CPU Monitor - Monitor and kill VS Code zombie processes

Usage:
  vscode-cpu-monitor [options]

Options:
  -d, --daemon     Run in background (daemon mode)
  -l, --log [date] View logs (default: today, format: YYYY-MM-DD)
  -s, --stop       Stop the background daemon
  -h, --help       Show this help message

Examples:
  vscode-cpu-monitor          Start monitor in foreground
  vscode-cpu-monitor -d       Start monitor in background
  vscode-cpu-monitor -l       View today's logs
  vscode-cpu-monitor -l 2024-01-15  View logs for specific date
  vscode-cpu-monitor -s       Stop background daemon
`);
  process.exit(0);
}

// PID file for daemon management
const pidFile = path.join(__dirname, '.daemon.pid');

// Handle -h/--help
if (args.includes('-h') || args.includes('--help')) {
  showHelp();
}

// Handle -s/--stop
if (args.includes('-s') || args.includes('--stop')) {
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log(`Daemon stopped (PID: ${pid})`);
    } catch (e) {
      fs.unlinkSync(pidFile);
      console.log('Daemon was not running');
    }
  } else {
    console.log('No daemon is running');
  }
  process.exit(0);
}

// Handle -l/--log
const logIndex = args.findIndex(a => a === '-l' || a === '--log');
if (logIndex !== -1) {
  const logDir = path.join(__dirname, 'log');
  let date = new Date().toISOString().split('T')[0]; // Default: today

  // Check if next argument is a date
  if (args[logIndex + 1] && !args[logIndex + 1].startsWith('-')) {
    date = args[logIndex + 1];
  }

  const logFile = path.join(logDir, `${date}.log`);

  if (fs.existsSync(logFile)) {
    console.log(fs.readFileSync(logFile, 'utf-8'));
  } else {
    // List available log files
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log')).sort().reverse();
      if (files.length > 0) {
        console.log(`No log found for ${date}. Available logs:`);
        files.slice(0, 10).forEach(f => console.log(`  ${f.replace('.log', '')}`));
      } else {
        console.log('No logs available');
      }
    } else {
      console.log('No logs available');
    }
  }
  process.exit(0);
}

// Handle -d/--daemon
if (args.includes('-d') || args.includes('--daemon')) {
  // Check if already running
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0); // Check if process exists
      console.log(`Daemon already running (PID: ${pid})`);
      process.exit(0);
    } catch (e) {
      // Process not running, remove stale pid file
      fs.unlinkSync(pidFile);
    }
  }

  // Spawn detached process
  const child = spawn(process.execPath, [__filename], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DAEMON_MODE: '1' }
  });

  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));
  console.log(`Daemon started (PID: ${child.pid})`);
  console.log(`View logs: vscode-cpu-monitor -l`);
  console.log(`Stop daemon: vscode-cpu-monitor -s`);
  process.exit(0);
}

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const { cpuThreshold, minRunTime, cpuHitCount, checkInterval, watchList, whiteList } = config;

// Merge white list: common + current platform
const platformWhiteList = [
  ...(whiteList.common || []),
  ...(whiteList[platform] || [])
];

// CPU threshold hit counter { pid: count }
const cpuHitCounter = new Map();

// Log directory
const logDir = path.join(__dirname, 'log');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Get current log file path (daily rotation)
 * @returns {string}
 */
function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logDir, `${date}.log`);
}

// Check if running as daemon
const isDaemon = process.env.DAEMON_MODE === '1';

/**
 * Write log
 * @param {string} level - Log level: INFO/WARN/ERROR/KILL
 * @param {string} message - Log message
 */
function log(level, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logLine = `[${timestamp}] [${level}] ${message}`;

  // Output to console (skip in daemon mode)
  if (!isDaemon) {
    console.log(logLine);
  }

  // Write to file
  const logFile = getLogFilePath();
  fs.appendFileSync(logFile, logLine + '\n');
}

const platformNames = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' };
log('INFO', '=== Code Monitor Started ===');
log('INFO', `Platform: ${platformNames[platform] || platform}`);
log('INFO', `CPU threshold: ${cpuThreshold}%, consecutive hits: ${cpuHitCount}`);
log('INFO', `Min run time: ${minRunTime}s`);
log('INFO', `Check interval: ${checkInterval}ms`);
log('INFO', `Watch list: ${watchList.length} process(es)`);
log('INFO', `White list: ${platformWhiteList.length} process(es)`);
log('INFO', `Log directory: ${logDir}`);

/**
 * Parse elapsed time string to seconds
 * Format: MM:SS, HH:MM:SS, D-HH:MM:SS (Unix) or seconds (Windows)
 * @param {string} etime
 * @returns {number}
 */
function parseElapsedTime(etime) {
  if (!etime) return 0;

  // Windows: direct seconds
  if (/^\d+$/.test(etime.trim())) {
    return parseInt(etime.trim(), 10);
  }

  const parts = etime.trim().split(/[-:]/);
  let seconds = 0;

  if (etime.includes('-')) {
    // D-HH:MM:SS
    const days = parseInt(parts[0], 10);
    seconds = days * 86400 + parseInt(parts[1], 10) * 3600 + parseInt(parts[2], 10) * 60 + parseInt(parts[3], 10);
  } else if (parts.length === 3) {
    // HH:MM:SS
    seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    // MM:SS
    seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  return seconds;
}

/**
 * Get process list - macOS/Linux
 * @returns {Array<{pid: number, cpu: number, mem: number, elapsed: number, command: string}>}
 */
function getProcessListUnix() {
  const output = execSync('ps -eo pid,%cpu,rss,etime,command', { encoding: 'utf-8' });
  const lines = output.trim().split('\n').slice(1);

  return lines.map(line => {
    const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+(\d+)\s+([\d:-]+)\s+(.+)$/);
    if (!match) return null;

    return {
      pid: parseInt(match[1], 10),
      cpu: parseFloat(match[2]),
      mem: Math.round(parseInt(match[3], 10) / 1024), // KB -> MB
      elapsed: parseElapsedTime(match[4]),
      command: match[5]
    };
  }).filter(Boolean);
}

/**
 * Get process list - Windows
 * @returns {Array<{pid: number, cpu: number, mem: number, elapsed: number, command: string}>}
 */
function getProcessListWindows() {
  // PowerShell command to get process info
  const psCmd = `powershell -Command "Get-Process | ForEach-Object { $cpu = $_.CPU; $elapsed = if($_.StartTime) { [int](New-TimeSpan -Start $_.StartTime -End (Get-Date)).TotalSeconds } else { 0 }; Write-Output ('{0}|{1}|{2}|{3}|{4}' -f $_.Id, [math]::Round($cpu, 1), [math]::Round($_.WorkingSet64/1MB), $elapsed, $_.ProcessName) }"`;

  const output = execSync(psCmd, { encoding: 'utf-8' });
  const lines = output.trim().split('\n');

  return lines.map(line => {
    const parts = line.trim().split('|');
    if (parts.length < 5) return null;

    return {
      pid: parseInt(parts[0], 10),
      cpu: parseFloat(parts[1]) || 0,
      mem: Math.round(parseFloat(parts[2]) || 0),
      elapsed: parseInt(parts[3], 10) || 0,
      command: parts[4]
    };
  }).filter(Boolean);
}

/**
 * Get system process list
 * @returns {Array<{pid: number, cpu: number, mem: number, elapsed: number, command: string}>}
 */
function getProcessList() {
  try {
    if (platform === 'win32') {
      return getProcessListWindows();
    } else {
      return getProcessListUnix();
    }
  } catch (error) {
    log('ERROR', `Failed to get process list: ${error.message}`);
    return [];
  }
}

/**
 * Check if process is in watch list
 * @param {string} command - Process command
 * @returns {boolean}
 */
function isInWatchList(command) {
  return watchList.some(item => command.includes(item));
}

/**
 * Check if process is in white list
 * @param {string} command - Process command
 * @returns {boolean}
 */
function isInWhiteList(command) {
  return platformWhiteList.some(item => command.includes(item));
}

/**
 * Kill process
 * @param {number} pid - Process ID
 * @param {string} command - Process command
 */
function killProcess(pid, command) {
  try {
    if (platform === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`);
    }
    log('KILL', `PID: ${pid}, Command: ${command.substring(0, 80)}...`);
  } catch (error) {
    log('ERROR', `Failed to kill process ${pid}: ${error.message}`);
  }
}

/**
 * Execute one check cycle
 */
function check() {
  const processes = getProcessList();

  // Filter processes in watch list
  const watchedProcesses = processes.filter(p => isInWatchList(p.command));

  if (watchedProcesses.length === 0) {
    return; // No watched processes, return silently
  }

  log('INFO', `Found ${watchedProcesses.length} watched process(es)`);

  // Current PIDs in this check
  const currentPids = new Set(watchedProcesses.map(p => p.pid));

  // Clean up counters for processes that no longer exist
  for (const pid of cpuHitCounter.keys()) {
    if (!currentPids.has(pid)) {
      cpuHitCounter.delete(pid);
    }
  }

  // Check each process
  for (const proc of watchedProcesses) {
    const { pid, cpu, mem, elapsed, command } = proc;

    // Check if in white list
    if (isInWhiteList(command)) {
      continue; // White listed, skip
    }

    // Check if run time meets minimum
    if (elapsed < minRunTime) {
      continue; // Run time insufficient, skip
    }

    let shouldKill = false;
    let reason = '';

    // Check CPU threshold
    if (cpu > cpuThreshold) {
      const count = (cpuHitCounter.get(pid) || 0) + 1;
      cpuHitCounter.set(pid, count);

      if (count >= cpuHitCount) {
        shouldKill = true;
        reason = `CPU ${cpu}% exceeded threshold ${cpuThreshold}% for ${count} consecutive checks`;
      } else {
        log('WARN', `PID: ${pid}, CPU: ${cpu}% exceeded (${count}/${cpuHitCount}), Mem: ${mem}MB, Elapsed: ${elapsed}s`);
      }
    } else {
      // CPU back to normal, reset counter
      cpuHitCounter.delete(pid);
    }

    // Execute kill
    if (shouldKill) {
      log('WARN', `PID: ${pid}, ${reason}, Elapsed: ${elapsed}s`);
      killProcess(pid, command);
      cpuHitCounter.delete(pid);
    }
  }
}

// Start periodic check
log('INFO', 'Monitoring started...');
check(); // Run immediately
setInterval(check, checkInterval);

// Handle exit signal
process.on('SIGINT', () => {
  log('INFO', 'Monitor stopped');
  process.exit(0);
});
