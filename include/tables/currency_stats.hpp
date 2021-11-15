#pragma once
#include <eosio/eosio.hpp>

namespace hypha {
    using eosio::asset;
    using eosio::name;
    using eosio::symbol_code;

    struct [[eosio::table]] currency_stats {
        uint64_t id;
        name     tenant;
        asset    supply;
        asset    max_supply;
        name     issuer;
        uint64_t decay_per_period_x10M;
        uint64_t decay_period;

        static uint128_t build_key(const name& tenant, const symbol_code& currency) {
            return ((uint128_t)tenant.value << 64) & currency.raw();
        }

        uint64_t primary_key() const {
            return id;
        }

        uint128_t by_tenant_and_code() const {
            return build_key(tenant, supply.symbol.code());
        }
    };

    typedef eosio::multi_index< "stat"_n, currency_stats > stats;
    using stats_by_key = eosio::multi_index<
            "stat"_n,
            currency_stats,
            eosio::indexed_by<"bykey"_n, eosio::const_mem_fun<currency_stats, uint128_t, &currency_stats::by_tenant_and_code>>
        >;
}