function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
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

module.exports = exports = {
  escapeRegExp,
  compile,
  replace,
  conditional,
};
