const promisify = require("promisify-node");
const fs = promisify('fs');

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

async function unlink(file) {
  try {
    return await fs.unlink(file);
  } catch(error) {
    // if file doesn't exist, it is OK
    if( error.code !== 'ENOENT' ) {
      throw error;
    }
  }
}

module.exports = exports = {
  writeFile: fs.writeFile,
  fileExists,
  unlink,
};
