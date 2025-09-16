const path = require('path');
const fs = require('fs/promises');
const execa = require('execa');
const { getPrompt } = require('../prompt');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function deriveFolderName(repository) {
  const sanitized = repository.split('/').pop() || repository;
  return sanitized.replace(/\.git$/i, '') || 'repository';
}

function attachProcessListeners(subprocess, onMessage) {
  if (!subprocess || !onMessage) {
    return;
  }

  if (subprocess.stdout) {
    subprocess.stdout.on('data', (chunk) => {
      onMessage(chunk.toString());
    });
  }

  if (subprocess.stderr) {
    subprocess.stderr.on('data', (chunk) => {
      onMessage(chunk.toString());
    });
  }
}

async function ensureClone(repository, workspaceDir, folderName, force, onMessage) {
  const repoDir = path.join(workspaceDir, folderName);
  const exists = await pathExists(repoDir);

  const log = (message) => {
    const line = `${message}\n`;
    if (onMessage) {
      onMessage(line);
    }
  };

  if (exists) {
    if (force) {
      log(`🗑️  Removing existing directory ${repoDir}`);
      await fs.rm(repoDir, { recursive: true, force: true });
    } else {
      log(`♻️  Reusing existing clone at ${repoDir}`);
      return repoDir;
    }
  }

  log(`📥 Cloning ${repository} into ${repoDir}`);
  try {
    const cloneProcess = execa('git', ['clone', repository, repoDir], {
      stdio: 'pipe'
    });
    
    if (onMessage) {
      attachProcessListeners(cloneProcess, onMessage);
    }
    
    await cloneProcess;
    log(`✅ Clone completed successfully`);
  } catch (error) {
    log(`❌ Clone failed: ${error.message}`);
    throw error;
  }
  
  return repoDir;
}

async function runModernization(options, hooks = {}) {
  const {
    repository,
    directory = './workspaces',
    folder,
    force = false,
    dryRun = false,
  } = options;

  const { onMessage } = hooks;

  if (!repository) {
    throw new Error('Repository is required to run modernization.');
  }

  const workspaceDir = path.resolve(directory || './workspaces');
  const folderName = folder || deriveFolderName(repository);
  const prompt = getPrompt({ repoDir: folderName });

  const log = (message) => {
    const output = message.endsWith('\n') ? message : `${message}\n`;
    if (onMessage) {
      onMessage(output);
    }
  };

  if (dryRun) {
    log(`🔍 DRY RUN MODE - No actual changes will be made`);
    log(`📁 Would create workspace at ${workspaceDir}`);
    log(`📥 Would clone ${repository} into ${path.join(workspaceDir, folderName)}${force ? ' (force overwrite)' : ''}`);
    log(`🤖 Would run Amazon Q in ${workspaceDir}`);
    log(`✨ Dry run completed - ready for actual execution`);
    
    return {
      workspaceDir,
      folderName,
      prompt,
      repoDir: path.join(workspaceDir, folderName),
      dryRun: true,
    };
  }

  log(`🚀 Starting modernization process...`);
  
  try {
    await fs.mkdir(workspaceDir, { recursive: true });
    const repoDir = await ensureClone(repository, workspaceDir, folderName, force, onMessage);
    
    log(`🤖 Running Amazon Q in ${workspaceDir} targeting ${repoDir}`);
    log(`⏳ This may take several minutes...`);
    
    const args = ['chat', '--no-interactive', '--trust-all-tools', prompt];
    
    // Check if Q CLI is available
    try {
      await execa('q', ['--version'], { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Amazon Q CLI not found. Please install Q CLI first.');
    }
    
    const subprocess = execa('q', args, {
      cwd: workspaceDir,
      stdio: 'pipe',
      timeout: 3600000, // 1 hour timeout
    });

    if (onMessage) {
      attachProcessListeners(subprocess, onMessage);
    }

    await subprocess;
    log(`✅ Amazon Q modernization completed successfully`);
    
  } catch (error) {
    if (error.timedOut) {
      log(`⏰ Process timed out after 5 minutes`);
    } else {
      log(`❌ Process failed: ${error.message}`);
    }
    throw error;
  }

  return {
    workspaceDir,
    repoDir: path.join(workspaceDir, folderName),
    folderName,
    prompt,
    dryRun: false,
  };
}

module.exports = {
  deriveFolderName,
  runModernization,
};
