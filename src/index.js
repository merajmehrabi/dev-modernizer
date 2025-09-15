const { Command } = require('commander');
const packageJson = require('../package.json');
const registerPromptCommand = require('./commands/prompt');
const registerRunCommand = require('./commands/run');
const { getPrompt } = require('./prompt');

const program = new Command();

program
  .name('aq-modernize')
  .description('Helper CLI for running Amazon Q modernization workflows with a prebuilt prompt.')
  .version(packageJson.version);

registerPromptCommand(program);
registerRunCommand(program);

program
  .command('print')
  .description('Alias for prompt command.')
  .option('--repo-dir <relativePath>', 'Relative directory of the repository to mention in the prompt')
  .action((options) => {
    process.stdout.write(`${getPrompt({ repoDir: options.repoDir })}\n`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
