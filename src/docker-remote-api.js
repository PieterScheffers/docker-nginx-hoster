const dockerRemoteApi = require('docker-remote-api')

const request = dockerRemoteApi({
  host: process.env.docker ? process.env.docker : '/var/run/docker.sock'
});

module.exports = request;
