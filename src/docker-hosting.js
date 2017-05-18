// /etc/nginx/conf.d
// /etc/nginx/certs

const fs = require('fs');
const path = require('path');
const { inspect, getRunning, toSmallHash, getHostName } = require('./docker-containers');
const { logObject, throttle, randomString } = require('./utils');
const dockerEvents = require('./docker-events');
const { replace } = require('./template');
const defaultTemplate = fs.readFileSync(path.join(__dirname, 'default-template.conf'));
const acmeChallengeTemplate = fs.readFileSync(path.join(__dirname, 'conf', 'snippets', 'certbot-acme-challenge.conf'));

async function getDomains(inspections) {

  // get inspect results from containers with valid environment variables
  inspections = inspections.filter(i => !!i.Config.Env.NG_PR_DOMAIN && !!i.Config.Env.NG_PR_PORT && !!i.Config.Env.NG_PR_EMAIL);

  const doneDomains = [];

  // get info from inspect result
  const domainInfo = inspections.map(i => ({
    // get the domains
    // sort, to make 'www.example.com,example.com' and 'example.com,www.example.com' the same
    domains: i.Config.Env.NG_PR_DOMAIN.split(',').map(d => d.trim()).sort(),
    email: i.Config.Env.NG_PR_EMAIL,
    template: i.Config.Env.NG_PR_TEMPLATE,
    host: getHostName(i),
    port: i.Config.Env.NG_PR_PORT,
  }))
  // group hosts per domain group
  .reduce((obj, info) => {
    const { domains, email, template, host, port } = info;
    const domainsStr = domains.join(',');

    // add host to domain
    if( typeof obj[domainsStr] !== 'undefined' ) {
      obj[domainsStr].hosts.push({ host, port });

      if( !obj[domainsStr].template && template ) {
        obj[domainsStr].template = template;
      }

      if( !obj[domainsStr].email && email ) {
        obj[domainsStr].email = email;
      }

      return obj;
    }

    // check if domains are doubly mapped
    for (let i = 0; i < domains.length; i++) {
      if( doneDomains.includes(domains[i]) ) {
        console.warn(`Domain ${domains[i]} already mapped`);
        return obj;
      }

      doneDomains.push(domains[i]);
    }

    // create domain key
    obj[domainsStr] = [{
      domains,
      email,
      template,
      hosts: [ { host, port } ]
    }];

    return obj;
  }, {});

  logObject(domainInfo, 'domainInfo');

  return domainInfo;
}
exports.getDomains = getDomains;

async function writeConfigs(domainsInfo) {

  Object.keys(domainsInfo).forEach(key => {
    let { hosts, domains, template, email } = domainsInfo[key];

    if( !template ) {
      template = defaultTemplate;
    }

    const NG_PR_PROXY_PASS = randomString(20);
    const NG_PR_UPSTREAM = hosts.reduce((str, { host, port }) => str + `    server ${host}:${port}\n`, `upstream ${NG_PR_PROXY_PASS} {\n`) +  "}\n";

  /*
   * NG_PR_DOMAINS = spaces separated domain names
   * NG_PR_1_PORT
   * NG_PR_1_HOST
   * NG_PR_EMAIL
   * NG_PR_UPSTREAM
   * NG_PR_DHPARAM
   * NG_PR_TRUSTED_CERTIFICATE
   * NG_PR_SSL_CERTIFICATE
   * NG_PR_SSL_CERTIFICATE_KEY
   */
    const replacements = Object.assign(
      hosts.reduce((obj, { host, port }, i) => {
        obj[`NG_PR_${i}_PORT`] = port;
        obj[`NG_PR_${i}_HOST`] = host;
        return obj;
      }, {}),
      {
        NG_PR_DOMAINS: domains.join(' '),
        NG_PR_UPSTREAM,
        NG_PR_PROXY_PASS,
        NG_PR_EMAIL: email,
        NG_PR_DHPARAM: '',
        NG_PR_TRUSTED_CERTIFICATE: '',
        NG_PR_SSL_CERTIFICATE: '',
        NG_PR_SSL_CERTIFICATE_KEY: '',
      }
    );

    const config = replace(template, replacements);

    logObject(config, 'config');
  });

  // TODO: write configs!
  // each domain
  //   write config
  //     include of .well-known (https://community.letsencrypt.org/t/how-to-nginx-configuration-to-enable-acme-challenge-support-on-all-http-virtual-hosts/5622/8)
  //     http to https redirect
  //     use self-signed certificate when letsencrypt certificate isn't available yet
  //     
  //   get ssl certificate locations
  //    (get ssl certificate) https://certbot.eff.org/docs/using.html?highlight=nginx#webroot
  //    (schedule ssl certificate renewal)
  //  
  //  nginx config: /etc/nginx/conf.d/example.com.conf
  //  certificates: /etc/nginx/certs/example.com.d/
  //  certificate-symlinks: /etc/nginx/certs/example.com.crt
  //                        /etc/nginx/certs/example.com.key
  //   
  //   
}

async function refreshConfigs() {
  const containers = await getRunning();
  const inspections = await inspect(containers);

  const domains = await getDomains(inspections);

  await writeConfigs(domains);
}
exports.refreshConfigs = refreshConfigs;

// create a throttled hander,
// to refresh configs every 30 seconds max
const handler = throttle(refreshConfigs, 30000);

function createListener() {
  let de;
  let handlerWrapper;

  return {
    start: function start() {
      // listen to docker events
      de = dockerEvents();

      handlerWrapper = function() {
        handler();
      };

      // on each event run throttled handler
      de.on('all', handlerWrapper);
    },

    stop: function stop() {
      de.removeListener('all', handlerWrapper);
      handlerWrapper = null;
      de = null;
    },
  };
}

exports.createListener = createListener;
