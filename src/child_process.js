const { exec, spawn } = require('child_process');

function execPromise(...args) {
  return new Promise((resolve, reject) => {
    exec(...args, (error, stdout, stderr) => {
      return error ? reject(error) : resolve({ stdout, stderr });
    })
  });
}

module.exports = exports = {
  exec: execPromise,
};
