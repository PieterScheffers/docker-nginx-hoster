const crypto = require('crypto');

function logObject(object, name = '') {
  if( name ) return console.log(name + ' =', JSON.stringify(object, null, 2));
  console.log(JSON.stringify(object, null, 2));
}
exports.logObject = logObject;

function isDefined(variable) {
  return typeof variable !== 'undefined' && variable !== null;
}
exports.isDefined = isDefined;
exports.isDef = isDefined;

function throttle(fn, threshhold = 250, scope) {
  let last;
  let deferTimer;

  return function() {
    let context = scope || this;

    let now = +new Date;
    let args = arguments;

    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function() {
        last = now;
        fn.apply(context, args);
      }, threshhold);

    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}
exports.throttle = throttle;

function randomString(length = 10) {
  return crypto.randomBytes(length).toString('hex');
}
exports.randomString = randomString;

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}
exports.delay = delay;
