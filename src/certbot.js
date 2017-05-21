// docker run
// -v "/docker-nginx-hoster/data/certbot/var_lib_letsencrypt:/var/lib/letsencrypt"
// -v "/docker-nginx-hoster/data/certbot/etc_letsencrypt:/etc/letsencrypt"
// certbot/certbot
// certonly
// --webroot
// -w /var/lib/letsencrypt
// -d www.example.com
// -d example.com
// --agree-tos
// -m "henkie@example.com"
// --non-interactive

// console.log(encodeURIComponent('certonly --webroot -w /var/lib/letsencrypt -d www.example.com -d example.com --agree-tos -m "henkie@example.com" --non-interactive'))

const schedule = require('node-schedule');
const path = require('path');
const config = require('./config');
const letsencrypt = require('letsencrypt');
const leStore = require('le-store-certbot');
const leChallenge = require('le-challenge-fs');

let le;

function setup() {
  if( le ) return le;

  // Storage Backend 
  const store = leStore.create({
    configDir: '~/letsencrypt/etc'                   // or /etc/letsencrypt or wherever 
  , debug: false
  });
      
  console.log("WEBROOT", path.join(config.certbot.webroot, '.well-known/acme-challenge'))
  // ACME Challenge Handlers 
  const challenge = leChallenge.create({
    webrootPath: path.join(config.certbot.webroot, '.well-known/acme-challenge'), // or template string such as 
    debug: false                                                                  // '/srv/www/:hostname/.well-known/acme-challenge' 
  });

  console.log('challenge', challenge.loopback)

  le = letsencrypt.create({
    server: letsencrypt.stagingServerUrl             // or letsencrypt.productionServerUrl 
  , store                                            // handles saving of config, accounts, and certificates 
  , challenges: { 'http-01': challenge }             // handles /.well-known/acme-challege keys and tokens 
  , challengeType: 'http-01'                         // default to this challenge type 
  , agreeToTerms: function agree(opts, agreeCb)   {  // hook to allow user to view and accept letsencrypt TOS 
      // opts = { email, domains, tosUrl } 
      agreeCb(null, opts.tosUrl);
    }
  //, sni: require('le-sni-auto').create({})         // handles sni callback 
  , debug: false
  , log: (...args) => console.log.apply(console, args) // handles debug outputs 
  });

  return le;
}

async function renewCertificate(domains, email) {
  try {
    const le = setup();

    // If using express you should use the middleware 
    // app.use('/', le.middleware()); 
    // 
    // Otherwise you should see the test file for usage of this: 
    // le.challenges['http-01'].get(opts.domain, key, val, done) 
     
    // Check in-memory cache of certificates for the named domain 
    let results = await le.check({ domains });

    if (results) {
      // we already have certificates 
      return results;
    }
     
    // Register Certificate manually 
    results = await le.register({
      domains,                    // CHANGE TO YOUR DOMAIN (list for SANS) ['example.com']
      email,                      // CHANGE TO YOUR EMAIL 'user@email.com'
      agreeTos: true,             // set to tosUrl string (or true) to pre-approve (and skip agreeToTerms) 
      rsaKeySize: 2048,           // 2048 or higher 
      challengeType: 'http-01',   // http-01, tls-sni-01, or dns-01 
    });

    return results;
  } catch(error) {
    console.error("Error getting certificates from letsencrypt:", error);
    throw error;
  }
}

module.exports = exports = {
  renewCertificate,
};
