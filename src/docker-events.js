const { spawn } = require('child_process');
const EventEmitter = require('events');
const docker = require("./docker-bin");

class DockerEventsEmitter extends EventEmitter {
  constructor(...args) {
    super(...args);
    this.ended = false;
    this.deProc = null;

    this.start();
  }

  start() {
    this.ended = false;

    if( this.deProc !== null ) {
      console.warn("'docker events' already running");
      return;
    }

    if( this.ended === true ) {
      console.warn("'docker events' is closing");
      return;
    }

    this.deProc = spawn(docker, [ 'events' ]);

    this.deProc.stdout.on('data', data => {
      const [ timestamp, part, subpart, hash ] = data.toString().split(' ');
      this.emit(`${part}_${subpart}`, hash);
      this.emit(part, subpart, hash);
    });

    this.deProc.once('close', (code) => {
      if( this.ended === false ) {
        this.deProc = null;
      }
    });
  }

  stop() {
    this.ended = true;
    this.deProc.stdin.end();

    this.deProc.once('close', (code) => {
      this.deProc = null;
      this.ended = false;
    });
  }
}

let de;

function listen() {
  if( de ) return de;

  de = new DockerEventsEmitter();
  return de;
}


// function listen() {
//   if( de ) return de;

//   de = new DockerEventsEmitter();

//   de = spawn(docker, [ 'events' ]);

//   de.stdout.on('data', data => {
//     console.log(`stdout: ${data}`);
//   });

//   de.stderr.on('data', (data) => {
//     console.log(`stderr: ${data}`);
//   });

//   de.on('close', (code) => {
//     console.log(`child process exited with code ${code}`);
//   });

//   return de;
// }

module.exports = listen;

// de.stdin.end();
