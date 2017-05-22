const { exec } = require('child_process');
const docker = require("./docker-bin");
const request = require('./docker-remote-api');

// https://docs.docker.com/engine/api/v1.29/#tag/Container
// http://stackoverflow.com/questions/30775628/docker-how-to-send-a-signal-from-one-running-container-to-another-one
// https://github.com/mafintosh/docker-remote-api

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

function sendSignal(container, signal = 'HUP') {
  return new Promise((resolve, reject) => {
    request.post(`/containers/${container}/kill?signal=${signal}`, { json: true }, (err, json) => {
      console.log("err", err, 'json', json);
      if(err) return reject(err);
      resolve(json);
    })

  })
}

function sendHupSignal(container) {
  return new Promise((resolve, reject) => {
    exec(`${docker} kill -s HUP ${container}`, (error, stdout, stderr) => {
      if( error ) return reject(error);
      if( stderr ) return reject(stderr);
      resolve(stdout);
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
  sendSignal,
  sendHupSignal,
};
