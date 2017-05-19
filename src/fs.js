const promisify = require("promisify-node");
const fs = promisify('fs');

exports.writeFile = fs.writeFile;

async function fileExists(file, minSize = 10) {
  try {

    const [ stats ] = await Promise.all([
      fs.stat(file),
      fs.access(file, fs.constants.R_OK)
    ]);

    if( stats.size < minSize ) {
      return false;
    }

    return true;

  } catch(error) {

    if( error.code === 'ENOENT' ) {
      return false;
    }

    throw error;
  }
}

exports.fileExists = fileExists;
