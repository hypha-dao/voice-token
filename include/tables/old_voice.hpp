#include <eosio/eosio.hpp>

namespace old_voice {
    struct [[eosio::table, eosio::contract("voice.hypha")]] account {
        eosio::asset    balance;
        uint64_t last_decay_period;
        uint64_t primary_key() const { return balance.symbol.code().raw(); }
    };

    struct [[eosio::table, eosio::contract("voice.hypha")]] currency_stats {
        eosio::asset    supply;
        eosio::asset    max_supply;
        eosio::name     issuer;
        uint64_t decay_per_period_x10M;
        uint64_t decay_period;

        uint64_t primary_key() const { return supply.symbol.code().raw(); }
    };

    typedef eosio::multi_index< "accounts"_n, account > accounts;
    typedef eosio::multi_index< "stat"_n, currency_stats > stats;
}
