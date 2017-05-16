const { exec } = require('child_process');
const docker = require("./docker-bin");

module.exports = exports = {
  get: function get() {
    return new Promise((resolve, reject) => {
      exec(`${docker} ps -aq`, (error, stdout, stderr) => {
        if( error ) return reject(error);
        if( stderr ) return reject(stderr);
        resolve(stdout.split("\n").map(c => c.trim()).filter(c => !!c));
      });
    });
  },

  getRunning: function getRunning() {
    return new Promise((resolve, reject) => {
      exec(`${docker} ps -q`, (error, stdout, stderr) => {
        if( error ) return reject(error);
        if( stderr ) return reject(stderr);
        resolve(stdout.split("\n").map(c => c.trim()).filter(c => !!c));
      });
    });
  },

  inspect: function inspect(containers) {
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
  },
};

function argsTranspile(args) {
  return args.reduce((obj, arg) => {
    const [ key, value ] = arg.split('=');
    obj[key] = value;
    return obj;
  }, {});
}
