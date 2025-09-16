function stripAnsi(input = '') {
  const str = String(input);
  // Regex adapted to remove ANSI escape sequences
  const ansiRegex = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return str.replace(ansiRegex, '');
}

function normalizeControl(input = '') {
  let str = String(input);
  // Convert carriage returns (used for progress updates) to newlines
  str = str.replace(/\r\n/g, '\n'); // CRLF -> LF
  str = str.replace(/\r/g, '\n'); // lone CR -> LF
  // Strip ANSI sequences
  str = stripAnsi(str);
  return str;
}

module.exports = {
  stripAnsi,
  normalizeControl,
};

