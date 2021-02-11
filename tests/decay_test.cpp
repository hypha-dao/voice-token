#include <cassert>
#include <decay.hpp>

void test_decay_one_period() {
    auto result = hypha::decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 10, // exactly 1 period
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 90);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 10);
}

void test_decay_one_period_not_exact() {
    auto result = hypha::decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 15, // 5s past 1 period
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 90);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 10);
}

void test_decay_two_periods() {
    auto result = hypha::decay(100, 0, hypha::DecayConfig{
            .decayPeriod    = 10,
            .evaluationTime = 20, // exactly 2 periods
            .decayPerPeriod = 0.1
    });

    assert(result.newBalance == 81);
    assert(result.needsUpdate == true);
    assert(result.newPeriod == 20);
}

int main(int argc, char** argv) {
    test_decay_one_period();
    test_decay_one_period_not_exact();
    test_decay_two_periods();
    return 0;
}