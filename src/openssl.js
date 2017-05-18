const promisify = require("promisify-node");
const pem = promisify('pem');
const config = require('./config');
const fs = promisify('fs');
const { delay } = require('./utils');

// https://www.npmjs.com/package/pem

const promises = {
  selfSigned: null,
  dhparam: null,
  dhparamSmall: null,
};

async function getSelfSigned() {
  if( !promises.selfSigned ) promises.selfSigned = createSelfSigned();
  return await promises.selfSigned;
}

async function getDhParam() {
  if( !promises.dhparam ) promises.dhparam = createDhparam();
  if( !promises.dhparamSmall ) promises.dhparamSmall = createSmallDhparam();

  // add a 100 ms delay to the small dhparam, if it is still faster, return it
  // when the big dhparam is generated, it will be returned instead
  const dhparam = await Promise.race([
    promises.dhparam,
    promises.dhparamSmall.then(result => {
      console.log("dhparamsmall delay func")
      return delay(100).then(() => result);
    })
  ]);

  console.log("dhparam func", dhparam);

  return dhparam;
}

/**
 * Create a new key/cert pair and save as file
 */
async function createSelfSigned() {
  const { serviceKey, certificate } = await pem.createCertificate({ days: 10000, selfSigned: true });

  const task1 = fs.writeFile(config.ssl.key, serviceKey);
  const task2 = fs.writeFile(config.ssl.cert, certificate);

  await task1;
  await task2;

  return { key: config.ssl.key, cert: config.ssl.cert };
}

/**
 * Create a dhparam and save to file
 */
async function createDhparam() {
  console.log("begin creating dhparam...");
  const { dhparam } = await pem.createDhparam(2048);
  await fs.writeFile(config.ssl.dhparam, dhparam);

  console.log("done createing dhparam");

  return config.ssl.dhparam;
}

async function createSmallDhparam() {
  console.log("begin creating small dhparam...");
  const { dhparam } = await pem.createDhparam(512);
  await fs.writeFile(config.ssl.dhparamSmall, dhparam);

  console.log("done createing small dhparam");

  return config.ssl.dhparamSmall;
}

module.exports = exports = {
  getSelfSigned,
  getDhParam
};
