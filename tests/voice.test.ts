import {getAccountHvoice, getIssuedHvoice} from "./utils/Helpers";

const { loadConfig, Blockchain } = require("@klevoya/hydra");

const config = loadConfig("hydra.yml");

describe("voice", () => {
  const blockchain = new Blockchain(config);
  const tester = blockchain.createAccount(`voice`);
  const user1 = blockchain.createAccount('user1');
  const user2 = blockchain.createAccount('user2');

  beforeAll(async () => {
    tester.setContract(blockchain.contractTemplates[`voice`]);
    tester.updateAuth(`active`, `owner`, {
      accounts: [
        {
          permission: {
            actor: tester.accountName,
            permission: `eosio.code`
          },
          weight: 1
        }
      ]
    });
  });

  beforeEach(async () => {
    tester.resetTables();
  });

  it("issues and transfers", async () => {

    expect(() => getIssuedHvoice(tester, 'foo')).toThrow('Unknown tenant: foo');

    // Creates foo under own account.
    await tester.contract.create({
      issuer: tester.accountName,
      tenant: 'foo',
      maximum_supply: '-1.00 HVOICE',
      decay_period: 1000,
      decay_per_period_x10M: 5000000
    });

    // opens account for user1 and user2 on tenant 'foo'
    await tester.contract.open({
      tenant: 'foo',
      owner: user1.accountName,
      symbol: '2,HVOICE',
      ram_payer: tester.accountName
    });
    await tester.contract.open({
      tenant: 'foo',
      owner: user2.accountName,
      symbol: '2,HVOICE',
      ram_payer: tester.accountName
    });

    expect(getIssuedHvoice(tester, 'foo')).toEqual('0.00 HVOICE');
    expect(() => getIssuedHvoice(tester, 'bar')).toThrow('Unknown tenant: bar');

    // Creates bar under own account.
    await tester.contract.create({
      issuer: tester.accountName,
      tenant: 'bar',
      maximum_supply: '-1.00 HVOICE',
      decay_period: 1000,
      decay_per_period_x10M: 5000000
    });
    expect(getIssuedHvoice(tester, 'bar')).toEqual('0.00 HVOICE');

    // issue 100 hvoice on foo tenant
    await tester.contract.issue({
      to: tester.accountName,
      tenant: 'foo',
      quantity: '100.00 HVOICE',
      memo: 'increasing hvoice'
    });

    // transfer to user1.accountName
    await tester.contract.transfer({
      from: tester.accountName,
      to: user1.accountName,
      tenant: 'foo',
      quantity: '100.00 HVOICE',
      memo: 'increasing HVOICE'
    });

    expect(getIssuedHvoice(tester, 'foo')).toEqual('100.00 HVOICE');
    expect(getIssuedHvoice(tester, 'bar')).toEqual('0.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user1.accountName)).toEqual('100.00 HVOICE');
    expect(() => getAccountHvoice(tester, 'bar', user1.accountName)).toThrow('Unknown tenant: bar for member: user1');

    // issue 120 hvoice on bar tenant
    await tester.contract.issue({
      to: tester.accountName,
      tenant: 'bar',
      quantity: '120.00 HVOICE',
      memo: 'increasing hvoice'
    });

    // transfer to user2.accountName
    await tester.contract.transfer({
      from: tester.accountName,
      to: user2.accountName,
      tenant: 'bar',
      quantity: '120.00 HVOICE',
      memo: 'increasing HVOICE'
    });

    expect(getIssuedHvoice(tester, 'foo')).toEqual('100.00 HVOICE');
    expect(getIssuedHvoice(tester, 'bar')).toEqual('120.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user1.accountName)).toEqual('100.00 HVOICE');
    expect(() => getAccountHvoice(tester, 'bar', user1.accountName)).toThrow('Unknown tenant: bar for member: user1');

    expect(getAccountHvoice(tester, 'bar', user2.accountName)).toEqual('120.00 HVOICE');
    expect(() => getAccountHvoice(tester, 'bar', user1.accountName)).toThrow('Unknown tenant: bar for member: user1');

    // issue 60 hvoice on foo tenant
    await tester.contract.issue({
      to: tester.accountName,
      tenant: 'foo',
      quantity: '60.00 HVOICE',
      memo: 'increasing hvoice'
    });

    // transfer to user2.accountName
    await tester.contract.transfer({
      from: tester.accountName,
      to: user2.accountName,
      tenant: 'foo',
      quantity: '60.00 HVOICE',
      memo: 'increasing HVOICE'
    });

    expect(getIssuedHvoice(tester, 'foo')).toEqual('160.00 HVOICE');
    expect(getIssuedHvoice(tester, 'bar')).toEqual('120.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user1.accountName)).toEqual('100.00 HVOICE');
    expect(() => getAccountHvoice(tester, 'bar', user1.accountName)).toThrow('Unknown tenant: bar for member: user1');

    expect(getAccountHvoice(tester, 'bar', user2.accountName)).toEqual('120.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user2.accountName)).toEqual('60.00 HVOICE');

    // issue 100 hvoice on foo tenant
    await tester.contract.issue({
      to: tester.accountName,
      tenant: 'foo',
      quantity: '100.00 HVOICE',
      memo: 'increasing hvoice'
    });

    // transfer to user2.accountName
    await tester.contract.transfer({
      from: tester.accountName,
      to: user2.accountName,
      tenant: 'foo',
      quantity: '100.00 HVOICE',
      memo: 'increasing HVOICE'
    });

    expect(getIssuedHvoice(tester, 'foo')).toEqual('260.00 HVOICE');
    expect(getIssuedHvoice(tester, 'bar')).toEqual('120.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user1.accountName)).toEqual('100.00 HVOICE');
    expect(() => getAccountHvoice(tester, 'bar', user1.accountName)).toThrow('Unknown tenant: bar for member: user1');

    expect(getAccountHvoice(tester, 'bar', user2.accountName)).toEqual('120.00 HVOICE');
    expect(getAccountHvoice(tester, 'foo', user2.accountName)).toEqual('160.00 HVOICE');
  });
});
