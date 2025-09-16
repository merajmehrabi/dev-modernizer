const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const execa = require('execa');
const { getPrompt } = require('./prompt');
const { runModernization, deriveFolderName } = require('./services/modernizer');
const { getSimplePrompt } = require('./test-prompt');
const { normalizeControl } = require('./utils/ansi');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

// Add CORS and security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

app.get('/api/prompt', (req, res) => {
  const repoDir = req.query.repoDir;

  try {
    const prompt = getPrompt({ repoDir });
    return res.json({ prompt });
  } catch (error) {
    console.error('Prompt error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/folder-name', (req, res) => {
  const { repository } = req.query;

  if (!repository) {
    return res.status(400).json({ error: 'Repository query parameter is required.' });
  }

  return res.json({ folderName: deriveFolderName(repository) });
});

app.post('/api/run', async (req, res) => {
  const { repository, directory, folder, force, dryRun } = req.body || {};

  if (!repository) {
    return res.status(400).json({ error: 'Repository is required.' });
  }

  const logMessages = [];
  
  try {
    const result = await runModernization(
      {
        repository,
        directory,
        folder,
        force: Boolean(force),
        dryRun: Boolean(dryRun),
      },
      {
        onMessage: (message) => {
          logMessages.push(normalizeControl(message));
        },
      },
    );

    const logContent = logMessages.join('');
    
    return res.json({ 
      success: true, 
      log: logContent || (dryRun ? 'Dry run completed successfully.' : 'Process completed.'), 
      result 
    });
  } catch (error) {
    console.error('Modernization error:', error);
    const errorMessage = `Error: ${error.message}\n`;
    logMessages.push(errorMessage);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message, 
      log: logMessages.join('') || errorMessage 
    });
  }
});

// Streamed run via Server-Sent Events (real-time logs)
app.get('/api/run-stream', async (req, res) => {
  const { repository, directory, folder } = req.query || {};
  const toBool = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
  const force = toBool(req.query?.force);
  const dryRun = toBool(req.query?.dryRun);

  if (!repository) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Repository is required.');
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Buffer partial lines to avoid mid-word splits
  let lineBuffer = '';
  const flushLines = (force = false) => {
    const content = normalizeControl(lineBuffer);
    const parts = content.split('\n');
    // If not force, keep last partial segment in the buffer
    const lastIndex = force ? parts.length : Math.max(parts.length - 1, 0);
    for (let i = 0; i < lastIndex; i++) {
      const line = parts[i];
      if (line && line.length > 0) {
        res.write(`data: ${line}\n\n`);
      }
    }
    lineBuffer = force ? '' : (parts.length > 0 ? parts[parts.length - 1] : '');
  };
  const writeData = (text) => {
    lineBuffer += String(text || '');
    flushLines(false);
  };

  const writeEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    data.split(/\r?\n/).forEach((line) => res.write(`data: ${line}\n`));
    res.write('\n');
  };

  let closed = false;
  req.on('close', () => {
    closed = true;
    try { res.end(); } catch (_) {}
  });

  writeData('🚀 Starting modernization (stream mode)');

  try {
    const result = await runModernization(
      {
        repository,
        directory,
        folder,
        force: Boolean(force),
        dryRun: Boolean(dryRun),
      },
      {
        onMessage: (message) => {
          if (!closed) writeData(message);
        },
      },
    );

    // Flush any trailing content not ending with a newline
    if (!closed) flushLines(true);
    if (!closed) writeEvent('end', { success: true, result });
  } catch (error) {
    if (!closed) flushLines(true);
    if (!closed) writeEvent('end', { success: false, error: error.message });
  } finally {
    if (!closed) res.end();
  }
});

// Simple test endpoint
app.post('/api/test', async (req, res) => {
  const { repository, directory, folder } = req.body || {};

  if (!repository) {
    return res.status(400).json({ error: 'Repository is required.' });
  }

  const logMessages = [];
  
  try {
    const workspaceDir = path.resolve(directory || './workspaces');
    const folderName = folder || deriveFolderName(repository);
    const prompt = getSimplePrompt({ repoDir: folderName });
    
    const log = (message) => {
      const output = message.endsWith('\n') ? message : `${message}\n`;
      logMessages.push(normalizeControl(output));
    };

    log(`🧪 Testing with simple prompt...`);
    
    await fs.mkdir(workspaceDir, { recursive: true });
    
    // For file:// URLs, just copy the directory
    if (repository.startsWith('file://')) {
      const sourcePath = repository.replace('file://', '');
      const targetPath = path.join(workspaceDir, folderName);
      
      log(`📁 Copying ${sourcePath} to ${targetPath}`);
      await fs.cp(sourcePath, targetPath, { recursive: true });
    }
    
    log(`🤖 Running simple Q test in ${workspaceDir}`);
    
    const subprocess = execa('q', ['chat', '--no-interactive', '--trust-all-tools', prompt], {
      cwd: workspaceDir,
      stdio: 'pipe',
      timeout: 30000, // 30 second timeout for test
    });

    let output = '';
    subprocess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      log(text);
    });

    subprocess.stderr.on('data', (chunk) => {
      log(`stderr: ${chunk.toString()}`);
    });

    await subprocess;
    log(`✅ Test completed successfully`);
    
    return res.json({ 
      success: true, 
      log: logMessages.join(''),
      output: output
    });
    
  } catch (error) {
    const errorMessage = `Error: ${error.message}\n`;
    logMessages.push(errorMessage);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message, 
      log: logMessages.join('')
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get file content from workspace/repo folder
app.get('/api/file', async (req, res) => {
  try {
    const { directory = './workspaces', folder, name } = req.query || {};
    if (!folder || !name) {
      return res.status(400).json({ error: 'folder and name are required' });
    }
    const repoDir = path.resolve(directory, folder);
    const filePath = path.join(repoDir, name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = await fs.readFile(filePath, 'utf8');
    return res.json({
      name,
      path: filePath,
      size: stat.size,
      mtime: stat.mtimeMs,
      content,
    });
  } catch (error) {
    console.error('File read error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Stream file changes for specific markdown artifacts via SSE
app.get('/api/files-stream', async (req, res) => {
  const { directory = './workspaces', folder, names } = req.query || {};
  if (!folder) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('folder is required');
  }
  const namesSet = new Set(
    String(names || 'plan.md,review.md,changelog.md')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const repoDir = path.resolve(directory, folder);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const writeEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    data.split(/\r?\n/).forEach((line) => res.write(`data: ${line}\n`));
    res.write('\n');
  };

  let closed = false;
  req.on('close', () => {
    closed = true;
    try { res.end(); } catch (_) {}
  });

  // Helper to emit current status for a file
  const emitStatus = async (fileName) => {
    try {
      const filePath = path.join(repoDir, fileName);
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat) {
        writeEvent('artifact', {
          name: fileName,
          status: 'exists',
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      } else {
        writeEvent('artifact', {
          name: fileName,
          status: 'missing',
        });
      }
    } catch (e) {
      writeEvent('artifact', { name: fileName, status: 'error', error: e.message });
    }
  };

  // Initial snapshot
  for (const n of namesSet) {
    await emitStatus(n);
  }

  // Watch directory for changes, handling non-existent folder by polling
  let watcher;
  let pollInterval;
  const fsNative = require('fs');
  const tryWatch = async () => {
    if (closed) return;
    const exists = await fs.stat(repoDir).then(() => true).catch(() => false);
    if (!exists) {
      writeEvent('info', { message: 'Waiting for workspace folder...' });
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          const nowExists = await fs.stat(repoDir).then(() => true).catch(() => false);
          if (nowExists) {
            clearInterval(pollInterval);
            pollInterval = null;
            // Emit snapshot again
            for (const n of namesSet) {
              await emitStatus(n);
            }
            tryWatch();
          }
        }, 1000);
      }
      return;
    }

    try {
      watcher = fsNative.watch(repoDir, { persistent: true }, async (eventType, filename) => {
        if (closed || !filename) return;
        const fn = filename.toString ? filename.toString() : filename;
        if (!namesSet.has(fn)) return;
        // Debounced read
        setTimeout(() => emitStatus(fn), 50);
      });
      writeEvent('info', { message: 'Watching artifacts' });
    } catch (e) {
      writeEvent('error', { error: `Watcher error: ${e.message}` });
    }
  };

  tryWatch();

  // Heartbeat to keep connection alive
  const hb = setInterval(() => {
    if (!closed) res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    if (pollInterval) clearInterval(pollInterval);
    try { if (watcher) watcher.close(); } catch (_) {}
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🚀 Web UI available at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
});
