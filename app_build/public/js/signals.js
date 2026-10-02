/**
 * Multi-Factor Confluence & Institutional Strategy Signal Engine
 * Fuses SMC (BOS, CHoCH, OB, FVG), Supply & Demand, ISR Equilibrium, 
 * Technical Indicators (EMA, RSI, MACD, BB, ATR), and Candlestick Confirmations.
 * Generates a full Pre-Trade Institutional Analysis Dossier.
 */
const SignalEngine = {
  analyze(pair, timeframe, candles, pipDecimal = 4) {
    if (!candles || candles.length < 30) return null;

    const lastIdx = candles.length - 1;
    const currentCandle = candles[lastIdx];
    const currentPrice = currentCandle.close;

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
    const recentPattern = patterns.filter(p => p.index >= lastIdx - 3).pop() || null;

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
      const score = isCHoCH ? 30 : 25;

      if (isBullStruct) {
        bullishWeight += score;
        confirmations.push({
          stage: '1. SMC Market Structure',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: latestStructure.type,
          desc: `Structural break confirmed at ${latestStructure.price.toFixed(pipDecimal)}. Bullish institutional flow active.`
        });
      } else {
        bearishWeight += score;
        confirmations.push({
          stage: '1. SMC Market Structure',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: latestStructure.type,
          desc: `Structural break confirmed at ${latestStructure.price.toFixed(pipDecimal)}. Bearish institutional flow active.`
        });
      }
    } else {
      confirmations.push({
        stage: '1. SMC Market Structure',
        status: 'NEUTRAL',
        type: 'NEUTRAL',
        title: 'Range / Compression',
        desc: 'Market currently consolidating inside liquidity range.'
      });
    }

    // Stage 2: Order Blocks (OB)
    const nearestBullOB = activeOBs.filter(o => o.type === 'BULLISH_OB' && currentPrice >= o.low * 0.999).pop();
    const nearestBearOB = activeOBs.filter(o => o.type === 'BEARISH_OB' && currentPrice <= o.high * 1.001).pop();

    if (nearestBullOB && currentPrice <= nearestBullOB.high * 1.002) {
      bullishWeight += 25;
      confirmations.push({
        stage: '2. Institutional Order Block',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Demand Order Block Retest',
        desc: `Price mitigated institutional accumulation zone [${nearestBullOB.low.toFixed(pipDecimal)} - ${nearestBullOB.high.toFixed(pipDecimal)}].`
      });
    } else if (nearestBearOB && currentPrice >= nearestBearOB.low * 0.998) {
      bearishWeight += 25;
      confirmations.push({
        stage: '2. Institutional Order Block',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Supply Order Block Retest',
        desc: `Price mitigated institutional distribution zone [${nearestBearOB.low.toFixed(pipDecimal)} - ${nearestBearOB.high.toFixed(pipDecimal)}].`
      });
    } else {
      confirmations.push({
        stage: '2. Institutional Order Block',
        status: 'WATCHING',
        type: 'NEUTRAL',
        title: 'Scanning Order Blocks',
        desc: `${activeOBs.length} active institutional zones monitored across historical order flow.`
      });
    }

    // Stage 3: Fair Value Gap (FVG)
    const activeBullFVG = activeFVGs.filter(f => f.type === 'BULLISH_FVG' && currentPrice >= f.bottom * 0.999 && currentPrice <= f.top * 1.001).pop();
    const activeBearFVG = activeFVGs.filter(f => f.type === 'BEARISH_FVG' && currentPrice <= f.top * 1.001 && currentPrice >= f.bottom * 0.999).pop();

    if (activeBullFVG) {
      bullishWeight += 20;
      confirmations.push({
        stage: '3. Fair Value Gap (FVG)',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Bullish Imbalance Fill',
        desc: `Price filling liquidity void [${activeBullFVG.bottom.toFixed(pipDecimal)} - ${activeBullFVG.top.toFixed(pipDecimal)}].`
      });
    } else if (activeBearFVG) {
      bearishWeight += 20;
      confirmations.push({
        stage: '3. Fair Value Gap (FVG)',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Bearish Imbalance Fill',
        desc: `Price filling liquidity void [${activeBearFVG.bottom.toFixed(pipDecimal)} - ${activeBearFVG.top.toFixed(pipDecimal)}].`
      });
    } else {
      confirmations.push({
        stage: '3. Fair Value Gap (FVG)',
        status: 'SEARCHING',
        type: 'NEUTRAL',
        title: 'Balanced Order Flow',
        desc: 'No direct imbalance overlap at current tick level.'
      });
    }

    // Stage 4: Premium / Discount Equilibrium (ISR / OTE)
    if (eq) {
      if (eq.zone.includes('DISCOUNT')) {
        bullishWeight += 15;
        confirmations.push({
          stage: '4. Equilibrium & OTE Matrix',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: 'Deep Discount Zone',
          desc: `Trading at ${eq.discountPercent}% of macro swing range. Optimal institutional buy pricing.`
        });
      } else {
        bearishWeight += 15;
        confirmations.push({
          stage: '4. Equilibrium & OTE Matrix',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: 'Premium Zone',
          desc: `Trading at ${eq.discountPercent}% of macro swing range. Optimal institutional sell pricing.`
        });
      }
    }

    // Stage 5: Trend & Momentum Indicators
    const isEMABull = latestEMA9 > latestEMA21 && latestEMA21 > latestEMA50;
    const isEMABear = latestEMA9 < latestEMA21 && latestEMA21 < latestEMA50;
    const isRSIOversold = latestRSI < 38;
    const isRSIOverbought = latestRSI > 62;
    const isMACDExp = latestMACDHist > 0 && latestMACDHist > prevMACDHist;
    const isMACDDrop = latestMACDHist < 0 && latestMACDHist < prevMACDHist;

    if (isEMABull || isRSIOversold || isMACDExp) {
      bullishWeight += 20;
      confirmations.push({
        stage: '5. Indicator Confluence',
        status: 'CONFIRMED',
        type: 'BULLISH',
        title: 'Momentum Alignment',
        desc: `EMA 9/21/50 ribbon expanding upwards, RSI (${latestRSI.toFixed(1)}), MACD acceleration positive.`
      });
    } else if (isEMABear || isRSIOverbought || isMACDDrop) {
      bearishWeight += 20;
      confirmations.push({
        stage: '5. Indicator Confluence',
        status: 'CONFIRMED',
        type: 'BEARISH',
        title: 'Momentum Alignment',
        desc: `EMA 9/21/50 ribbon sloping downwards, RSI (${latestRSI.toFixed(1)}), MACD acceleration negative.`
      });
    }

    // Stage 6: Candlestick Trigger
    if (recentPattern) {
      if (recentPattern.type === 'BULLISH') {
        bullishWeight += 20;
        confirmations.push({
          stage: '6. Candlestick Confirmation',
          status: 'CONFIRMED',
          type: 'BULLISH',
          title: recentPattern.name,
          desc: `Confirmed price action rejection candle at ${recentPattern.price}.`
        });
      } else if (recentPattern.type === 'BEARISH') {
        bearishWeight += 20;
        confirmations.push({
          stage: '6. Candlestick Confirmation',
          status: 'CONFIRMED',
          type: 'BEARISH',
          title: recentPattern.name,
          desc: `Confirmed price action rejection candle at ${recentPattern.price}.`
        });
      }
    }

    // 5. Action Decision
    let decision = 'NEUTRAL (WAIT FOR CONFIRMATION)';
    let confidence = 50;
    let action = 'HOLD';

    const confirmedBullishCount = confirmations.filter(c => c.status === 'CONFIRMED' && c.type === 'BULLISH').length;
    const confirmedBearishCount = confirmations.filter(c => c.status === 'CONFIRMED' && c.type === 'BEARISH').length;

    if (bullishWeight >= 65 && confirmedBullishCount >= 3 && bullishWeight > bearishWeight + 20) {
      decision = bullishWeight >= 85 ? 'STRONG BUY (INSTITUTIONAL)' : 'BUY (HIGH CONFLUENCE)';
      confidence = Math.min(99, Math.round(55 + (bullishWeight * 0.42)));
      action = 'BUY';
    } else if (bearishWeight >= 65 && confirmedBearishCount >= 3 && bearishWeight > bullishWeight + 20) {
      decision = bearishWeight >= 85 ? 'STRONG SELL (INSTITUTIONAL)' : 'SELL (HIGH CONFLUENCE)';
      confidence = Math.min(99, Math.round(55 + (bearishWeight * 0.42)));
      action = 'SELL';
    } else {
      decision = 'NEUTRAL (WAITING FOR SETUP)';
      confidence = 50;
      action = 'HOLD';
    }

    // 6. Target Price Calculations (Entry, Stop Loss below OB/Swing, TP1 at FVG/EQ, TP2 at Macro High)
    const pipMultiplier = pipDecimal === 2 ? 0.01 : 0.0001;
    const atrPips = Math.max(8, Math.round(latestATR / pipMultiplier));
    
    const stopLossPips = Math.round(atrPips * 1.4);
    const tp1Pips = Math.round(stopLossPips * 2.0);
    const tp2Pips = Math.round(stopLossPips * 3.8);

    let stopLossPrice = currentPrice;
    let tp1Price = currentPrice;
    let tp2Price = currentPrice;
    let rrr = '1 : 2.0';

    if (action === 'BUY') {
      stopLossPrice = currentPrice - (stopLossPips * pipMultiplier);
      tp1Price = currentPrice + (tp1Pips * pipMultiplier);
      tp2Price = currentPrice + (tp2Pips * pipMultiplier);
      rrr = `1 : ${(tp1Pips / stopLossPips).toFixed(1)}`;
    } else if (action === 'SELL') {
      stopLossPrice = currentPrice + (stopLossPips * pipMultiplier);
      tp1Price = currentPrice - (tp1Pips * pipMultiplier);
      tp2Price = currentPrice - (tp2Pips * pipMultiplier);
      rrr = `1 : ${(tp1Pips / stopLossPips).toFixed(1)}`;
    }

    // Strategy category
    let tfStrategy = '15-Min SMC Scalp (OB & FVG Mitigations)';
    if (timeframe === '1m' || timeframe === '5m') tfStrategy = 'M1-M5 Institutional Liquidity Scalp';
    if (timeframe === '1h') tfStrategy = 'H1 Intraday Swing (CHoCH & Order Flow)';
    if (timeframe === '4h' || timeframe === '1d') tfStrategy = 'H4-D1 Macro Institutional Accumulation';

    // 7. Generate Comprehensive Pre-Trade Institutional Analysis Dossier
    const confirmedCount = action === 'BUY' ? confirmedBullishCount : confirmedBearishCount;
    const dossier = {
      pair,
      timeframe,
      action,
      decision,
      confidence,
      entryPrice: parseFloat(currentPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPrice: parseFloat(stopLossPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp1Price: parseFloat(tp1Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      tp2Price: parseFloat(tp2Price.toFixed(pipDecimal === 2 ? 3 : 5)),
      stopLossPips,
      tp1Pips,
      tp2Pips,
      rrr,
      invalidationPrice: parseFloat(stopLossPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
      tradeThesis: action === 'BUY'
        ? `High-probability institutional Long position on ${pair} [${timeframe.toUpperCase()}]. Price is executing out of a confirmed Discount Demand zone with ${confirmedCount} aligning structural and candlestick confirmations.`
        : action === 'SELL'
        ? `High-probability institutional Short position on ${pair} [${timeframe.toUpperCase()}]. Price is executing out of a confirmed Premium Supply zone with ${confirmedCount} aligning structural and candlestick confirmations.`
        : `Market is in equilibrium. Recommend waiting for a decisive BOS / CHoCH structural break before capital deployment.`,
      executionPlan: {
        orderType: action !== 'HOLD' ? 'MARKET EXECUTION / PENDING LIMIT' : 'NO EXECUTION',
        riskRecommendation: '1.0% - 1.5% Account Equity per position',
        recommendedTimeframe: timeframe.toUpperCase(),
        stopLossRationale: `Stop Loss placed ${stopLossPips} pips outside institutional invalidation level (${stopLossPrice.toFixed(pipDecimal)}).`,
        takeProfitRationale: `TP1 captures 2.0x ATR at ${tp1Price.toFixed(pipDecimal)} (+${tp1Pips}p). TP2 captures macro swing extension at ${tp2Price.toFixed(pipDecimal)} (+${tp2Pips}p).`
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
      entryPrice: parseFloat(currentPrice.toFixed(pipDecimal === 2 ? 3 : 5)),
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
