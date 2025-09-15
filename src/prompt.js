const defaultInstruction = 'Analyze the cloned repository in the current working directory.';

function buildInstruction(repoDir) {
  if (!repoDir || repoDir === '.' || repoDir === './') {
    return defaultInstruction;
  }

  const normalized = repoDir.startsWith('./') ? repoDir : `./${repoDir}`;
  return `Analyze the repository located at "${normalized}" relative to the current working directory (typically ./workspaces). Change into that directory before running tools.`;
}

exports.getPrompt = ({ repoDir } = {}) => {
  const instruction = buildInstruction(repoDir);

  return `You are assisting with repository analysis and modernization.

Task:
1. ${instruction}
2. Perform the following checks:
   - Identify deprecated, vulnerable, or outdated dependencies.
   - Detect potential code quality issues and smells.
   - Highlight weak points in application architecture or design.
   - Note testing coverage gaps or missing best practices.
3. Produce a report in **Markdown** format named \`review.md\` containing:
   - A summary of the overall health of the project.
   - Detailed issues with examples (dependencies, code, architecture).
   - Risks or potential problems during maintenance or scaling.
4. Produce an actionable modernization roadmap in **Markdown** format named \`plan.md\`:
   - Step-by-step instructions to fix identified issues.
   - Dependency upgrade and replacement strategy.
   - Suggested tooling or framework modernization.
   - Architectural improvements with reasoning.
5. Execute the roadmap iteratively:
   - Apply changes step by step.
   - After each step, verify that the project builds and runs.
   - Stop any lingering processes when checks are complete.
   - Commit each change to a dedicated branch named \`modernization\`.
   - Update **\`changelog.md\`** with a description of what was changed and why.
6. Continue until the entire plan is implemented.

Output Requirements:
- Use clear, structured **Markdown** for \`review.md\` and \`plan.md\`.
- Write concise and descriptive **git commit messages**.
- Update \`changelog.md\` incrementally with every applied change.
- Confirm at the end that the repository runs successfully and is modernized.`;
};
