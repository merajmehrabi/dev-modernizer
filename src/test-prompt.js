exports.getSimplePrompt = ({ repoDir } = {}) => {
  const instruction = repoDir ? `Analyze the repository at "./${repoDir}"` : 'Analyze the current directory';
  
  return `${instruction}. List the main files and suggest 2 quick improvements. Be very concise.`;
};
