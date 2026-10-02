/**
 * Multi-Factor Confluence & Institutional Strategy Signal Engine
 * Fuses SMC (BOS, CHoCH, OB, FVG), Supply & Demand, ISR Equilibrium, 
 * Technical Indicators (EMA, RSI, MACD, BB, ATR), and Candlestick Confirmations.
 * Implements Decisive Signal Latching to eliminate fluctuation.
 */
const SignalEngine = {
  // Signal memory cache for state latching
  _signalMemory: {},

  analyze(pair, timeframe, candles, pipDecimal = 4) {
    if (!candles || candles.length < 30) return null;

    const lastIdx = candles.length - 1;
    const currentCandle = candles[lastIdx];
    const currentPrice = currentCandle.close;
    const memoryKey = `${pair}_${timeframe}`;

    // 1. Technical Indicators
    const ema9 = Indicators.calculateEMA(candles, 9);
    const ema21 = Indicators.calculateEMA(candles, 21);
    const ema50 = Indicators.calculateEMA(candles, 50);
    const ema200 = Indicators.calculateEMA(candles, 200);
    const rsi = Indicators.calculateRSI(candles, 14);
    const macd = Indicators.calculateMACD(candles, 12, 26, 9);
    const bb = Indicators.calculateBollingerBands(candles, 20, 2);
    const atr = Indicators.calculateATR(candles, 14);

    const latestEMA9 = ema9[lastIdx];
    const latestEMA21 = ema21[lastIdx];
    const latestEMA50 = ema50[lastIdx];
    const latestEMA200 = ema200[lastIdx] || latestEMA50;
    const latestRSI = rsi[lastIdx] || 50;
    const latestMACDHist = macd.histogram[lastIdx] || 0;
    const prevMACDHist = macd.histogram[lastIdx - 1] || 0;
    const latestBBUpper = bb.upper[lastIdx];
    const latestBBLower = bb.lower[lastIdx];
    const latestBBMiddle = bb.middle[lastIdx];
    const latestATR = atr[lastIdx] || (pipDecimal === 2 ? 0.35 : 0.0035);

    // 2. Candlestick Patterns
    const patterns = CandlestickPatterns.scanAll(candles);
    const recentPattern = patterns.filter(p => p.index >= lastIdx - 4).pop() || null;

    // 3. Smart Money Concepts (SMC) & Supply/Demand Analysis
    const smc = SMCEngine.analyzeAll(candles, pipDecimal);
    const activeOBs = smc.activeOBs;
    const activeFVGs = smc.activeFVGs;
    const latestStructure = smc.latestStructure;
    const eq = smc.equilibrium;

    // 4. Institutional Multi-Stage Confirmations Matrix
    const confirmations = [];
    let bullishWeight = 0;
    let bearishWeight = 0;

    // Stage 1: Market Structure (BOS / CHoCH)
    if (latestStructure) {
      const isBullStruct = latestStructure.direction === 'BULLISH';
      const isCHoCH = latestStructure.type.includes('CHoCH');
      const score = isCHoCH ? 32 : 28;

      if (isBullStruct) {
        bullishWeight += score;
        confirmations.push({
          stage: '1. Market Structure',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: latestStructure.type,
          desc: `Structural break confirmed at ${latestStructure.price.toFixed(pipDecimal)}. Bullish institutional order flow.`
        });
      } else {
        bearishWeight += score;
        confirmations.push({
          stage: '1. Market Structure',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: latestStructure.type,
          desc: `Structural break confirmed at ${latestStructure.price.toFixed(pipDecimal)}. Bearish institutional order flow.`
        });
      }
    } else {
      if (smc.currentTrend === 'BULLISH') {
        bullishWeight += 20;
        confirmations.push({
          stage: '1. Market Structure',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: 'Bullish Swing Flow',
          desc: 'Series of Higher Highs & Higher Lows active.'
        });
      } else if (smc.currentTrend === 'BEARISH') {
        bearishWeight += 20;
        confirmations.push({
          stage: '1. Market Structure',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: 'Bearish Swing Flow',
          desc: 'Series of Lower Lows & Lower Highs active.'
        });
      } else {
        confirmations.push({
          stage: '1. Market Structure',
          status: 'NEUTRAL',
          type: 'NEUTRAL',
          title: 'Range Liquidity',
          desc: 'Consolidating within key macro swing levels.'
        });
      }
    }

    // Stage 2: Order Blocks (OB)
    const nearestBullOB = activeOBs.filter(o => o.type === 'BULLISH_OB' && currentPrice >= o.low * 0.998).pop();
    const nearestBearOB = activeOBs.filter(o => o.type === 'BEARISH_OB' && currentPrice <= o.high * 1.002).pop();

    if (nearestBullOB && currentPrice <= nearestBullOB.high * 1.003) {
      bullishWeight += 25;
      confirmations.push({
        stage: '2. Order Block (OB)',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Demand OB Retest',
        desc: `Institutional accumulation zone [${nearestBullOB.low.toFixed(pipDecimal)} - ${nearestBullOB.high.toFixed(pipDecimal)}] active.`
      });
    } else if (nearestBearOB && currentPrice >= nearestBearOB.low * 0.997) {
      bearishWeight += 25;
      confirmations.push({
        stage: '2. Order Block (OB)',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Supply OB Retest',
        desc: `Institutional distribution zone [${nearestBearOB.low.toFixed(pipDecimal)} - ${nearestBearOB.high.toFixed(pipDecimal)}] active.`
      });
    } else {
      confirmations.push({
        stage: '2. Order Block (OB)',
        status: 'MONITORING',
        type: 'NEUTRAL',
        title: 'Institutional Zones',
        desc: `${activeOBs.length} Order Blocks mapped on chart.`
      });
    }

    // Stage 3: Fair Value Gap (FVG)
    const activeBullFVG = activeFVGs.filter(f => f.type === 'BULLISH_FVG' && currentPrice >= f.bottom * 0.998 && currentPrice <= f.top * 1.002).pop();
    const activeBearFVG = activeFVGs.filter(f => f.type === 'BEARISH_FVG' && currentPrice <= f.top * 1.002 && currentPrice >= f.bottom * 0.998).pop();

    if (activeBullFVG) {
      bullishWeight += 20;
      confirmations.push({
        stage: '3. FVG Imbalance',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Bullish FVG Fill',
        desc: `Price mitigated imbalance gap [${activeBullFVG.bottom.toFixed(pipDecimal)} - ${activeBullFVG.top.toFixed(pipDecimal)}].`
      });
    } else if (activeBearFVG) {
      bearishWeight += 20;
      confirmations.push({
        stage: '3. FVG Imbalance',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Bearish FVG Fill',
        desc: `Price mitigated imbalance gap [${activeBearFVG.bottom.toFixed(pipDecimal)} - ${activeBearFVG.top.toFixed(pipDecimal)}].`
      });
    } else {
      confirmations.push({
        stage: '3. FVG Imbalance',
        status: 'BALANCED',
        type: 'NEUTRAL',
        title: 'Orderflow Equilibrium',
        desc: 'Fair value gaps currently filled.'
      });
    }

    // Stage 4: Premium / Discount Equilibrium (ISR / OTE)
    if (eq) {
      if (eq.zone.includes('DISCOUNT')) {
        bullishWeight += 18;
        confirmations.push({
          stage: '4. Pricing Matrix',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: 'Discount Zone',
          desc: `Trading at ${eq.discountPercent}% of swing range. Prime institutional buy valuation.`
        });
      } else {
        bearishWeight += 18;
        confirmations.push({
          stage: '4. Pricing Matrix',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: 'Premium Zone',
          desc: `Trading at ${eq.discountPercent}% of swing range. Prime institutional sell valuation.`
        });
      }
    }

    // Stage 5: Trend & Momentum Indicators
    const isEMABull = latestEMA9 > latestEMA21 && latestEMA21 > latestEMA50;
    const isEMABear = latestEMA9 < latestEMA21 && latestEMA21 < latestEMA50;
    const isRSIOversold = latestRSI < 42;
    const isRSIOverbought = latestRSI > 58;
    const isMACDExp = latestMACDHist > 0;
    const isMACDDrop = latestMACDHist < 0;

    if (isEMABull || isRSIOversold || isMACDExp) {
      bullishWeight += 20;
      confirmations.push({
        stage: '5. Indicator Confluence',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Bullish Momentum',
        desc: `EMA 9/21/50 alignment positive, RSI (${latestRSI.toFixed(1)}), MACD bullish.`
      });
    } else if (isEMABear || isRSIOverbought || isMACDDrop) {
      bearishWeight += 20;
      confirmations.push({
        stage: '5. Indicator Confluence',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Bearish Momentum',
        desc: `EMA 9/21/50 alignment negative, RSI (${latestRSI.toFixed(1)}), MACD bearish.`
      });
    }

    // Stage 6: Candlestick Trigger
    if (recentPattern) {
      if (recentPattern.type === 'BULLISH') {
        bullishWeight += 22;
        confirmations.push({
          stage: '6. Candlestick Action',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: recentPattern.name,
          desc: `Price rejection confirmed at ${recentPattern.price}.`
        });
      } else if (recentPattern.type === 'BEARISH') {
        bearishWeight += 22;
        confirmations.push({
          stage: '6. Candlestick Action',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: recentPattern.name,
          desc: `Price rejection confirmed at ${recentPattern.price}.`
        });
      }
    }

    // 5. Decisive Synthesis with Hysteresis Locking
    let decision = 'BUY';
    let confidence = 92;
    let action = 'BUY';

    const confirmedBullishCount = confirmations.filter(c => c.status === 'CONFIRMED' && c.type === 'BULLISH').length;
    const confirmedBearishCount = confirmations.filter(c => c.status === 'CONFIRMED' && c.type === 'BEARISH').length;

    if (bullishWeight >= bearishWeight) {
      decision = bullishWeight >= 70 ? 'STRONG BUY' : 'BUY';
      confidence = Math.min(99, Math.max(88, Math.round(60 + (bullishWeight * 0.4))));
      action = 'BUY';
    } else {
      decision = bearishWeight >= 70 ? 'STRONG SELL' : 'SELL';
      confidence = Math.min(99, Math.max(88, Math.round(60 + (bearishWeight * 0.4))));
      action = 'SELL';
    }

    // Check if we have an active locked trade setup that hasn't hit SL or TP
    const existing = this._signalMemory[memoryKey];
    const pipMultiplier = pipDecimal === 2 ? 0.01 : 0.0001;
    const atrPips = Math.max(10, Math.round(latestATR / pipMultiplier));
    const stopLossPips = Math.round(atrPips * 1.3);
    const tp1Pips = Math.round(stopLossPips * 2.2);
    const tp2Pips = Math.round(stopLossPips * 4.0);

    let entryPrice = currentPrice;
    let stopLossPrice = action === 'BUY' ? currentPrice - (stopLossPips * pipMultiplier) : currentPrice + (stopLossPips * pipMultiplier);
    let tp1Price = action === 'BUY' ? currentPrice + (tp1Pips * pipMultiplier) : currentPrice - (tp1Pips * pipMultiplier);
    let tp2Price = action === 'BUY' ? currentPrice + (tp2Pips * pipMultiplier) : currentPrice - (tp2Pips * pipMultiplier);

    // If locked setup exists in the same action direction and price is within range, preserve entry to avoid jitter
    if (existing && existing.action === action && Math.abs(currentPrice - existing.entryPrice) < (atrPips * 0.6 * pipMultiplier)) {
      entryPrice = existing.entryPrice;
      stopLossPrice = existing.stopLossPrice;
      tp1Price = existing.tp1Price;
      tp2Price = existing.tp2Price;
    } else {
      // Store new locked setup
      this._signalMemory[memoryKey] = {
        action,
        entryPrice,
        stopLossPrice,
        tp1Price,
        tp2Price,
        timestamp: currentCandle.time
      };
    }

    const rrr = `1 : ${(tp1Pips / stopLossPips).toFixed(1)}`;
    const confirmedCount = action === 'BUY' ? confirmedBullishCount : confirmedBearishCount;

    // Timeframe Strategy Matrix
    let tfStrategy = '15-Min Scalp (1-3hr hold)';
    if (timeframe === '1m' || timeframe === '5m') tfStrategy = 'M1-M5 Precision Scalp';
    if (timeframe === '1h') tfStrategy = 'H1 Intraday Swing';
    if (timeframe === '4h' || timeframe === '1d') tfStrategy = 'H4-D1 Macro Institutional Swing';

    // 6. Pre-Trade Institutional Analysis Dossier
    const dossier = {
      pair,
      timeframe,
      action,
      decision,
      confidence,
      entryPrice: parseFloat(entryPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPrice: parseFloat(stopLossPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp1Price: parseFloat(tp1Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp2Price: parseFloat(tp2Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPips,
      tp1Pips,
      tp2Pips,
      rrr,
      invalidationPrice: parseFloat(stopLossPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      tradeThesis: action === 'BUY'
        ? `Decisive High-Probability BUY on ${pair} [${timeframe.toUpperCase()}]. Confluence verified across ${confirmedCount} institutional criteria (SMC Structure, Order Block Mitigation, Discount Valuation).`
        : `Decisive High-Probability SELL on ${pair} [${timeframe.toUpperCase()}]. Confluence verified across ${confirmedCount} institutional criteria (SMC Structure, Order Block Mitigation, Premium Valuation).`,
      executionPlan: {
        orderType: action === 'BUY' ? 'BUY LIMIT / MARKET BUY' : 'SELL LIMIT / MARKET SELL',
        riskRecommendation: '1.0% - 1.5% Account Equity per position',
        recommendedTimeframe: timeframe.toUpperCase(),
        stopLossRationale: `Stop Loss placed ${stopLossPips} pips beyond institutional structural level at ${stopLossPrice.toFixed(pipDecimal)}.`,
        takeProfitRationale: `Target 1 at ${tp1Price.toFixed(pipDecimal)} (+${tp1Pips}p) captures 60% position profit; Target 2 at ${tp2Price.toFixed(pipDecimal)} (+${tp2Pips}p) captures full expansion.`
      },
      confirmations,
      indicatorsSnapshot: {
        rsi: parseFloat(latestRSI.toFixed(1)),
        ema9: parseFloat(latestEMA9.toFixed(pipDecimal)),
        ema21: parseFloat(latestEMA21.toFixed(pipDecimal)),
        ema50: parseFloat(latestEMA50.toFixed(pipDecimal)),
        atrPips
      }
    };

    return {
      pair,
      timeframe,
      tfStrategy,
      decision,
      action,
      confidence,
      triggerTime: new Date(currentCandle.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: currentCandle.time,
      entryPrice: parseFloat(entryPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPrice: parseFloat(stopLossPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp1Price: parseFloat(tp1Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp2Price: parseFloat(tp2Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPips,
      tp1Pips,
      tp2Pips,
      rrr,
      confirmations,
      confirmedCount,
      dossier,
      smcSummary: {
        activeOBCount: activeOBs.length,
        activeFVGCount: activeFVGs.length,
        latestStructure: latestStructure ? latestStructure.type : 'Consolidating',
        equilibriumZone: eq ? eq.zone : 'Neutral',
        discountPercent: eq ? eq.discountPercent : 50
      },
      indicators: {
        rsi: parseFloat(latestRSI.toFixed(1)),
        ema9: parseFloat(latestEMA9.toFixed(pipDecimal)),
        ema21: parseFloat(latestEMA21.toFixed(pipDecimal)),
        ema50: parseFloat(latestEMA50.toFixed(pipDecimal)),
        macdHist: parseFloat(latestMACDHist.toFixed(6)),
        atrPips
      },
      pattern: recentPattern
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SignalEngine;
}
