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

async function ensureClone(repository, workspaceDir, folderName, force) {
  const repoDir = path.join(workspaceDir, folderName);
  const exists = await pathExists(repoDir);

  if (exists) {
    if (force) {
      console.log(`Removing existing directory ${repoDir}`);
      await fs.rm(repoDir, { recursive: true, force: true });
    } else {
      console.log(`Reusing existing clone at ${repoDir}`);
      return repoDir;
    }
  }

  console.log(`Cloning ${repository} into ${repoDir}`);
  await execa('git', ['clone', repository, repoDir], { stdio: 'inherit' });
  return repoDir;
}

module.exports = (program) => {
  program
    .command('run', { isDefault: true })
    .description('Clone the repository into ./workspaces (by default) and run the Amazon Q CLI with the modernization prompt.')
    .requiredOption('-r, --repository <url>', 'Git repository to hand off to Amazon Q')
    .option('-d, --directory <path>', 'Workspace directory for cloning and running Amazon Q', './workspaces')
    .option('-f, --folder <name>', 'Folder name for the cloned repository')
    .option('--force', 'Overwrite the repository folder if it already exists')
    .option('--dry-run', 'Show the actions without executing git or Amazon Q')
    .action(async (options) => {
      const workspaceDir = path.resolve(options.directory || './workspaces');
      const folderName = options.folder || deriveFolderName(options.repository);
      const prompt = getPrompt({ repoDir: folderName });
      const args = ['chat', '--no-interactive', '--trust-all-tools', prompt];

      if (options.dryRun) {
        console.log(`Would create workspace at ${workspaceDir}`);
        console.log(`Would clone ${options.repository} into ${path.join(workspaceDir, folderName)}${options.force ? ' (force overwrite)' : ''}`);
        console.log(`Would run in ${workspaceDir}: q ${args.map((part) => (part.includes('\n') ? '"<prompt>"' : part)).join(' ')}`);
        return;
      }

      await fs.mkdir(workspaceDir, { recursive: true });
      const repoDir = await ensureClone(options.repository, workspaceDir, folderName, options.force);

      console.log(`Running Amazon Q in ${workspaceDir} targeting ${repoDir}`);
      await execa('q', args, {
        cwd: workspaceDir,
        stdio: 'inherit',
      });
    });
};
