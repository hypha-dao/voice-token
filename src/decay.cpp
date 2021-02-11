#include <decay.hpp>
#include <cmath>

namespace hypha {

    const DecayResult decay(
            const uint64_t currentBalance,
            const uint64_t lastPeriod,
            const DecayConfig &config
    ) {
        if (config.decayPerPeriod == 0 || config.decayPeriod == 0) {
            return DecayResult{
                    .needsUpdate = false,
                    .newPeriod   = lastPeriod,
                    .newBalance  = currentBalance
            };
        }

        uint64_t diff = config.evaluationTime - lastPeriod;
        uint64_t periods = diff / config.decayPeriod;
        if (periods >= 1) {
            return DecayResult{
                    .needsUpdate = true,
                    .newPeriod   = lastPeriod + periods * config.decayPeriod,
                    .newBalance  = (uint64_t) round(currentBalance * pow(1.0f - config.decayPerPeriod, periods))
            };
        }

        return DecayResult{
                .needsUpdate = false,
                .newPeriod   = lastPeriod,
                .newBalance  = currentBalance
        };
    }
}
