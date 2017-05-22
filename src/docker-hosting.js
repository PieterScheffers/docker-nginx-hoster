// /etc/nginx/conf.d
// /etc/nginx/certs

const promisify = require("promisify-node");
const fs = promisify('fs');
const path = require('path');
const { inspect, getRunning, getHostName, sendHupSignal } = require('./docker-containers');
const { logObject, throttle } = require('./utils');
const dockerEvents = require('./docker-events');
const { replace, conditional, runLoops } = require('./template');
const config = require('./config');
const { dhparamExists, selfSignedExists, md5Hash } = require('./openssl');
const { enqueue } = require('./docker-certbot');

const defaultTemplate = fs.readFileSync(path.join(__dirname, 'conf', 'default-template.conf'), { encoding: 'utf-8' });
const acmeChallengeTemplate = fs.readFileSync(path.join(__dirname, 'conf', 'snippets', 'certbot-acme-challenge.conf'), { encoding: 'utf-8' });
const sslTemplate = fs.readFileSync(path.join(__dirname, 'conf', 'snippets', 'ssl.conf'), { encoding: 'utf-8' });

const existingDomains = {
  // 'example.org,another.example.org': {
  //   confHash: '1bdf72e04d6b50c82a48c7e4dd38cc69',
  //   domains: [ 'example.org', 'another.example.org' ],
  //   email: 'someone@example.org',
  //   template: '',
  //   hosts: [
  //     { host: 'my-proxied-app_1', port: 3333 },
  //     { host: 'my-proxied-app_2', port: 3333 },
  //   ]
  // }
};

async function getDomains(inspections) {

  // get inspect results from containers with valid environment variables
  inspections = inspections.filter(i => !!i.Config.Env.NG_PR_DOMAIN && !!i.Config.Env.NG_PR_PORT && !!i.Config.Env.NG_PR_EMAIL);

  const doneDomains = [];

  // get info from inspect result
  const domainInfo = inspections.map(i => {
    // get the domains
    // sort, to make 'www.example.com,example.com' and 'example.com,www.example.com' the same
    let domains = i.Config.Env.NG_PR_DOMAIN.split(',').map(d => d.trim()).sort();

    // check main domain is in domains, if not select the last domain as main domain
    let main = i.Config.Env.NG_PR_MAINDOMAIN.trim();

    // if domains doesn't contain the main-domain, add it
    if( !domains.includes(main) ) {
      domains.push(main);
      domains = domains.sort();
    }

    // if main domain is not set, make it the last domain
    if( !main ) {
      main = domains[domains.length - 1];
    }

    return {
      domains,
      main,
      email: i.Config.Env.NG_PR_EMAIL,
      template: i.Config.Env.NG_PR_TEMPLATE,
      host: getHostName(i),
      port: i.Config.Env.NG_PR_PORT,
    };
  })
  // group hosts per domain group
  .reduce((obj, info) => {
    const { domains, main, email, template, host, port } = info;
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
    obj[domainsStr] = {
      domains,
      main,
      email,
      template,
      hosts: [ { host, port } ]
    };

    return obj;
  }, {});

  logObject(domainInfo, 'domainInfo');

  return domainInfo;
}
exports.getDomains = getDomains;

function writeConditionals(template, conditionals) {
  Object.keys(conditionals).forEach(cond => {
    const bool = !!conditionals[cond];
    template = conditional(template, `if_has${cond}`, bool);
    template = conditional(template, `if_hasNot${cond}`, !bool);
  });

  return template;
}

// TODO: Cleanup this method!!
async function writeConfigs(domainsInfo) {

  const hasDhparam = await dhparamExists();
  const hasSelfSigned = await selfSignedExists();

  Object.keys(domainsInfo).forEach(async (key) => {
    let { hosts, domains, main, template, email } = domainsInfo[key];

    const cDomains = domains.join(',');
    const ed = existingDomains;

    let certbot;
    try {
      certbot = await enqueue({ domains, email, main });
    } catch(error) {
      console.error("certbot error", error);
    }

    if( !template ) {
      template = defaultTemplate;
    }

    // apply conditionals
    // with it pieces of configuration can be inserted on a condition
    const conditionals = {
      SSL: hasSelfSigned || (certbot['fullchain.pem'] && certbot['privkey.pem']),
      Dhparam: hasDhparam,
      TrustedCertificate: !!certbot['fullchain.pem'],
      Letsencrypt: certbot['fullchain.pem'] && certbot['privkey.pem'],
      SelfSigned: hasSelfSigned,
    };

    template = writeConditionals(template, conditionals);

    // insert snippets
    // TODO:
    //   load snippets dir and create replace keys dynamically
    //   the snippets dir can then be mounted over with docker
    template = replace(template, {
      NG_PR_ACME_CHALLENGE: writeConditionals(acmeChallengeTemplate, conditionals),
      NG_PR_SSL: writeConditionals(sslTemplate, conditionals),
    });


    /*
     * NG_PR_DOMAINS = spaces separated domain names
     * NG_PR_MAIN
     * NG_PR_1_PORT
     * NG_PR_1_HOST
     * NG_PR_EMAIL
     * NG_PR_UPSTREAM
     * NG_PR_DHPARAM
     * NG_PR_TRUSTED_CERTIFICATE
     * NG_PR_SSL_CERTIFICATE
     * NG_PR_SSL_CERTIFICATE_KEY
     */

    const NG_PR_PROXY_PASS = domains.join('_').replace(/\./g, '');
    const NG_PR_UPSTREAM = hosts.reduce((str, { host, port }) => str + `    server ${host}:${port};\n`, `upstream ${NG_PR_PROXY_PASS} {\n`) +  "}\n";

    const replacements = Object.assign(
      hosts.reduce((obj, { host, port }, i) => {
        obj[`NG_PR_${i}_PORT`] = port;
        obj[`NG_PR_${i}_HOST`] = host;
        return obj;
      }, {}),
      {
        NG_PR_DOMAINS: domains.join(' '),
        NG_PR_OTHERDOMAINS: domains.filter(d => d !== main).join(' '),
        NG_PR_MAIN: main,
        NG_PR_UPSTREAM,
        NG_PR_PROXY_PASS,
        NG_PR_CERTBOT_WEBROOT: config.certbot.webroot,
        NG_PR_EMAIL: email,
        NG_PR_DHPARAM: hasDhparam ? config.ssl.dhparam : '',
        NG_PR_TRUSTED_CERTIFICATE: certbot['fullchain.pem'] ? certbot['fullchain.pem'] : '',
        NG_PR_SSL_CERTIFICATE: certbot['fullchain.pem'] ? certbot['fullchain.pem'] : (hasSelfSigned ? config.ssl.cert : ''),
        NG_PR_SSL_CERTIFICATE_KEY: certbot['privkey.pem'] ? certbot['privkey.pem'] : (hasSelfSigned ? config.ssl.key : ''),
      }
    );

    template = replace(template, replacements);

    const conf = runLoops(template);
    const hash = md5Hash(conf);

    if( !ed[cDomains] || ed[cDomains].confHash !== hash ) {
      const file = path.join(config.nginx['conf.d'], `${domains.join('_')}.conf`);
      await fs.writeFile(file, conf);

      // TODO: find name or hash of nginx proxy container
      // TODO: first check if any config has changed before reload nginx
      const res = await sendHupSignal('nginx_proxy');
      console.log('Send HUP to nginx_proxy to reload config', res);
    }
    
    ed[cDomains] = Object.assign(
      ed[cDomains] || {}, 
      {
        confHash: hash,
      }
    );

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

  // reload nginx
}

// create a throttled hander,
// to refresh configs every 30 seconds max
const handler = throttle(refreshConfigs, 30000);

exports.refreshConfigs = handler;

function createListener(event = 'all') {
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
      de.on(event, handlerWrapper);
    },

    stop: function stop() {
      de.removeListener(event, handlerWrapper);
      handlerWrapper = null;
      de = null;
    },
  };
}

exports.createListener = createListener;
