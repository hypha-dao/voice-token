#pragma once
#include <cstdint>

namespace hypha {

    struct DecayConfig {
        uint64_t decayPeriod;
        uint64_t evaluationTime;
        double   decayPerPeriod;
    };

    struct DecayResult {
        bool needsUpdate;
        uint64_t newBalance;
        uint64_t newPeriod;
    };

    const DecayResult decay(
            const uint64_t currentBalance,
            const uint64_t lastPeriod,
            const DecayConfig& config
    );
}
