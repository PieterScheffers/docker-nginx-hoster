const { exec } = require('child_process');
const request = require('./docker-remote-api');
const docker = require('./docker-bin');
const config = require('./config');

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

function renewCertificate(domains, email) {
  return new Promise((resolve, reject) => {
    const command = [
      docker,
      'run',
      '--rm',
      '-v "webroot-volume:/usr/share/nginx/html"', 
      '-v "certs-volume:/etc/letsencrypt"',
      'certbot/certbot',
      'certonly',
      '--webroot',
      '--agree-tos',
      `--email ${email}`,
      `-w /usr/share/nginx/html`,
    ];

    domains.forEach(d => command.push(`-d ${d}`));

    exec(command.join(' '), (error, stdout, stderr) => {
      if( error ) return reject(error);
      if( stderr ) return reject(stderr);
      resolve(stdout);
    });
  });
}

module.exports = exports = {
  renewCertificate,
};
