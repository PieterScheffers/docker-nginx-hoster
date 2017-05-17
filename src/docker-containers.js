const { exec } = require('child_process');
const docker = require("./docker-bin");

function get() {
  return new Promise((resolve, reject) => {
    exec(`${docker} ps -aq`, (error, stdout, stderr) => {
      if( error ) return reject(error);
      if( stderr ) return reject(stderr);
      resolve(stdout.split("\n").map(c => c.trim()).filter(c => !!c));
    });
  });
}

function getRunning() {
  return new Promise((resolve, reject) => {
    exec(`${docker} ps -q`, (error, stdout, stderr) => {
      if( error ) return reject(error);
      if( stderr ) return reject(stderr);
      resolve(stdout.split("\n").map(c => c.trim()).filter(c => !!c));
    });
  });
}

function inspect(containers) {
  return new Promise((resolve, reject) => {
    if( !Array.isArray(containers) ) containers = [ containers ];

    exec(`${docker} inspect ${containers.join(' ')}`, (error, stdout, stderr) => {
      if( error ) return reject(error);
      if( stderr ) return reject(stderr);
      const inspections = JSON.parse(stdout);

      // rewrite Args
      inspections.forEach((inspection, i) => {
        if( inspection.Config
          && inspection.Config.Env ) {
          inspections[i].Config.Env = argsTranspile(inspection.Config.Env);
        }
      });

      resolve(inspections);
    });
  });
}

function argsTranspile(args) {
  return args.reduce((obj, arg) => {
    const [ key, value ] = arg.split('=');
    obj[key] = value;
    return obj;
  }, {});
}

function toSmallHash(hash) {
  return hash.substring(0, 12);
}

function getHostName(inspection) {
  return inspection.Name.replace('/', '');
}


module.exports = exports = {
  get,
  getRunning,
  inspect,
  argsTranspile,
  toSmallHash,
  getHostName,
};
