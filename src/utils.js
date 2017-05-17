function logObject(object, name = '') {
  if( name ) return console.log(name + ' =', JSON.stringify(object, null, 2));
  console.log(JSON.stringify(object, null, 2));
}
exports.logObject = logObject;
