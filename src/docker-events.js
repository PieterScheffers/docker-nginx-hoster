const { spawn } = require('child_process');
const EventEmitter = require('events');
const docker = require("./docker-bin");
const { toSmallHash } = require('./docker-containers');

class DockerEventsEmitter extends EventEmitter {
  constructor(...args) {
    super(...args);
    this.ended = false;
    this.deProc = null;
    this.data = "";

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
      this.data += data.toString();

      const dataParts = this.data.split("\n");
      this.data = dataParts.pop();

      dataParts.forEach(dp => {
        const [ parts, infoStr ] = dp.split('(');
        const [ timestamp, part, action, longHash ] = parts.split(' ');

        let info = {
          date: new Date(timestamp),
          part,
          action,
          hash: longHash ? toSmallHash(longHash) : ''
        };

        if( infoStr ) {
          info = infoStr.replace(')', '')
            .split(', ')
            .reduce((obj, i) => {
              const [ key, value ] = i.split('=');
              obj[key] = value;
              return obj;
            }, info)
        }

        this.emit(`${part}_${action}`, info);
        this.emit(part, info);
        this.emit('all', info);
      });
    });

    this.deProc.stderr.on('data', (data) => {
      this.emit('error', data);
    });

    this.deProc.once('close', (code) => {
      if( this.ended === false ) {
        this.deProc = null;
        this.data = "";
      }
    });
  }

  stop() {
    this.ended = true;
    this.deProc.stdin.end();

    this.deProc.once('close', (code) => {
      this.deProc = null;
      this.ended = false;
      this.data = "";
    });
  }
}

let de;

function listen() {
  if( de ) return de;

  de = new DockerEventsEmitter();
  return de;
}

module.exports = listen;
