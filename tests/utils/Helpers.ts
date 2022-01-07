import Account from '@klevoya/hydra/lib/main/account';

const HVOICE_SYMBOL = 'HVOICE';

export const getIssuedHvoice = (contract: Account, tenant: string) => {
    const stat = contract.getTableRowsScoped('stat')[HVOICE_SYMBOL]?.find(s => s.tenant === tenant);
    if (stat) {
        return stat.supply;
    }

    throw new Error(`Unknown tenant: ${tenant}`);
};

export const getAccountHvoice = (contract: Account, tenant: string, member: string): string => {
    const account = contract.getTableRowsScoped('accounts')[member]?.find(a => a.tenant === tenant);
    if (account) {
        return account.balance;
    }

    throw new Error(`Unknown tenant: ${tenant} for member: ${member}`);
};
