const { inspect, get, argsTranspile, toSmallHash } = require('./docker-containers');
const { replace } = require('./template');
const { writeFile } = require('./fs');
const { createListener, refreshConfigs, cleanConfigDir, writeDefaultConfig } = require('./docker-hosting');
const { getSelfSigned, getDhParam } = require('./openssl');
/**
 * environment variables
 * NG_PR_DOMAIN
 * NG_PR_EMAIL
 * NG_PR_PORT
 * NG_PR_TEMPLATE
 *
 * configuration variables
 * NG_PR_DOMAINS = spaces separated domain names
 * NG_PR_1_PORT
 * NG_PR_1_HOST
 * NG_PR_1_DOMAIN
 * NG_PR_EMAIL
 * NG_PR_UPSTREAM
 * NG_PR_DHPARAM
 * NG_PR_TRUSTED_CERTIFICATE
 * NG_PR_SSL_CERTIFICATE
 * NG_PR_SSL_CERTIFICATE_KEY
 */

process.on('unhandledRejection', (reason, promise) => console.error('unhandled Promise Rejection:', 'reason', reason, 'promise', promise));

async function main() {

  let listener;

  try {

    // At start: remove all configs
    // Create a simple config to redirect to nginx default html
    await cleanConfigDir();
    await writeDefaultConfig();

    // start listening for docker events (those trigger refreshConfig)
    listener = createListener();
    listener.start();

    // refresh the nginx configs
    await refreshConfigs();

    console.log('self-signed', await getSelfSigned());
    console.log('dhparam', await getDhParam());

    // const containers = await get();
    // console.log("containers", containers);

    // const inspections = await inspect(containers);
    // const files = inspections.map(i => i.Config.Env).filter(o => !!o.file)

    // await writeFile('somefile.yml', files[0]);

    // console.log("inspections", inspections.map(i => i.Name))

    // keep server running
    // setInterval(function() { console.log("bla bla bla"); }, 2000);

  } catch(e) {
    console.error('Exception: ', e);
    listener.stop();
  }
}

main();
