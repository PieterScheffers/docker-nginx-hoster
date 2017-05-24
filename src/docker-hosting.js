// /etc/nginx/conf.d
// /etc/nginx/certs

const promisify = require("promisify-node");
const fs = promisify('fs');
const { unlink } = require('./fs');
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
  //   ],
  //   enabled: false,
  //   updated: false,
  // }
};

function setAllDomainsOff() {
  Object.keys(existingDomains).forEach(k => {
    Object.assign(existingDomains[k], { enabled: false, updated: false });
  });
}

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
  const ed = existingDomains;

  setAllDomainsOff();

  for( let key in domainsInfo ) {
    let { hosts, domains, main, template, email } = domainsInfo[key];

    const cDomains = domains.join(',');

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
        NG_PR_SSL_CERTIFICATE: certbot['fullchain.pem'] || (hasSelfSigned ? config.ssl.cert : ''),
        NG_PR_SSL_CERTIFICATE_KEY: certbot['privkey.pem'] || (hasSelfSigned ? config.ssl.key : ''),
      }
    );

    template = replace(template, replacements);

    const conf = runLoops(template);
    const hash = md5Hash(conf);
    const file = path.join(config.nginx['conf.d'], `${domains.join('_')}.conf`);

    ed[cDomains] = ed[cDomains] || {
      file,
      updated: false
    };

    if( !ed[cDomains] || ed[cDomains].confHash !== hash ) {
      await fs.writeFile(file, conf);
      ed[cDomains].updated = true;
    }

    Object.assign(ed[cDomains], {
      confHash: hash,
      enabled: true
    });
  }

  // check any domain has updated
  const hasAnyUpdated = Object.keys(ed).reduce((bool, k) => bool || ed[k].updated, false);

  // remove unwanted configs
  const configsToPreserve = Object.keys(ed).map(k => ed[k]).filter(d => d.enabled).map(d => d.file);
  logObject(configsToPreserve, 'configsToPreserve');
  await cleanConfigDir(configsToPreserve);

  // reload nginx if necessary
  if( hasAnyUpdated ) {
    // TODO: find name or hash of nginx proxy container
    const res = await sendHupSignal('nginx_proxy');
    console.log('Send HUP to nginx_proxy to reload config', res);
  }
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

/**
 * Remove all files from the config directory
 */
async function cleanConfigDir(ignorePaths = []) {
  const files = await fs.readdir(config.nginx['conf.d']);
  const paths = files
    .map(f => path.join(config.nginx['conf.d'], f))
    .filter(p => !ignorePaths.includes(p));

  return await Promise.all( paths.map(p => unlink(p)) );
}

/**
 * Write the default config
 */
async function writeDefaultConfig() {
  const defaultContents = `
    server {
        listen       80;
        server_name  localhost;

        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
        }

        # redirect server error pages to the static page /50x.html
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   /usr/share/nginx/html;
        }
    }
  `;

  const file = path.join(config.nginx['conf.d'], 'default.conf');

  return await fs.writeFile(file, defaultContents);
}

module.exports = exports = {
  getDomains,
  refreshConfigs: handler,
  createListener,
  cleanConfigDir,
  writeDefaultConfig,
};
