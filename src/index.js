const { inspect, get, argsTranspile } = require('./docker-containers');
const { replace } = require('./template');
const { writeFile } = require('./fs');
const dockerEvents = require('./docker-events');

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

    const containers = await get();
    console.log("containers", containers);

    const inspections = await inspect(containers);
    const files = inspections.map(i => i.Config.Env).filter(o => !!o.file)

    // await writeFile('somefile.yml', files[0]);

    // console.log("inspections", inspections);

    // keep server running
    // setInterval(function() { console.log("bla bla bla"); }, 2000);

  } catch(e) {
    console.error('Exception: ', e);
  }
}

main();
