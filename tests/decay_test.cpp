#include <cassert>
#include <decay.hpp>
#include <eosio/print.hpp>

constexpr uint64_t ONE_DAY_SECONDS = 60 * 60 * 24;

void test_decay_one_period() {
    auto result = hypha::Decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 10, // exactly 1 period
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 90);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 10);
}

void test_decay_one_period_not_exact() {
    auto result = hypha::Decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 15, // 5s past 1 period
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 90);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 10);
}

void test_decay_two_periods() {
    auto result = hypha::Decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 20, // exactly 2 periods
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 81);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 20);
}

void test_no_decay() {
    auto result = hypha::Decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 9, // almost 1 period
            .decayPerPeriod = 0.5
    });

    assert(result.newBalance == 100);
    assert(result.needsUpdate == false);
    assert(result.newPeriod == 0);
}

void test_decay_two_periods_50p() {
    auto result = hypha::Decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 29,
            .decayPerPeriod = 0.5
    });

    assert(result.newBalance == 25);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 20);
}

void test_decay_one_after_other() {
    auto result = hypha::Decay(100, 50, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 65,
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 90);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 60);
}

void test_decay_period_evaluated_in_the_past() {
    auto result = hypha::Decay(100, 50, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 40,
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 100);
    assert(result.needsUpdate == false);
    assert(result.newPeriod == 50);
}

void test_decay_multiple_decays() {

    const uint64_t daily_quantity = 100000;
    uint64_t balance = 0;
    uint64_t time = 0;

    for (std::size_t i = 0; i < 10; ++i) {
        balance += daily_quantity;

        auto result = hypha::Decay(balance, time, hypha::DecayConfig{
                .decayPeriod    = ONE_DAY_SECONDS,
                .evaluationTime = ONE_DAY_SECONDS * (i + 1),
                .decayPerPeriod = 0.02 // 2%
        });

        assert(result.needsUpdate == true);
        balance = result.newBalance;
        time = result.newPeriod;
    }

    assert(balance == 896343);
    assert(time == ONE_DAY_SECONDS * 10);
}

int main(int argc, char** argv) {
    test_decay_one_period();
    test_decay_one_period_not_exact();
    test_decay_two_periods();
    test_no_decay();
    test_decay_two_periods_50p();
    test_decay_one_after_other();
    test_decay_period_evaluated_in_the_past();
    test_decay_multiple_decays();
    return 0;
}