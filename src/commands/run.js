const { runModernization } = require('../services/modernizer');

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
      try {
        await runModernization(
          {
            repository: options.repository,
            directory: options.directory,
            folder: options.folder,
            force: Boolean(options.force),
            dryRun: Boolean(options.dryRun),
          },
          {
            onMessage: (message) => {
              // Stream logs directly to the console for real-time monitoring
              process.stdout.write(message);
            },
          },
        );
      } catch (error) {
        // Ensure errors are visible in CLI usage
        process.stderr.write(`\nError: ${error.message}\n`);
        process.exitCode = 1;
      }
    });
};
