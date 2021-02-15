#include <voice.hpp>
#include <decay.hpp>
#include <eosio/system.hpp>
#include <document_graph/edge.hpp>
#include <document_graph/document.hpp>
#include <trail.hpp>

namespace hypha {

    void voice::migrate(name trailContract)
    {
        require_auth( get_self() );
        symbol S_HVOICE("HVOICE", 2);

        uint64_t index = eosio::name("member").value;
        Edge::edge_table e_t(get_self(), get_self().value);
        auto edge_name_idx = e_t.get_index<eosio::name("edgename")>();
        auto edgeItr = edge_name_idx.find(index);
        uint64_t currentTime = this->get_current_time();

        while (edgeItr != edge_name_idx.end() && edgeItr->by_edge_name() == index)
        {
            Edge edge = *edgeItr;
            Document memberDoc(get_self(), edge.getToNode());
            auto memberDetails = memberDoc.getContentWrapper().get("details", "member");
            if (memberDetails.first != -1)
            {
                eosio::name memberName = memberDetails.second->getAs<eosio::name>();
                trailservice::trail::voters_table v_t(trailContract, memberName.value);
                auto v_itr = v_t.find(S_HVOICE.code().raw());
                if (v_itr != v_t.end()) {
                    eosio::asset hvoice = v_itr->liquid;

                    accounts accountstable( get_self(), memberName.value );
                    auto accountItr = accountstable.find( S_HVOICE.raw() );
                    if (accountItr != accountstable.end()) {
                        accountstable.modify( accountItr, get_self(), [&]( auto& a ) {
                            a.balance.amount = hvoice.amount;
                            a.last_decay_period = currentTime;
                        });
                    } else {
                        accountstable.emplace(get_self(), [&]( auto& a ) {
                            a.balance = hvoice;
                            a.last_decay_period = currentTime;
                        });
                    }
                }
            }
            edgeItr++;
        }
    }

    void voice::create( const name&    issuer,
                        const asset&   maximum_supply,
                        const uint64_t decay_period,
                        const float    decay_per_period )
    {
        require_auth( get_self() );

        auto sym = maximum_supply.symbol;
        check( sym.is_valid(), "invalid symbol name" );
        check( maximum_supply.is_valid(), "invalid supply");
        check( decay_period >= 0, "invalid decay_period");
        check( decay_per_period >= 0 && decay_per_period <= 1, "decay_per_period must be between 0 and 1");
        // remove this check because we allow -1 to be used for the max supply of a mintable token
        //  check( maximum_supply.amount > 0, "max-supply must be positive");

        stats statstable( get_self(), sym.code().raw() );
        auto existing = statstable.find( sym.code().raw() );
        check( existing == statstable.end(), "token with symbol already exists" );

        statstable.emplace( get_self(), [&]( auto& s ) {
            s.supply.symbol     = maximum_supply.symbol;
            s.max_supply        = maximum_supply;
            s.issuer            = issuer;
            s.decay_per_period  = decay_per_period;
            s.decay_period      = decay_period;
        });
    }


    void voice::issue( const name& to, const asset& quantity, const string& memo )
    {
        auto sym = quantity.symbol;
        check( sym.is_valid(), "invalid symbol name" );
        check( memo.size() <= 256, "memo has more than 256 bytes" );

        stats statstable( get_self(), sym.code().raw() );
        auto existing = statstable.find( sym.code().raw() );
        check( existing != statstable.end(), "token with symbol does not exist, create token before issue" );
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

        add_balance( st.issuer, quantity, st.issuer );
    }

    void voice::decay(const name& owner, symbol symbol) {
        stats statstable( get_self(), symbol.code().raw() );
        auto existing = statstable.find( symbol.code().raw() );
        check( existing != statstable.end(), "token with symbol does not exist, create token before issue" );

        accounts from_acnts(get_self(), owner.value);
        const auto& from = from_acnts.get( symbol.code().raw(), "no balance object found" );

        const DecayResult result = hypha::decay(
                from.balance.amount,
                from.last_decay_period,
                DecayConfig{
                    .decayPeriod    = existing->decay_period,
                    .decayPerPeriod = existing->decay_per_period,
                    .evaluationTime = this->get_current_time()
                }
        );

        if (result.needsUpdate) {
            from_acnts.modify( from, owner, [&]( auto& a ) {
                a.balance.amount = result.newBalance;
                a.last_decay_period = result.newPeriod;
            });
        }
    }

    void voice::sub_balance( const name& owner, const asset& value ) {
        this->decay(owner, value.symbol);
        accounts from_acnts( get_self(), owner.value );

        const auto& from = from_acnts.get( value.symbol.code().raw(), "no balance object found" );
        check( from.balance.amount >= value.amount, "overdrawn balance" );

        from_acnts.modify( from, owner, [&]( auto& a ) {
            a.balance -= value;
        });
    }

    void voice::add_balance( const name& owner, const asset& value, const name& ram_payer )
    {
        this->decay(owner, value.symbol);
        accounts to_acnts( get_self(), owner.value );
        auto to = to_acnts.find( value.symbol.code().raw() );
        if( to == to_acnts.end() ) {
            to_acnts.emplace( ram_payer, [&]( auto& a ){
                a.balance = value;
            });
        } else {
            to_acnts.modify( to, same_payer, [&]( auto& a ) {
                a.balance += value;
            });
        }
    }

    void voice::open( const name& owner, const symbol& symbol, const name& ram_payer )
    {
        require_auth( ram_payer );

        check( is_account( owner ), "owner account does not exist" );

        auto sym_code_raw = symbol.code().raw();
        stats statstable( get_self(), sym_code_raw );
        const auto& st = statstable.get( sym_code_raw, "symbol does not exist" );
        check( st.supply.symbol == symbol, "symbol precision mismatch" );

        accounts acnts( get_self(), owner.value );
        auto it = acnts.find( sym_code_raw );
        if( it == acnts.end() ) {
            acnts.emplace( ram_payer, [&]( auto& a ){
                a.balance = asset{0, symbol};
                a.last_decay_period = this->get_current_time();
            });
        }
    }

    void voice::close( const name& owner, const symbol& symbol )
    {
        require_auth( owner );
        accounts acnts( get_self(), owner.value );
        auto it = acnts.find( symbol.code().raw() );
        check( it != acnts.end(), "Balance row already deleted or never existed. Action won't have any effect." );
        check( it->balance.amount == 0, "Cannot close because the balance is not zero." );
        acnts.erase( it );
    }

    uint64_t voice::get_current_time() {
        return eosio::time_point().sec_since_epoch();

    }
}