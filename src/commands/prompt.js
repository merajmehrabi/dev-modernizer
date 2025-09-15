const { getPrompt } = require('../prompt');

module.exports = (program) => {
  program
    .command('prompt')
    .description('Print the Amazon Q modernization prompt to stdout.')
    .option('--repo-dir <relativePath>', 'Relative directory of the repository to mention in the prompt')
    .action((options) => {
      process.stdout.write(`${getPrompt({ repoDir: options.repoDir })}\n`);
    });
};
