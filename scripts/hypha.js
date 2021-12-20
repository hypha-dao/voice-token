#!/usr/bin/env node

const test = require('./test')
const program = require('commander')
const compile = require('./compile')
const { eos, isLocal, names, accounts, allContracts, allContractNames, allBankAccountNames, isTestnet } = require('./helper')
const { settings, scheduler } = names

const {proposeDeploy, proposeKeyPermissions } = require('./propose_deploy')
const deploy = require('./deploy.command')
const { deployAllContracts, updatePermissions, resetByName, 
    changeOwnerAndActivePermission, 
    changeExistingKeyPermission, 
    addActorPermission,
    removeAllActorPermissions } = require('./deploy')


const getContractLocation = (contract) => {
    return {
      source: `./src/${contract}.cpp`,
      include: ""
    }
  
}

const compileAction = async (contract) => {
    try {
      var { source, include } = getContractLocation(contract)
      await compile({
        contract: contract,
        source,
        include
      })
      console.log(`${contract} compiled`)
    } catch (err) {
        console.log("compile failed for " + contract + " error: " + err)
    }
}

const deployAction = async (contract) => {
    try {
      await deploy(contract)
      console.log(`${contract} deployed`)
    } catch(err) {
      let errStr = ("" + err).toLowerCase()
      if (errStr.includes("contract is already running this version of code")) {
        console.log(`${contract} code was already deployed`)
      } else {
        console.log("error deploying ", contract)
        console.log(err)          
      }
    }
}

const runAction = async (contract) => {
  await compileAction(contract)
  await deployAction(contract)
  //await test(contract)
}

const batchCallFunc = async (contract, moreContracts, func) => {
  if (contract == 'all') {
    for (const contract of allContracts) {
      await func(contract)
    }
  } else {
    await func(contract)
  }
  if (moreContracts) {
    for (var i=0; i<moreContracts.length; i++) {
      await func(moreContracts[i])
    }
  }
}

const initAction = async (compile = true) => {

  if (compile) {
    for (i=0; i<allContracts.length; i++) {
      let item = allContracts[i];
      console.log("compile ... " + item);
      await compileAction(item);
    }
  } else {
    console.log("no compile")
  }

  await deployAllContracts()

}

const updatePermissionAction = async () => {
  await updatePermissions()
}

/// 
/// Commands 
/// 

program
  .command('init [compile]')
  .description('Initial creation of all accounts and contracts contract')
  .action(async function(compile) {
    var comp = compile != "false" 
    await initAction(comp)
  })

program
  .command('compile <contract> [moreContracts...]')
  .description('Compile custom contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, compileAction)
  })

  program
  .command('propose_deploy <proposer_account> <proposal_name> <contract>')
  .description('Propose contract deployment: ./scripts/seeds.js propose_deploy seedsuseraaa ab policy')
  .action(async function (proposer_account, proposal_name, contract) {
    await proposeDeploy(proposer_account, proposal_name, contract)
  })

  program
  .command('propose_key_permission <proposer_account> <proposal_name> <contract> <key>')
  .description('Propose setting contract permissions to key - guardians need to sign')
  .action(async function (proposer_account, proposal_name, contract, key) {
    await proposeKeyPermissions(proposer_account, proposal_name, contract, "owner", key)
  })

  program
  .command('remove_actor_permissions')
  .description('Remove all actor permissions, updatePermissions can then cleanly add new permissions.')
  .action(async function () {
    // Not sure this is generally useful - remove actor permissions
    await removeAllActorPermissions("contractname")
    /// ... remove more...
    console.log("Permissions removed, updating permissions")
    await updatePermissionAction()
  })

program
  .command('deploy <contract> [moreContracts...]')
  .description('Deploy contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, deployAction)
  })

program
  .command('run <contract> [moreContracts...]')
  .description('compile and deploy contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, runAction)
  })

program
  .command('test <contract> [moreContracts...]')
  .description('Run unit tests for deployed contract')
  .action(async function(contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, test)
  })

  program
  .command('updatePermissions')
  .description('Update all permissions of all contracts')
  .action(async function() {
    await updatePermissionAction()
  })

program
  .command('list')
  .description('List all contracts / accounts')
  .action(async function() {
    console.print("\nAll Contracts\n")
    allContractNames.forEach(item=>console.print(item))
  })

program
  .command('changekey <contract> <key>')
  .description('Change owner and active key')
  .action(async function(contract, key) {
    console.print(`Change key of ${contract} to `+key + "\n")
    await changeOwnerAndActivePermission(contract, key)
  })

program
  .command('change_key_permission <contract> <role> <parentrole> <key>')
  .description('Change owner and active key')
  .action(async function(contract, role, parentrole, key) {
    console.print(`Change key of ${contract} to `+key + "\n")
    await changeExistingKeyPermission(contract, role, parentrole, key)
  })

  program
  .command('add_permission <target> <targetrole> <actor> <actorrole>')
  .description('Add permission')
  .action(async function(target, targetrole, actor, actorrole) {
    console.print(`Adding ${actor}@${actorrole} to ${target}@${targetrole}`+ "\n")
    await addActorPermission(target, targetrole, actor, actorrole)
  })


program.parse(process.argv)

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
  program.help();
}