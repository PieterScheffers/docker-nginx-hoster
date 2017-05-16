function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function compile(str, braces = [ '{', '}' ]) {
  return function(replacements) {
    return replace(str, replacements, braces);
  };
}
exports.compile = compile;

function replace(str, replacements, braces = [ '{', '}' ]) {
  // if an object is given, rewrite is to an array [ { key: 'key', value: 'value' } ]
  if( !Array.isArray(replacements) ) {
    replacements = Object.keys(replacements).map(key => ({ key, value: replacements[key] }));
  }

  return replacements.reduce((str, repl) => {
    return str.replace(new RegExp(escapeRegExp(`${braces[0]}${repl.key}${braces[1]}`), 'g'), repl.value);
  }, str);
}
exports.replace = replace;
