const promisify = require("promisify-node");
const { exec } = promisify('child_process');
const path = require('path');
const fs = promisify('fs');
const { fileExists } = require('./fs');
const request = require('./docker-remote-api');
const docker = require('./docker-bin');
const config = require('./config');
const { promState } = require('./utils');
const containerName = 'hoster_certbot';

// docker run 
// --rm 
// -p "80:80" 
// -p "443:443" 
// -v "/docker/etc/letsencrypt:/etc/letsencrypt" 
// certbot/certbot 
// certonly 
// --standalone 
// -n 
// -d $site 
// -d example.com 
// --email info@example.com 
// --agree-tos;

// certbot certonly --webroot -w /var/www/example/ -d www.example.com -d example.com -w /var/www/other -d other.example.net -d another.other.example.net

function cleanupCertbotContainer() {
  return exec(`${docker} stop ${containerName}`)
  .then(() => exec(`${docker} rm ${containerName}`))
  .catch(error => {
    console.warn("Error when cleaning up certbot:", error);
  });
}

function certDir(main) {
  return path.join(config.certbot.certificates, 'live', main);
}

async function readDir(main) {
  try {
    const dir = certDir(main);

    const files = await fs.readdir(dir);

    return files
      .filter(f => path.parse(f).ext === '.pem')
      .reduce((obj, file) => {
        obj[file] = path.join(dir, file);
        return obj;
      }, {});

  } catch(e) {
    return {};
  }
} 

function renewCertificate({ domains, email, main = '' }) {
  return cleanupCertbotContainer()
  .then(() => {
    const command = [
      docker,
      'run',
      `--name ${containerName}`,
      '--rm',
      `-v "webroot-volume:${config.certbot.webroot}"`,
      '-v "certs-volume:/etc/letsencrypt"',
      'certbot/certbot',
      'certonly',
      '--webroot',
      '--agree-tos',
      `--email ${email}`,
      '--non-interactive',
      `-w ${config.certbot.webroot}`,
    ];

    // let main domain be the first, 
    // so the name of the certificate is of the main domain
    if( main && domains.includes(main) ) {
      command.push(`-d ${main}`);
      domains.filter(d => d !== main).forEach(d => command.push(`-d ${d}`));
    } else {
      domains.forEach(d => command.push(`-d ${d}`));
    }

    console.log("Certbot executed:", command);
    return exec(command.join(' '))
    .then((stdout, stderr) => {
      if( stderr ) throw new Error(stderr);
      return stdout;
    });
  })
  // cleanup container if it is running
  .catch(error => {
    return cleanupCertbotContainer()
    .then(() => {
      console.error('Certbot error:', error);
      throw error;
    })
  })
  .then(() => {
    return readDir(main);
  });
}

const domainQueue = {};
let isBusy = false;

/**
 * Enqueue a new or existing domain
 * Returns the resolved result or null when promise isn't resolved yet
 */
async function enqueue(data) {
  const domainStr = data.domains.join(',');
  const queueObj = domainQueue[domainStr] = Object.assign(domainQueue[domainStr] || {}, data);
  
  // return the contents of the certificate dir if it exists
  const exists = await fileExists(certDir(data.main));

  if( exists ) {
    return await readDir(data.main);
  }

  if( queueObj.promise && queueObj.promise.isResolved() ) {
    return await queueObj.promise;
  }

  run();

  return null;
}

/**
 * Loop function
 * Creates and runs next promise
 */
function run() {
  if( isBusy ) return;

  const notDone = Object.keys(domainQueue)
    .map(k => domainQueue[k]) // get values
    .filter(q => !q.promise || q.isRejected()); // return all not having a promise, or the promise is rejected

  if( notDone.length && !isBusy ) {
    isBusy = true;

    const data = notDone[Math.floor(Math.random() * notDone.length)];

    data.promise = promState(renewCertificate(data));

    data.promise.catch(() => {}).then(() => { isBusy = false; run(); });
  }
}

run();

module.exports = exports = {
  enqueue,
};
