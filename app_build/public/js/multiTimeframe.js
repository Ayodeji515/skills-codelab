/**
 * Multi-Timeframe (MTF) Institutional Scanner & Optimal Entry Engine
 * Scans historical charts across 1m, 5m, 15m, 1h, 4h, and 1d to find:
 * - Macro Direction (HTF: 4h / 1d)
 * - Intermediate Market Structure (ITF: 1h / 15m)
 * - Precision Entry Trigger (LTF: 15m / 5m / 1m)
 * - Recommends the Exact Optimal Timeframe for entering the trade with highest confluence.
 */
const MultiTimeframeScanner = {
  // Scans all timeframes for a given pair
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
            latestStructure: smc.latestStructure ? smc.latestStructure.type : 'Range',
            activeOBs: smc.activeOBs.length,
            activeFVGs: smc.activeFVGs.length,
            equilibrium: smc.equilibrium ? smc.equilibrium.zone.split(' ')[0] : 'Neutral',
            signal: signal ? signal.action : 'HOLD',
            confidence: signal ? signal.confidence : 50,
            recentPattern: patterns.length ? patterns[patterns.length - 1].name : 'None',
            detailedSignal: signal
          };
        }
      } catch (e) {
        console.warn(`Error scanning timeframe ${tf} for ${pair}:`, e);
      }
    }

    // Determine the Exact Best Timeframe to Enter
    const recommendation = this.determineBestEntryTimeframe(results, pipDecimal);

    return {
      pair,
      timeframeResults: results,
      recommendation
    };
  },

  determineBestEntryTimeframe(mtfResults, pipDecimal = 4) {
    const tfs = ['1d', '4h', '1h', '15m', '5m', '1m'];
    let macroTrend = 'NEUTRAL';
    let macroBullScore = 0;
    let macroBearScore = 0;

    // 1. Evaluate Macro Bias (1D & 4H)
    ['1d', '4h'].forEach(tf => {
      if (mtfResults[tf]) {
        if (mtfResults[tf].trend === 'BULLISH' || mtfResults[tf].signal === 'BUY') macroBullScore += 2;
        if (mtfResults[tf].trend === 'BEARISH' || mtfResults[tf].signal === 'SELL') macroBearScore += 2;
      }
    });

    if (macroBullScore > macroBearScore) macroTrend = 'BULLISH';
    else if (macroBearScore > macroBullScore) macroTrend = 'BEARISH';

    // 2. Score intermediate and lower timeframes for entry precision
    let bestTf = '15m';
    let highestScore = -1;
    let bestRationale = '';

    ['15m', '5m', '1h', '1m', '4h'].forEach(tf => {
      const data = mtfResults[tf];
      if (!data) return;

      let score = data.confidence;
      // Bonus if aligned with macro trend
      if (data.signal === 'BUY' && macroTrend === 'BULLISH') score += 20;
      if (data.signal === 'SELL' && macroTrend === 'BEARISH') score += 20;
      if (data.activeOBs > 0) score += 10;
      if (data.activeFVGs > 0) score += 10;
      if (data.recentPattern !== 'None') score += 15;

      if (score > highestScore) {
        highestScore = score;
        bestTf = tf;
        bestRationale = `${tf.toUpperCase()} exhibits maximum institutional confluence (${score}% composite score) aligning with ${macroTrend} macro trend, featuring fresh ${data.activeOBs} Order Blocks and active ${data.recentPattern} candlestick validation.`;
      }
    });

    const targetSignal = mtfResults[bestTf] ? mtfResults[bestTf].detailedSignal : null;

    return {
      optimalTimeframe: bestTf,
      optimalAction: targetSignal ? targetSignal.action : (macroTrend === 'BULLISH' ? 'BUY' : 'SELL'),
      macroTrend,
      compositeScore: Math.min(99, highestScore),
      rationale: bestRationale,
      targetSignal
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultiTimeframeScanner;
}
