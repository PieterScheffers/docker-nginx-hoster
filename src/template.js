function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function regexIndexOf(str, regex, startpos = 0) {
  var indexOf = str.substring(startpos).search(regex);
  return (indexOf >= 0) ? (indexOf + startpos) : indexOf;
}

function removeLastIndentation(str) {
  return str.substring(0, str.lastIndexOf("\n") + "\n".length);
}

function compile(str, braces = [ '{', '}' ]) {
  return function(replacements) {
    return replace(str, replacements, braces);
  };
}

/**
 * Replace all occurrences of with a value
 */
function replace(str, replacements, braces = [ '{', '}' ]) {
  // if an object is given, rewrite is to an array [ { key: 'key', value: 'value' } ]
  if( !Array.isArray(replacements) ) {
    replacements = Object.keys(replacements).map(key => ({ key, value: replacements[key] }));
  }

  return replacements.reduce((str, repl) => {
    return str.replace(new RegExp(escapeRegExp(`${braces[0]}${repl.key}${braces[1]}`), 'g'), repl.value);
  }, str);
}

/**
 * Remove all pieces between conditionals if false
 * Remove all conditionals if true
 * TODO: allow nesting of the same condition
 */
function conditional(str, condition, bool, braces = [ '{', '}' ]) {
  const startTag = `${braces[0]}${condition}${braces[1]}`;
  const endTag = `${braces[0]}/${condition}${braces[1]}`;
  let start = 0;
  let end = 0;

  if(!bool) {
    start = str.indexOf(startTag);
    end = str.indexOf(endTag) + endTag.length;

    while(start !== -1 && end !== -1) {
      str = str.substring(0, start) + str.substring(end);

      start = str.indexOf(startTag);
      end = str.indexOf(endTag) + endTag.length;
    }
  }

  // remove the tags
  str = replace(str, [{ key: `/${condition}`, value: '' }], braces);
  return replace(str, [{ key: condition, value: '' }], braces);
}

/**
 * Run first loop in a string
 * - Can not be nested
 * - Loop statements should be on it own line
 */
function runLoop(str, braces = [ '{', '}' ]) {
  let start = 0;
  let startEnd = 0;
  let end = 0;

  // loop has double braces, to allow insertion of variables
  const startTagStart = `${braces[0]}${braces[0]}loop:`;
  const startTagEnd = `${braces[1]}${braces[1]}\n`;
  const endTag = `${braces[0]}${braces[0]}/loop${braces[1]}${braces[1]}\n`;

  // find start
  start = str.indexOf(startTagStart);

  if(start !== -1) {
    // find ending of start and the end tag
    startEnd = str.indexOf(startTagEnd, start + startTagStart.length);
    end = str.indexOf(endTag, startEnd + startTagEnd.length);

    // get the values from the start tag
    const values = str.substring(start + startTagStart.length, startEnd).split(' ').filter(v => !!v);

    // get the content between the startend- and end-tag
    const content = removeLastIndentation(str.substring(startEnd + startTagEnd.length, end));

    // get string till loop
    const beginStr = removeLastIndentation(str.substring(0, start));

    // get string after loop
    const endStr = str.substring(end + endTag.length);

    // return string before + looped content + string after
    return (
      beginStr +
      values.map(v => replace(content, { i: v })).join('') +
      endStr
    );
  }

  return str;
}

/**
 * Run the loops till there are no loops left
 */
function runLoops(str, braces = [ '{', '}' ]) {
  let newStr;
  newStr = runLoop(str, braces);

  let safety = 0;

  while(newStr !== str && safety < 5) {
    safety += 1;
    str = newStr;
    newStr = runLoop(str, braces);
  }

  return newStr;
}

module.exports = exports = {
  escapeRegExp,
  compile,
  replace,
  conditional,
  runLoops,
};
