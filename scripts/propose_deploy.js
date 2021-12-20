const assert = require('assert')
const zlib = require('zlib')
const fetch = require('node-fetch')

const eosjs = require('eosjs')
const { Serialize } = eosjs
const { SigningRequest } = require('eosio-signing-request')
const { source } = require('./deploy')
const { accounts, eos } = require('./helper')

const authPlaceholder = "............1"
const GuardianAccountName = "cg.seeds"

/**
 * Revert account back to key permission
 * @param {*} proposerAccount 
 * @param {*} proposalName 
 * @param {*} targetAccount 
 * @param {*} permission_name 
 */
const proposeKeyPermissions = async (proposerAccount, proposalName, targetAccount, permission_name, public_key) => {
  console.log('proposeKeyPermissions ' + targetAccount + " with key " + public_key)

  assert(permission_name == "active" || permission_name == "owner", "permission must be active or owner")

  const parent = permission_name == 'owner' ? "." : "owner"
  const { permissions } = await eos.getAccount(targetAccount)
  const perm = permissions.find(p => p.perm_name === permission_name)
  console.log("existing permission " + JSON.stringify(perm, null, 2))
  const { required_auth } = perm
  const { keys, accounts, waits } = required_auth
  const auth = {
    threshold: 1,
    waits: [],
    accounts: [],
    keys: [{
      key: public_key,
      weight: 1
    }]
  }
  console.log("new permissions: " + JSON.stringify(auth, null, 2))

  const actions = [{
    account: 'eosio',
    name: 'updateauth',
    authorization: [{
      actor: targetAccount,
      permission: "owner",
    }],
    data: {
      account: targetAccount,
      permission: permission_name,
      parent,
      auth
    },
  }]

  const res = await createMultisigProposal(proposerAccount, proposalName, actions, "owner")

  const approveESR = await createESRCodeApprove({ proposerAccount, proposalName })

  console.log("ESR for Approve: " + JSON.stringify(approveESR))

  const execESR = await createESRCodeExec({ proposerAccount, proposalName })

  console.log("ESR for Exec: " + JSON.stringify(execESR))


}



const proposeDeploy = async (proposerAccount, proposalName, contractName) => {
  console.log('propose deployment of ' + contractName)

  const api = eos.api

  const { code, abi } = await source(contractName)

  console.log("compiled code with length " + code.length)

  console.log("constructed abi with length " + abi.length)

  const contractAccount = accounts[contractName].account

  const setCodeData = {
    account: contractAccount,
    code: code.toString('hex'),
    vmtype: 0,
    vmversion: 0,
  }

  const setCodeAuth = [{
    actor: contractAccount,
    permission: 'active',
  }]

  const abiAsHex = await abiToHex(JSON.parse(abi))
  // console.log("hex abi: "+abiAsHex)

  const setAbiData = {
    account: contractAccount,
    abi: abiAsHex
  }

  const setAbiAuth = [{
    actor: contractAccount,
    permission: 'active',
  }]

  const actions = [{
    account: 'eosio',
    name: 'setcode',
    data: setCodeData,
    authorization: setCodeAuth
  }, {
    account: 'eosio',
    name: 'setabi',
    data: setAbiData,
    authorization: setAbiAuth
  }]


  const res = await createMultisigProposal(proposerAccount, proposalName, actions)

  const approveESR = await createESRCodeApprove({ proposerAccount, proposalName })

  console.log("ESR for Approve: " + JSON.stringify(approveESR))

  const execESR = await createESRCodeExec({ proposerAccount, proposalName })

  console.log("ESR for Exec: " + JSON.stringify(execESR))

}

const abiToHex = (abi) => {
  const api = eos.api

  const buffer = new Serialize.SerialBuffer({
    textEncoder: api.textEncoder,
    textDecoder: api.textDecoder,
  })

  const abiDefinitions = api.abiTypes.get('abi_def')

  abi = abiDefinitions.fields.reduce(
    (acc, { name: fieldName }) =>
      Object.assign(acc, { [fieldName]: acc[fieldName] || [] }),
    abi
  )

  abiDefinitions.serialize(buffer, abi)
  const serializedAbiHexString = Buffer.from(buffer.asUint8Array()).toString('hex')

  return serializedAbiHexString
}

const getConstitutionalGuardians = async (permission_name = "active") => {
  const guardacct = GuardianAccountName
  const { permissions } = await eos.getAccount(guardacct)
  const activePerm = permissions.filter(item => item.perm_name == permission_name)
  const result = activePerm[0].required_auth.accounts
    .filter(item => item.permission.actor != "msig.seeds")
    .map(item => item.permission)
  //console.log("CG accounts: "+JSON.stringify(result, null, 2))
  return result
}

// take any input of actions, create a multisig proposal for guardians from it!

const createMultisigProposal = async (proposerAccount, proposalName, actions, permission = "active") => {

  const api = eos.api

  const serializedActions = await api.serializeActions(actions)

  console.log("====== PROPOSING ======")

  const guardians = await getConstitutionalGuardians(permission)

  console.log("requested permissions: " + permission + " " + JSON.stringify(guardians.map(item => item.actor)))

  const proposeInput = {
    proposer: proposerAccount,
    proposal_name: proposalName,
    requested: guardians,
    trx: {
      expiration: '2021-09-14T16:39:15',
      ref_block_num: 0,
      ref_block_prefix: 0,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: serializedActions,
      transaction_extensions: []
    }
  };

  //console.log('send propose ' + JSON.stringify(proposeInput))
  // console.log("propose action")

  const auth = [{
    actor: proposerAccount,
    permission: "active",
  }]

  const propActions = [{
    account: 'msig.seeds',
    name: 'propose',
    authorization: auth,
    data: proposeInput
  }]

  const trxConfig = {
    blocksBehind: 3,
    expireSeconds: 30,
  }

  //console.log("msig proposal: "+JSON.stringify(propActions, null,2))

  let res = await api.transact({
    actions: propActions
  }, trxConfig)

  return res
}

const createESRCodeApprove = async ({ proposerAccount, proposalName }) => {

  const approveActions = [{
    account: 'msig.seeds',
    name: 'approve',
    data: {
      proposer: proposerAccount,
      proposal_name: proposalName,
      level: {
        actor: authPlaceholder,
        permission: 'active'
      }
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createESRWithActions({ actions: approveActions })
}

const createESRCodeExec = async ({ proposerAccount, proposalName }) => {

  const execActions = [{
    account: 'msig.seeds',
    name: 'exec',
    data: {
      proposer: proposerAccount,
      proposal_name: proposalName,
      executer: authPlaceholder
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createESRWithActions({ actions: execActions })
}

const createESRCodeTransfer = async ({ recepient, amount, memo }) => {

  const actions = [{
    account: 'token.seeds',
    name: 'transfer',
    data: {
      from: authPlaceholder,
      to: recepient,
      amount: amount.toFixed(4) + " SEEDS",
      memo: memo
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createESRWithActions({ actions: actions })
}


const createESRWithActions = async ({ actions }) => {

  console.log("========= Generating ESR Code ===========")

  const esr_uri = "https://api-esr.hypha.earth/qr"
  const body = {
    actions
  }

  //console.log("actions: "+JSON.stringify(body, null, 2))

  const rawResponse = await fetch(esr_uri, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const parsedResponse = await rawResponse.json();

  //console.log("parsed response "+JSON.stringify(parsedResponse))

  return parsedResponse
}

module.exports = { proposeDeploy, proposeKeyPermissions }