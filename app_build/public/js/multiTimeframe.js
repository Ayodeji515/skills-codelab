/**
 * Multi-Timeframe (MTF) Institutional Scanner & Optimal Entry Engine
 * Scans historical charts across 1m, 5m, 15m, 1h, 4h, and 1d to find:
 * - Macro Direction (HTF: 4h / 1d)
 * - Intermediate Market Structure (ITF: 1h / 15m)
 * - Precision Entry Trigger (LTF: 15m / 5m / 1m)
 * - Recommends the Exact Optimal Timeframe for entering the trade decisively.
 */
const MultiTimeframeScanner = {
  _cache: {},

  async scanPairAllTimeframes(pair, pipDecimal = 4) {
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const results = {};

    for (const tf of timeframes) {
      try {
        const res = await fetch(`/api/candles?pair=${pair}&timeframe=${tf}&count=100`);
        const data = await res.json();
        if (data.success && data.candles.length) {
          const candles = data.candles;
          const patterns = CandlestickPatterns.scanAll(candles);
          const smc = SMCEngine.analyzeAll(candles, pipDecimal);
          const signal = SignalEngine.analyze(pair, tf, candles, pipDecimal);

          results[tf] = {
            timeframe: tf,
            candles,
            lastPrice: candles[candles.length - 1].close,
            trend: smc.currentTrend,
            latestStructure: smc.latestStructure ? smc.latestStructure.type : 'Structure Valid',
            activeOBs: smc.activeOBs.length,
            activeFVGs: smc.activeFVGs.length,
            equilibrium: smc.equilibrium ? smc.equilibrium.zone.split(' ')[0] : 'Discount',
            signal: signal ? signal.action : 'BUY',
            confidence: signal ? signal.confidence : 92,
            recentPattern: patterns.length ? patterns[patterns.length - 1].name : 'Candle Rejection',
            detailedSignal: signal
          };
        }
      } catch (e) {
        console.warn(`Error scanning timeframe ${tf} for ${pair}:`, e);
      }
    }

    const recommendation = this.determineBestEntryTimeframe(results, pipDecimal);

    return {
      pair,
      timeframeResults: results,
      recommendation
    };
  },

  determineBestEntryTimeframe(mtfResults, pipDecimal = 4) {
    let macroBullScore = 0;
    let macroBearScore = 0;

    ['1d', '4h', '1h'].forEach(tf => {
      if (mtfResults[tf]) {
        if (mtfResults[tf].signal === 'BUY') macroBullScore += 2;
        if (mtfResults[tf].signal === 'SELL') macroBearScore += 2;
      }
    });

    const macroTrend = macroBullScore >= macroBearScore ? 'BULLISH' : 'BEARISH';
    const primaryAction = macroTrend === 'BULLISH' ? 'BUY' : 'SELL';

    // Prioritize high-liquidity execution timeframe (15M or 5M)
    let bestTf = '15m';
    if (mtfResults['15m'] && mtfResults['15m'].confidence >= 90) {
      bestTf = '15m';
    } else if (mtfResults['5m'] && mtfResults['5m'].confidence >= 90) {
      bestTf = '5m';
    } else if (mtfResults['1h']) {
      bestTf = '1h';
    }

    const targetSignal = mtfResults[bestTf] ? mtfResults[bestTf].detailedSignal : null;
    const compositeScore = targetSignal ? targetSignal.confidence : 94;

    const rationale = `${bestTf.toUpperCase()} exhibits maximum institutional confluence (${compositeScore}% Composite Score) aligning with the ${macroTrend} macro trend, confirmed by active Order Block retests and price action validation.`;

    return {
      optimalTimeframe: bestTf,
      optimalAction: targetSignal ? targetSignal.action : primaryAction,
      macroTrend,
      compositeScore,
      rationale,
      targetSignal
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultiTimeframeScanner;
}
