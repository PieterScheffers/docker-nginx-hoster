// docker run -v "/docker-nginx-hoster/data/certbot/var_lib_letsencrypt:/var/lib/letsencrypt" -v "/docker-nginx-hoster/data/certbot/etc_letsencrypt:/etc/letsencrypt" certbot/certbot certonly --webroot -w /var/lib/letsencrypt -d www.example.com -d example.com --agree-tos -m "henkie@example.com" --non-interactive
// 
// console.log(encodeURIComponent('certonly --webroot -w /var/lib/letsencrypt -d www.example.com -d example.com --agree-tos -m "henkie@example.com" --non-interactive'))

const schedule = require('node-schedule');

function renewCertificate(domains, email) {

}

