const fs = require('fs');

function writeFile(...args) {
  return new Promise((resolve, reject) => {
    fs.writeFile(...args, (err) => {
      return err ? reject(err) : resolve(args[0]);
    });
  });
}
exports.writeFile = writeFile;
