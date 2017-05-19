const promisify = require("promisify-node");
const pem = promisify('pem');
const config = require('./config');
const fs = promisify('fs');
const { fileExists } = require('./fs');

// https://www.npmjs.com/package/pem
// https://jamielinux.com/docs/openssl-certificate-authority/index.html

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
  return await promises.dhparam;
}

async function selfSignedExists() {
  const keyExists = fileExists(config.ssl.key);
  const certExists = fileExists(config.ssl.cert);

  return await keyExists && await certExists;
}

async function dhparamExists() {
  return fileExists(config.ssl.dhparam);
}

/**
 * Create a new key/cert pair and save as file
 */
async function createSelfSigned() {

  if( !await selfSignedExists() ) {

    const keys = await pem.createCertificate({ days: 10000, selfSigned: true });
    const { serviceKey, certificate } = keys;

    // console.log("keys", keys); // csr, clientKey, certificate, serviceKey

    const task1 = fs.writeFile(config.ssl.key, serviceKey);
    const task2 = fs.writeFile(config.ssl.cert, certificate);

    await task1;
    await task2;
  }

  return { key: config.ssl.key, cert: config.ssl.cert };
}

/**
 * Create a dhparam and save to file
 */
async function createDhparam() {

  if( !await dhparamExists() ) {
    console.log("Begin creating dhparam...");

    const { dhparam } = await pem.createDhparam(2048);
    await fs.writeFile(config.ssl.dhparam, dhparam);

    console.log("Done creating dhparam!");
  }

  return config.ssl.dhparam;
}

module.exports = exports = {
  getSelfSigned,
  getDhParam,
  selfSignedExists,
  dhparamExists,
};
