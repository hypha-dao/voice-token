#include <voice.hpp>
#include <decay.hpp>
#include <eosio/system.hpp>
#include <tables/old_voice.hpp>

namespace hypha {

    constexpr uint64_t DECAY_PER_PERIOD_X10M = 10000000;

    void voice::migratestat(const name& tenant) {
        require_auth( get_self() );
        eosio::symbol_code hvoice_symbol_code("HVOICE");

        old_voice::stats old_stats(get_self(), hvoice_symbol_code.raw());
        auto existing = old_stats.find(hvoice_symbol_code.raw());
        check( existing != old_stats.end(), "token with symbol does not exists" );

        // Copy
        hypha::stats new_stats(get_self(), hvoice_symbol_code.raw());
        auto index = new_stats.get_index<name("bykey")>();

        auto existingInNewStats = index.find( currency_statsv2::build_key(tenant, hvoice_symbol_code) );
        if (existingInNewStats != index.end()) {
            index.erase(existingInNewStats);
        }

        new_stats.emplace( get_self(), [&]( auto& s ) {
            s.id                     = new_stats.available_primary_key();
            s.supply                 = existing->supply;
            s.max_supply             = existing->max_supply;
            s.issuer                 = existing->issuer;
            s.decay_per_period_x10M  = existing->decay_per_period_x10M;
            s.decay_period           = existing->decay_period;
            s.tenant                 = tenant;
        });
    }

    void voice::migrateacc(const name& tenant, const std::vector<name> accounts) {
        require_auth( get_self() );
        eosio::symbol_code hvoice_symbol_code("HVOICE");

        for (name account_name: accounts) {
            old_voice::accounts old_accounts(get_self(), account_name.value);

            const auto old_account = old_accounts.find( hvoice_symbol_code.raw());
            if (old_account == old_accounts.end()) {
                continue;
            }

            hypha::accounts new_accounts(get_self(), account_name.value);

            auto index = new_accounts.get_index<name("bykey")>();

            auto existingInNewAccount = index.find( accountv2::build_key(tenant, hvoice_symbol_code) );
            if (existingInNewAccount != index.end()) {
                index.erase(existingInNewAccount);
            }

            new_accounts.emplace(get_self(), [&](auto& a) {
                a.id                = new_accounts.available_primary_key();
                a.tenant            = tenant;
                a.balance           = old_account->balance;
                a.last_decay_period = old_account->last_decay_period;
            });
        }
    }

    void voice::del(const name& tenant, const asset& symbol)
    {
        require_auth( get_self() );
        auto sym = symbol.symbol;
        check( sym.is_valid(), "invalid symbol name" );
        stats statstable( get_self(), sym.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        auto existing = index.find( currency_statsv2::build_key(tenant, sym.code()));
        check( existing != index.end(), "token with symbol does not exists" );
        index.erase(existing);
    }

    void voice::delbal(const name& tenant, const name& account, const symbol& symbol)
    {
        eosio::check( 
            eosio::has_auth(get_self()) || 
            eosio::has_auth(account),
            std::string("Required auth from ") + get_self().to_string() + " or " + account.to_string()
        );

        check( symbol.is_valid(), "invalid symbol name" );

        accounts a_t( get_self(), account.value );
        auto accountByKey = a_t.get_index<name("bykey")>();
        auto accIt = accountByKey.find(
            accountv2::build_key(tenant, symbol.code())
        );

        check(
            accIt != accountByKey.end(),
            "The account doesn't have a balance entry for the provided token and tenant"
        );

        stats s_t( get_self(), symbol.code().raw() );
        auto statByKey = s_t.get_index<name("bykey")>();
        auto statIt = statByKey.find(
            currency_statsv2::build_key(tenant, symbol.code())
        );

        check(
            statIt != statByKey.end(),
            "token of specified symbol and tenant does not exist"
        );

        statByKey.modify( statIt, same_payer, [&]( currency_statsv2& s ) {
            s.supply -= accIt->balance;
        });

        accountByKey.erase(accIt);
    }

    void voice::create( const name&    tenant,
                        const name&    issuer,
                        const asset&   maximum_supply,
                        const uint64_t decay_period,
                        const uint64_t decay_per_period_x10M )
    {
        require_auth( get_self() );

        auto sym = maximum_supply.symbol;
        check( sym.is_valid(), "invalid symbol name" );
        check( maximum_supply.is_valid(), "invalid supply");
        check( decay_period >= 0, "invalid decay_period");
        check( decay_per_period_x10M >= 0 && decay_per_period_x10M <= DECAY_PER_PERIOD_X10M, "decay_per_period_x10M must be between 0 and 10,000,000");
        // remove this check because we allow -1 to be used for the max supply of a mintable token
        //  check( maximum_supply.amount > 0, "max-supply must be positive");

        stats statstable( get_self(), sym.code().raw() );
        auto index = statstable.get_index<name("bykey")>();

        auto existing = index.find( currency_statsv2::build_key(tenant, sym.code()) );
        check( existing == index.end(), "token with symbol and tenant already exists" );

        statstable.emplace( get_self(), [&]( auto& s ) {
            s.id                     = statstable.available_primary_key();
            s.tenant                 = tenant;
            s.supply.symbol          = maximum_supply.symbol;
            s.max_supply             = maximum_supply;
            s.issuer                 = issuer;
            s.decay_per_period_x10M  = decay_per_period_x10M;
            s.decay_period           = decay_period;
        });
    }


    void voice::issue(const name& tenant, const name& to, const asset& quantity, const string& memo)
    {
        auto sym = quantity.symbol;
        check( sym.is_valid(), "invalid symbol name" );
        check( memo.size() <= 256, "memo has more than 256 bytes" );

        stats statstable( get_self(), sym.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        auto existing = index.find( currency_statsv2::build_key(tenant, sym.code()) );
        check( existing != index.end(), "token with symbol does not exist, create token before issue" );
        const auto& st = *existing;
        check( to == st.issuer, "tokens can only be issued to issuer account" );

        require_auth( st.issuer );
        check( quantity.is_valid(), "invalid quantity" );
        check( quantity.amount > 0, "must issue positive quantity" );

        check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

        // if the token is mintable, -1 is used as the max_supply
        if (st.max_supply.amount >= 0) {
            check( quantity.amount <= st.max_supply.amount - st.supply.amount, "quantity exceeds available supply");
        }

        statstable.modify( st, same_payer, [&]( auto& s ) {
            s.supply += quantity;
        });

        add_balance( tenant, st.issuer, quantity, st.issuer );
    }

    void voice::transfer( const name&    tenant,
                          const name&    from,
                          const name&    to,
                          const asset&   quantity,
                          const string&  memo )
    {
        check( from != to, "cannot transfer to self" );
        require_auth( from );
        check( is_account( to ), "to account does not exist");
        auto sym = quantity.symbol.code();
        stats statstable( get_self(), sym.raw() );
        auto index = statstable.get_index<name("bykey")>();
        const auto& st = index.get( currency_statsv2::build_key(tenant, sym) );

        check( from == st.issuer, "tokens can only be transferred by issuer account" );
        require_recipient( from );
        require_recipient( to );

        check( quantity.is_valid(), "invalid quantity" );
        check( quantity.amount > 0, "must transfer positive quantity" );
        check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
        check( memo.size() <= 256, "memo has more than 256 bytes" );

        auto payer = has_auth( to ) ? to : from;

        sub_balance( tenant, from, quantity );
        add_balance( tenant, to, quantity, payer );
    }
    
    void voice::burn( const name&    tenant,
                          const name&    from,
                          const asset&   quantity,
                          const string&  memo )
    {
        require_auth( from );
        auto sym = quantity.symbol.code();
        stats statstable( get_self(), sym.raw() );
        auto index = statstable.get_index<name("bykey")>();
        const auto& st = index.get( currency_statsv2::build_key(tenant, sym) );

        require_recipient( from );

        check( quantity.is_valid(), "invalid quantity" );
        check( quantity.amount > 0, "must burn positive quantity" );
        check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
        check( memo.size() <= 256, "memo has more than 256 bytes" );

        sub_balance( tenant, from, quantity );
        
        update_issued(tenant, -1 * quantity);
    }


    void voice::decay(const name& tenant, const name& owner, symbol symbol) {
        stats statstable( get_self(), symbol.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        auto existing = index.find( currency_statsv2::build_key(tenant, symbol.code()) );
        check( existing != index.end(), "token with symbol does not exist, create token before issue" );

        accounts from_acnts(get_self(), owner.value);
        auto account_index = from_acnts.get_index<name("bykey")>();
        const auto from = account_index.find( accountv2::build_key(tenant, symbol.code()) );
        if (from == account_index.end()) {
            // No balance exists yet, nothing to do
            return;
        }

        const DecayResult result = hypha::decay(
                from->balance.amount,
                from->last_decay_period,
                DecayConfig{
                    .decayPeriod    = existing->decay_period,
                    .decayPerPeriod = existing->decay_per_period_x10M / (double) DECAY_PER_PERIOD_X10M,
                    .evaluationTime = this->get_current_time()
                }
        );

        if (result.needsUpdate) {
            eosio::asset updated_issued = from->balance;
            updated_issued.amount = result.newBalance - updated_issued.amount;
            update_issued(tenant, updated_issued);
            account_index.modify( from, get_self(), [&]( auto& a ) {
                a.balance.amount = result.newBalance;
                a.last_decay_period = result.newPeriod;
            });
        }
    }

    void voice::moddecay(const name& tenant, symbol symbol, uint64_t new_decay_period, uint64_t new_decay_per_periox_x10m)
    {
        require_auth( get_self() );
        
        stats statstable( get_self(), symbol.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        auto existing = index.find( currency_statsv2::build_key(tenant, symbol.code()) );
        check( existing != index.end(), "token with symbol and tenant does not exist, create token before editing it" );

        index.modify(existing, same_payer, [&](currency_statsv2& stat) {
            stat.decay_period = new_decay_period;
            stat.decay_per_period_x10M = new_decay_per_periox_x10m;
        });
    }

    void voice::sub_balance(const name& tenant, const name& owner, const asset& value ) {
        accounts from_acnts( get_self(), owner.value );
        auto index = from_acnts.get_index<name("bykey")>();

        const auto& from = index.get( accountv2::build_key(tenant, value.symbol.code()), "no balance object found" );
        check( from.balance.amount >= value.amount, "overdrawn balance" );

        from_acnts.modify( from, owner, [&]( auto& a ) {
            a.balance -= value;
        });
    }

    void voice::add_balance(const name& tenant, const name& owner, const asset& value, const name& ram_payer )
    {
        this->decay(tenant, owner, value.symbol);
        accounts to_acnts( get_self(), owner.value );
        auto index = to_acnts.get_index<name("bykey")>();
        auto to = index.find( accountv2::build_key(tenant, value.symbol.code()) );
        if( to == index.end() ) {
            to_acnts.emplace( ram_payer, [&]( auto& a ){
                a.id = to_acnts.available_primary_key();
                a.balance = value;
                a.tenant = tenant;
                a.last_decay_period = this->get_current_time();
            });
        } else {
            index.modify( to, same_payer, [&]( auto& a ) {
                a.balance += value;
            });
        }
    }

    void voice::update_issued(const name& tenant, const asset& quantity)
    {
        auto sym = quantity.symbol;
        check( sym.is_valid(), "invalid symbol name" );

        stats statstable( get_self(), sym.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        auto existing = index.find(currency_statsv2::build_key(tenant, sym.code()));
        check( existing != index.end(), "token with symbol does not exist" );
        const auto& st = *existing;

        check( quantity.is_valid(), "invalid quantity" );
        check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

        statstable.modify( st, same_payer, [&]( auto& s ) {
            s.supply += quantity;
        });
    }

    void voice::open(const name& tenant, const name& owner, const symbol& symbol, const name& ram_payer)
    {
        require_auth( ram_payer );

        check( is_account( owner ), "owner account does not exist" );

        stats statstable( get_self(), symbol.code().raw() );
        auto index = statstable.get_index<name("bykey")>();
        const auto& st = index.get( currency_statsv2::build_key(tenant, symbol.code()), "symbol does not exist" );
        check( st.supply.symbol == symbol, "symbol precision mismatch" );

        accounts acnts( get_self(), owner.value );
        auto account_index = acnts.get_index<name("bykey")>();
        auto it = account_index.find( accountv2::build_key(tenant, symbol.code()) );
        if( it == account_index.end() ) {
            acnts.emplace( ram_payer, [&]( auto& a ){
                a.id = acnts.available_primary_key();
                a.tenant = tenant;
                a.balance = asset{0, symbol};
                a.last_decay_period = this->get_current_time();
            });
        }
    }

    void voice::close(const name& tenant, const name& owner, const symbol& symbol )
    {
        require_auth( owner );
        accounts acnts( get_self(), owner.value );
        auto index = acnts.get_index<name("bykey")>();
        auto it = index.find( accountv2::build_key(tenant, symbol.code()) );
        check( it != index.end(), "Balance row already deleted or never existed. Action won't have any effect." );
        check( it->balance.amount == 0, "Cannot close because the balance is not zero." );
        index.erase( it );
    }

    uint64_t voice::get_current_time() {
        return eosio::current_time_point().sec_since_epoch();

    }
}
