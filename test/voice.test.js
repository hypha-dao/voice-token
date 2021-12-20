const { describe } = require("riteway")
const { eos, names, getTableRows, isLocal, initContracts, getBalance } = require("../scripts/helper")

const { voice, owner, firstuser, seconduser, thirduser, fourthuser } = names

const dev_pubkey = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"

describe('voice reset test', async assert => {

  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
    return
  }

  const contracts = await initContracts({ voice })

  console.log('reset accounts')
  const stat = await getTableRows({
    code: "voice.hypha",
    scope: "HVOICE",
    table: 'stat',
    limit: 100,
    json: true,
  })

  if (stat.rows.length == 0) {
    console.log('create token')
    await contracts.voice.create(owner, "-1.00 HVOICE", 0, 0, { authorization: `${voice}@active` })
  } else {
    console.log('HVOICE token exists')
  }

  const users = [firstuser, seconduser, thirduser, fourthuser, owner]

  console.log("reset user balances")
  for (user of users) {
    try {
        await contracts.voice.reset(user, { authorization: `${voice}@active` } )
    } catch (err) {
        console.log("Make sure to uncomment 'reset' action in the contract")
        throw err
    }
  }

  balanceIssuer = await getBalance(owner, voice, "HVOICE")

  if (!balanceIssuer || balanceIssuer < 50000) {
      console.log("creating voice")
      await contracts.voice.issue(owner, "50000.00 HVOICE", "", { authorization: `${owner}@active` })
  }

  balance1 = await getBalance(firstuser, voice, "HVOICE")
  if (!balance1 || balance1 < 1) {
    await contracts.voice.transfer(owner, firstuser, "1.00 HVOICE", "", { authorization: `${owner}@active` })
  }
  balance1After = await getBalance(firstuser, voice, "HVOICE")

  balance2 = await getBalance(seconduser, voice, "HVOICE")
  if (!balance2 || balance2 < 10000) {
    await contracts.voice.transfer(owner, seconduser, "10000.00 HVOICE", "", { authorization: `${owner}@active` })
  }

  balance3 = await getBalance(thirduser, voice, "HVOICE")
  if (!balance3 || balance3 < 3000) {
    await contracts.voice.transfer(owner, thirduser, "3000.00 HVOICE", "", { authorization: `${owner}@active` })
  }

  balance4 = await getBalance(fourthuser, voice, "HVOICE")
  if (!balance4 || balance4 < 3000) {
    await contracts.voice.transfer(owner, fourthuser, "31501.00 HVOICE", "", { authorization: `${owner}@active` })
  }
  
  for (user of users) {
      b1 = await getBalance(user, voice, "HVOICE")
      console.log("user "+user + ": " + b1 + " HVOICE")

      await contracts.voice.voicereset(user, { authorization: `${voice}@active` })

      b2 = await getBalance(user, voice, "HVOICE")

      console.log("post reset "+user + ": " + b2 + " HVOICE")

      assert({
        given: 'user voice reset',
        should: 'be 1 or 5,000',
        actual: b2,
        expected: (b1 == 1 ? 1 : 5000)
      })
  }
  const stat2 = await getTableRows({
    code: "voice.hypha",
    scope: "HVOICE",
    table: 'stat',
    limit: 100,
    json: true,
  })


  const supply = stat2.rows[0].supply

  assert({
    given: 'supply 4 users',
    should: 'be 5000 * 4 + 1',
    actual: supply,
    expected: "20001.00 HVOICE",
  })

  
})

