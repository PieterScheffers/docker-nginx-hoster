const { inspect, get, argsTranspile, toSmallHash } = require('./docker-containers');
const { replace } = require('./template');
const { writeFile } = require('./fs');
const dockerEvents = require('./docker-events');
const { getDomains } = require('./docker-hosting');

/**
 * environment variables
 * NG_PR_DOMAIN
 * NG_PR_EMAIL
 * NG_PR_PORT
 * NG_PR_TEMPLATE
 *
 * configuration variables
 * NG_PR_1_PORT
 * NG_PR_1_HOST
 * NG_PR_1_DOMAIN
 * NG_PR_EMAIL
 */

async function main() {
  try {
    const de = dockerEvents();

    de.on('all', info => console.log('info', info))

    console.log(await getDomains());

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
  }
}

main();
