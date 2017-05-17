// /etc/nginx/conf.d
// /etc/nginx/certs

const { inspect, getRunning, toSmallHash, getHostName } = require('./docker-containers');
const { logObject } = require('./utils');

async function getDomains() {
  const containers = await getRunning();

  // get inspect results from containers with valid environment variables
  const inspections = (await inspect(containers))
    .filter(i => !!i.Config.Env.NG_PR_DOMAIN && !!i.Config.Env.NG_PR_PORT && !!i.Config.Env.NG_PR_EMAIL);

  const doneDomains = [];

  // get info from inspect result
  const domains = inspections.map(i => ({
    domains: i.Config.Env.NG_PR_DOMAIN.split(',').map(d => d.trim()).sort(),
    port: i.Config.Env.NG_PR_PORT,
    email: i.Config.Env.NG_PR_EMAIL,
    host: getHostName(i),
    template: i.Config.Env.NG_PR_TEMPLATE,
  }))
  // group hosts per domain group
  .reduce((obj, info) => {
    const { domains } = info;
    const domainsStr = domains.join(',');

    // add info to domain
    if( typeof obj[domainsStr] !== 'undefined' ) {
      obj[domainsStr].push(info);
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
    obj[domainsStr] = [ info ];

    return obj;
  }, {});

  logObject(domains, 'domains');

  return domains;
}
exports.getDomains = getDomains;

async function writeConfigs() {


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
exports.writeConfigs = writeConfigs;
