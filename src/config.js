module.exports = {
  certbot: {
    webroot: '/etc/nginx/letsencrypt/webroot',
    certificates: '/etc/nginx/certs',
  },
  ssl: {
    dhparam: '/etc/nginx/certs/dhparam.pem',
    dhparamSmall: '/etc/nginx/certs/dhparam-small.pem',
    cert: '/etc/nginx/certs/self-signed-cert.pem',
    key: '/etc/nginx/certs/self-signed-key.pem',
  },
};
