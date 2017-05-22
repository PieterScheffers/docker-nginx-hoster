const crypto = require('crypto');

function logObject(object, name = '') {
  if( name ) return console.log(name + ' =', JSON.stringify(object, null, 2));
  console.log(JSON.stringify(object, null, 2));
}

function isDefined(variable) {
  return typeof variable !== 'undefined' && variable !== null;
}

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

function randomString(length = 10) {
  return crypto.randomBytes(length).toString('hex');
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

function promState(promise) {
    // Don't create a wrapper for promises that can already be queried.
    if (promise.isResolved) return promise;

    let isResolved = false;
    let isRejected = false;

    // Observe the promise, saving the fulfillment in a closure scope.
    let result = promise.then(
       function(v) { isResolved = true; return v; }, 
       function(e) { isRejected = true; throw e; }
    );
    result.isFulfilled = function() { return isResolved || isRejected; };
    result.isResolved = function() { return isResolved; }
    result.isRejected = function() { return isRejected; }

    return result;
}

module.exports = exports = {
  logObject,
  isDefined,
  isDef: isDefined,
  throttle,
  randomString,
  delay,
  promState,
};