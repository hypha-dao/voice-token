require('dotenv').config()

const Eos = require('./eosjs-port')
const R = require('ramda')

// Note: For some reason local chain ID is different on docker vs. local install of eosio
const dockerLocalChainID = 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f'
const eosioLocalChainID = '8a34ec7df1b8cd06ff4a8abbaa7cc50300823350cadc59ab296cb00d104d2b8f'

const networks = {
  mainnet: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
  local: process.env.COMPILER === 'local' ? eosioLocalChainID : dockerLocalChainID,
  telosTestnet: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
  telosMainnet: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11'
}

const networkDisplayName = {
  mainnet: '???',
  local: 'Local',
  telosTestnet: 'Telos Testnet',
  telosMainnet: 'Telos Mainnet'
}

const endpoints = {
  local: 'http://127.0.0.1:8888',
  telosTestnet: 'https://api-test.telosfoundation.io',
  telosMainnet: 'https://api.telosfoundation.io'
}

const ownerAccounts = {
  local: 'dao.hypha',
  telosTestnet: 'dao.hypha',
  telosMainnet: 'dao.hypha'
}

const {
  EOSIO_NETWORK,
  EOSIO_API_ENDPOINT,
  EOSIO_CHAIN_ID
} = process.env

const chainId = EOSIO_CHAIN_ID || networks[EOSIO_NETWORK] || networks.local
const httpEndpoint = EOSIO_API_ENDPOINT || endpoints[EOSIO_NETWORK] || endpoints.local
const owner = ownerAccounts[EOSIO_NETWORK] || ownerAccounts.local

const netName = EOSIO_NETWORK != undefined ? (networkDisplayName[EOSIO_NETWORK] || "INVALID NETWORK: " + EOSIO_NETWORK) : "Local"

console.log("" + netName)

const publicKeys = {
  [networks.local]: ['EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV', 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'],
  [networks.telosMainnet]: ['EOS6kp3dm9Ug5D3LddB8kCMqmHg2gxKpmRvTNJ6bDFPiop93sGyLR', 'EOS6kp3dm9Ug5D3LddB8kCMqmHg2gxKpmRvTNJ6bDFPiop93sGyLR'],
  [networks.telosTestnet]: ['EOS8MHrY9xo9HZP4LvZcWEpzMVv1cqSLxiN2QMVNy8naSi1xWZH29', 'EOS8C9tXuPMkmB6EA7vDgGtzA99k1BN6UxjkGisC1QKpQ6YV7MFqm']
  // NOTE: Testnet seems to use EOS8C9tXuPMkmB6EA7vDgGtzA99k1BN6UxjkGisC1QKpQ6YV7MFqm for onwer and active - verify
}
const [ownerPublicKey, activePublicKey] = publicKeys[chainId]

const account = (accountName, quantity = '0.0000 SEEDS', pubkey = activePublicKey) => ({
  type: 'account',
  account: accountName,
  creator: owner,
  publicKey: pubkey,
  stakes: {
    cpu: '1.0000 TLOS',
    net: '1.0000 TLOS',
    ram: 10000
  },
  quantity
})

const contract = (accountName, contractName, quantity = '0.0000 SEEDS') => ({
  ...account(accountName, quantity),
  type: 'contract',
  name: contractName,
  stakes: {
    cpu: '1.0000 TLOS',
    net: '1.0000 TLOS',
    ram: 700000
  }
})

const testnetUserPubkey = "EOS8M3bWwv7jvDGpS2avYRiYh2BGJxt5VhfjXhbyAhFXmPtrSd591"

const accountsMetadata = (network) => {
  if (network == networks.local) {
    return {
      owner: account(owner),

      firstuser: account  ('firstuser111'),
      seconduser: account ('seconduser11'),
      thirduser: account  ('thirduser111'),
      fourthuser: account ('fourthuser11'),

      voice: contract('voice.hypha', 'voice'),
    }
  } else if (network == networks.telosMainnet) {
    return {
      owner: account(owner),
      voice: contract('voice.hypha', 'voice'),
    }
  } else if (network == networks.telosTestnet) {
    return {
      owner: account(owner),
      voice: contract('voice.hypha', 'voice'),
    }
  } else {
    throw new Error(`${network} deployment not supported`)
  }
}

const accounts = accountsMetadata(chainId)
const names = R.mapObjIndexed((item) => item.account, accounts)
const allContracts = []
const allContractNames = []
const allAccounts = []
const allBankAccountNames = []
for (let [key, value] of Object.entries(names)) {
  if (accounts[key].type == "contract" || accounts[key].type == "token") {
    allContracts.push(key)
    allContractNames.push(value)
  } else {
    if (value.indexOf(".seeds") != -1) {
      allAccounts.push(key)
      allBankAccountNames.push(value)
    }
  }
}
allContracts.sort()
allContractNames.sort()
allAccounts.sort()
allBankAccountNames.sort()

var permissions = [{

}]

const isTestnet = chainId == networks.telosTestnet
const isLocalNet = chainId == networks.local

if (isTestnet || isLocalNet) {
  // Any special actions for testnet or local net - add here
}

const keyProviders = {
  [networks.local]: [process.env.LOCAL_PRIVATE_KEY, process.env.LOCAL_PRIVATE_KEY],
  [networks.telosMainnet]: [process.env.TELOS_MAINNET_OWNER_KEY, process.env.TELOS_MAINNET_ACTIVE_KEY,],
  [networks.telosTestnet]: [process.env.TELOS_TESTNET_OWNER_KEY, process.env.TELOS_TESTNET_ACTIVE_KEY,]
}

const keyProvider = keyProviders[chainId]

if (keyProvider.length == 0 || keyProvider[0] == null) {
  console.log("ERROR: Invalid Key Provider: " + JSON.stringify(keyProvider, null, 2))
}

const isLocal = () => { return chainId == networks.local }

const config = {
  keyProvider,
  httpEndpoint,
  chainId
}

const eos = new Eos(config, isLocal)

// Use eosNoNonce for not adding a nonce to every action
// nonce means every action has a unique nonce - an action on policy.seeds
// The nonce makes it so no duplicate transactions are recorded by the chain
// So it makes unit tests a lot more predictable
// But sometimes the nonce is undesired, example, when testing policy.seeds itself
// NOTE This is changing global variables, not working. Only needed for policy test.
// const eosNoNonce = new Eos(config, false)

setTimeout(async () => {
  let info = await eos.getInfo({})
  if (info.chain_id != chainId) {
    console.error("Fix this by setting local chain ID to " + info.chain_id)
    console.error('Chain ID mismatch, signing will not work - \nactual Chain ID: "+info.chain_id + "\nexpected Chain ID: "+chainId')
    throw new Error("Chain ID mismatch")
  }
})

const getEOSWithEndpoint = (ep) => {
  const config = {
    keyProvider,
    httpEndpoint: ep,
    chainId
  }
  return new Eos(config, isLocal)
}

const getTableRows = eos.getTableRows

const getTelosBalance = async (user) => {
  const balance = await eos.getCurrencyBalance(names.tlostoken, user, 'TLOS')
  return Number.parseInt(balance[0])
}

const getBalance = async (user, contract, symbol) => {
  const balance = await eos.getCurrencyBalance(contract, user, symbol)
  return Number.parseInt(balance[0])
}

const getBalanceFloat = async (user) => {
  const balance = await eos.getCurrencyBalance(names.token, user, 'SEEDS')
  var float = parseInt(Math.round(parseFloat(balance[0]) * 10000)) / 10000.0;

  return float;
}

const initContracts = (accounts) =>
  Promise.all(
    Object.values(accounts).map(
      account => eos.contract(account)
    )
  ).then(
    contracts => Object.assign({}, ...Object.keys(accounts).map(
      (account, index) => ({
        [account]: contracts[index]
      })
    ))
  )

// === Some oddball helper methods we may or may not need

const ecc = require('eosjs-ecc')
const sha256 = ecc.sha256

const ramdom64ByteHexString = async () => {
  let privateKey = await ecc.randomKey()
  const encoded = Buffer.from(privateKey).toString('hex').substring(0, 64);
  return encoded
}
const fromHexString = hexString => new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))

const createKeypair = async () => {
  let private = await ecc.randomKey()
  let public = await Eos.getEcc().privateToPublic(private)
  return { private, public }
}

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asset(quantity) {
  if (typeof quantity == 'object') {
    if (quantity.symbol) {
      return quantity
    }
    return null
  }
  const [amount, symbol] = quantity.split(' ')
  const indexDecimal = amount.indexOf('.')
  const precision = amount.substring(indexDecimal + 1).length
  return {
    amount: parseFloat(amount),
    symbol,
    precision,
    toString: quantity
  }
}

module.exports = {
  keyProvider, httpEndpoint,
  eos, getEOSWithEndpoint, getBalance, getBalanceFloat, getTableRows, initContracts,
  accounts, names, ownerPublicKey, activePublicKey, permissions, sha256, isLocal, ramdom64ByteHexString, createKeypair,
  testnetUserPubkey, getTelosBalance, fromHexString, allContractNames, allContracts, allBankAccountNames, sleep, asset, isTestnet
}
