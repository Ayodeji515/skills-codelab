/**
 * Smart Money Concepts (SMC), ICT, and Supply & Demand Analysis Engine
 * Calculates:
 * - BOS (Break of Structure) & CHoCH (Change of Character)
 * - Order Blocks (Bullish OB & Bearish OB)
 * - Fair Value Gaps (FVG) / Imbalances
 * - Liquidity Sweeps (BSL - Buy-side Liquidity / SSL - Sell-side Liquidity)
 * - Supply & Demand Zones (Rally-Base-Drop, Drop-Base-Rally)
 * - Premium vs Discount Equilibrium Pricing (OTE - Optimal Trade Entry)
 */
const SMCEngine = {
  // Find Swing Highs and Swing Lows (Fractals)
  findSwings(candles, period = 3) {
    const swingHighs = [];
    const swingLows = [];
    if (!candles || candles.length < period * 2 + 1) return { swingHighs, swingLows };

    for (let i = period; i < candles.length - period; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= period; j++) {
        if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        swingHighs.push({ index: i, time: current.time, price: current.high, candle: current });
      }
      if (isLow) {
        swingLows.push({ index: i, time: current.time, price: current.low, candle: current });
      }
    }

    return { swingHighs, swingLows };
  },

  // Detect Equal Highs (EQH) and Equal Lows (EQL) - Liquidity Pools
  findEqualHighsLows(candles, pipDecimal = 4) {
    const { swingHighs, swingLows } = this.findSwings(candles, 3);
    const pipMultiplier = pipDecimal === 2 ? 0.01 : 0.0001;
    const tolerance = 4 * pipMultiplier; // within 4 pips
    const liquidityPools = [];

    // Check swing highs for EQH (Buy-side Liquidity Pool)
    for (let i = 0; i < swingHighs.length - 1; i++) {
      for (let j = i + 1; j < swingHighs.length; j++) {
        const sh1 = swingHighs[i];
        const sh2 = swingHighs[j];
        if (Math.abs(sh1.price - sh2.price) <= tolerance && Math.abs(sh1.index - sh2.index) >= 4) {
          liquidityPools.push({
            type: 'EQH',
            name: 'Equal Highs (BSL Pool)',
            price: Math.max(sh1.price, sh2.price),
            startIndex: sh1.index,
            endIndex: sh2.index,
            time: sh2.time,
            description: 'Major Buy-Side Liquidity resting above double/equal highs.'
          });
          break;
        }
      }
    }

    // Check swing lows for EQL (Sell-side Liquidity Pool)
    for (let i = 0; i < swingLows.length - 1; i++) {
      for (let j = i + 1; j < swingLows.length; j++) {
        const sl1 = swingLows[i];
        const sl2 = swingLows[j];
        if (Math.abs(sl1.price - sl2.price) <= tolerance && Math.abs(sl1.index - sl2.index) >= 4) {
          liquidityPools.push({
            type: 'EQL',
            name: 'Equal Lows (SSL Pool)',
            price: Math.min(sl1.price, sl2.price),
            startIndex: sl1.index,
            endIndex: sl2.index,
            time: sl2.time,
            description: 'Major Sell-Side Liquidity resting below double/equal lows.'
          });
          break;
        }
      }
    }

    return liquidityPools;
  },

  // Detect Institutional Liquidity Sweeps / Turtle Soups (Wick beyond swing then close back inside)
  findLiquiditySweeps(candles) {
    const { swingHighs, swingLows } = this.findSwings(candles, 3);
    const sweeps = [];
    if (!candles || candles.length < 10) return sweeps;

    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];

      // Buy-side Liquidity (BSL) Sweep: Wick penetrates previous swing high, but candle closes below it
      const pastHighs = swingHighs.filter(s => s.index < i - 1 && s.index >= i - 35);
      if (pastHighs.length > 0) {
        const targetHigh = pastHighs[pastHighs.length - 1];
        if (c.high > targetHigh.price && c.close < targetHigh.price) {
          sweeps.push({
            type: 'BSL_SWEEP',
            direction: 'BEARISH',
            index: i,
            time: c.time,
            sweepPrice: c.high,
            levelPrice: targetHigh.price,
            name: 'BSL Sweep (Buy-Side Purge)',
            description: 'Institutions swept buy stops above recent high; strong bearish reversal potential.'
          });
        }
      }

      // Sell-side Liquidity (SSL) Sweep: Wick penetrates previous swing low, but candle closes above it
      const pastLows = swingLows.filter(s => s.index < i - 1 && s.index >= i - 35);
      if (pastLows.length > 0) {
        const targetLow = pastLows[pastLows.length - 1];
        if (c.low < targetLow.price && c.close > targetLow.price) {
          sweeps.push({
            type: 'SSL_SWEEP',
            direction: 'BULLISH',
            index: i,
            time: c.time,
            sweepPrice: c.low,
            levelPrice: targetLow.price,
            name: 'SSL Sweep (Sell-Side Purge)',
            description: 'Institutions swept sell stops below recent low; strong bullish reversal potential.'
          });
        }
      }
    }

    return sweeps;
  },

  // Detect Fair Value Gaps (FVG) with Consequent Encroachment (50% CE)
  findFVGs(candles) {
    const fvgs = [];
    if (!candles || candles.length < 4) return fvgs;

    for (let i = 2; i < candles.length; i++) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1]; // Middle expansion candle
      const c3 = candles[i];

      // Bullish FVG: Candle 1 High < Candle 3 Low
      if (c3.low > c1.high) {
        const gapSize = c3.low - c1.high;
        if (gapSize > 0) {
          let mitigated = false;
          let partiallyMitigated = false;
          const ce50 = c1.high + (gapSize * 0.5); // Consequent Encroachment (50%)

          for (let k = i + 1; k < candles.length; k++) {
            if (candles[k].low <= c1.high) {
              mitigated = true;
              break;
            } else if (candles[k].low <= ce50) {
              partiallyMitigated = true;
            }
          }

          fvgs.push({
            type: 'BULLISH_FVG',
            startIndex: i - 2,
            endIndex: i,
            top: c3.low,
            bottom: c1.high,
            mid: ce50,
            time: c2.time,
            mitigated,
            partiallyMitigated,
            status: mitigated ? 'MITIGATED' : (partiallyMitigated ? '50% CE FILLED' : 'FRESH / UNFILLED')
          });
        }
      }

      // Bearish FVG: Candle 1 Low > Candle 3 High
      else if (c1.low > c3.high) {
        const gapSize = c1.low - c3.high;
        if (gapSize > 0) {
          let mitigated = false;
          let partiallyMitigated = false;
          const ce50 = c3.high + (gapSize * 0.5);

          for (let k = i + 1; k < candles.length; k++) {
            if (candles[k].high >= c1.low) {
              mitigated = true;
              break;
            } else if (candles[k].high >= ce50) {
              partiallyMitigated = true;
            }
          }

          fvgs.push({
            type: 'BEARISH_FVG',
            startIndex: i - 2,
            endIndex: i,
            top: c1.low,
            bottom: c3.high,
            mid: ce50,
            time: c2.time,
            mitigated,
            partiallyMitigated,
            status: mitigated ? 'MITIGATED' : (partiallyMitigated ? '50% CE FILLED' : 'FRESH / UNFILLED')
          });
        }
      }
    }

    return fvgs;
  },

  // Detect Institutional Order Blocks (OB)
  findOrderBlocks(candles) {
    const orderBlocks = [];
    if (!candles || candles.length < 5) return orderBlocks;

    for (let i = 1; i < candles.length - 2; i++) {
      const c = candles[i];
      const next1 = candles[i + 1];
      const next2 = candles[i + 2];

      const cBody = Math.max(0.00001, Math.abs(c.close - c.open));
      const next1Body = Math.abs(next1.close - next1.open);
      const next2Body = Math.abs(next2.close - next2.open);

      // Bullish Order Block: Last down candle before strong bullish displacement
      if (c.close < c.open && next1.close > next1.open && (next1Body > cBody * 1.3 || (next1Body + next2Body) > cBody * 2.2)) {
        let mitigated = false;
        for (let k = i + 2; k < candles.length; k++) {
          if (candles[k].low < c.low) {
            mitigated = true;
            break;
          }
        }

        orderBlocks.push({
          type: 'BULLISH_OB',
          index: i,
          time: c.time,
          high: Math.max(c.open, c.close),
          low: c.low,
          fullHigh: c.high,
          mitigated,
          description: 'Institutional accumulation footprint before upward displacement.'
        });
      }

      // Bearish Order Block: Last up candle before strong bearish displacement
      else if (c.close > c.open && next1.close < next1.open && (next1Body > cBody * 1.3 || (next1Body + next2Body) > cBody * 2.2)) {
        let mitigated = false;
        for (let k = i + 2; k < candles.length; k++) {
          if (candles[k].high > c.high) {
            mitigated = true;
            break;
          }
        }

        orderBlocks.push({
          type: 'BEARISH_OB',
          index: i,
          time: c.time,
          high: c.high,
          low: Math.min(c.open, c.close),
          fullLow: c.low,
          mitigated,
          description: 'Institutional distribution footprint before downward displacement.'
        });
      }
    }

    return orderBlocks;
  },

  // Detect BOS (Break of Structure) & CHoCH (Change of Character)
  analyzeStructure(candles) {
    const { swingHighs, swingLows } = this.findSwings(candles, 3);
    const structures = [];
    let currentTrend = 'NEUTRAL';

    // Walk through candles to detect breaks of prior swings
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];

      // Prior active swing high & low
      const pastHighs = swingHighs.filter(s => s.index < i - 1);
      const pastLows = swingLows.filter(s => s.index < i - 1);

      if (pastHighs.length > 0) {
        const lastSwingHigh = pastHighs[pastHighs.length - 1];
        if (c.close > lastSwingHigh.price && prev.close <= lastSwingHigh.price) {
          const type = currentTrend === 'BEARISH' ? 'CHoCH (Bullish Reversal)' : 'BOS (Bullish Continuation)';
          currentTrend = 'BULLISH';
          structures.push({
            index: i,
            time: c.time,
            price: lastSwingHigh.price,
            type,
            direction: 'BULLISH',
            description: type.includes('CHoCH') 
              ? 'Market structure shifted from Bearish to Bullish (Change of Character).'
              : 'Bullish Break of Structure confirming upward institutional order flow.'
          });
        }
      }

      if (pastLows.length > 0) {
        const lastSwingLow = pastLows[pastLows.length - 1];
        if (c.close < lastSwingLow.price && prev.close >= lastSwingLow.price) {
          const type = currentTrend === 'BULLISH' ? 'CHoCH (Bearish Reversal)' : 'BOS (Bearish Continuation)';
          currentTrend = 'BEARISH';
          structures.push({
            index: i,
            time: c.time,
            price: lastSwingLow.price,
            type,
            direction: 'BEARISH',
            description: type.includes('CHoCH') 
              ? 'Market structure shifted from Bullish to Bearish (Change of Character).'
              : 'Bearish Break of Structure confirming downward institutional order flow.'
          });
        }
      }
    }

    return { structures, currentTrend, swingHighs, swingLows };
  },

  // Supply and Demand Zones (Rally-Base-Drop & Drop-Base-Rally)
  findSupplyDemandZones(candles) {
    const zones = [];
    if (!candles || candles.length < 8) return zones;

    for (let i = 2; i < candles.length - 3; i++) {
      const base = candles[i];
      const cExp = candles[i + 1];

      const baseRange = Math.max(0.00001, base.high - base.low);
      const expRange = Math.abs(cExp.close - cExp.open);

      // Demand Zone (Drop-Base-Rally / Rally-Base-Rally)
      if (cExp.close > cExp.open && expRange > baseRange * 1.8) {
        let isMitigated = false;
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].low <= base.low) {
            isMitigated = true;
            break;
          }
        }
        zones.push({
          type: 'DEMAND',
          time: base.time,
          top: base.high,
          bottom: base.low,
          status: isMitigated ? 'MITIGATED' : 'FRESH DEMAND',
          strength: expRange > baseRange * 2.5 ? 'HIGH' : 'MEDIUM'
        });
      }

      // Supply Zone (Rally-Base-Drop / Drop-Base-Drop)
      else if (cExp.close < cExp.open && expRange > baseRange * 1.8) {
        let isMitigated = false;
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].high >= base.high) {
            isMitigated = true;
            break;
          }
        }
        zones.push({
          type: 'SUPPLY',
          time: base.time,
          top: base.high,
          bottom: base.low,
          status: isMitigated ? 'MITIGATED' : 'FRESH SUPPLY',
          strength: expRange > baseRange * 2.5 ? 'HIGH' : 'MEDIUM'
        });
      }
    }

    return zones;
  },

  // Premium / Discount Range Equilibrium & OTE (Optimal Trade Entry)
  calculateEquilibrium(candles) {
    if (!candles || candles.length < 20) return null;
    const slice = candles.slice(-50);
    let high = -Infinity;
    let low = Infinity;

    slice.forEach(c => {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    });

    const range = high - low;
    const equilibrium = low + (range * 0.5);
    const oteBullishMin = low + (range * 0.618);
    const oteBullishMax = low + (range * 0.786);
    const currentPrice = candles[candles.length - 1].close;

    const zone = currentPrice < equilibrium ? 'DISCOUNT ZONE (Optimal for Longs)' : 'PREMIUM ZONE (Optimal for Shorts)';
    const discountPercent = range > 0 ? ((currentPrice - low) / range) * 100 : 50;

    return {
      high,
      low,
      equilibrium,
      oteBullishMin,
      oteBullishMax,
      zone,
      discountPercent: parseFloat(discountPercent.toFixed(1)),
      currentPrice
    };
  },

  // Full Comprehensive SMC Evaluation
  analyzeAll(candles, pipDecimal = 4) {
    const fvgs = this.findFVGs(candles);
    const orderBlocks = this.findOrderBlocks(candles);
    const { structures, currentTrend, swingHighs, swingLows } = this.analyzeStructure(candles);
    const supplyDemand = this.findSupplyDemandZones(candles);
    const equilibrium = this.calculateEquilibrium(candles);
    const liquidityPools = this.findEqualHighsLows(candles, pipDecimal);
    const liquiditySweeps = this.findLiquiditySweeps(candles);

    const activeFVGs = fvgs.filter(f => !f.mitigated);
    const activeOBs = orderBlocks.filter(o => !o.mitigated);
    const latestStructure = structures[structures.length - 1] || null;
    const latestSweep = liquiditySweeps[liquiditySweeps.length - 1] || null;
    const freshDemand = supplyDemand.filter(s => s.type === 'DEMAND' && s.status.includes('FRESH'));
    const freshSupply = supplyDemand.filter(s => s.type === 'SUPPLY' && s.status.includes('FRESH'));

    return {
      currentTrend,
      latestStructure,
      latestSweep,
      structures,
      fvgs,
      activeFVGs,
      orderBlocks,
      activeOBs,
      supplyDemand,
      freshDemand,
      freshSupply,
      equilibrium,
      swingHighs,
      swingLows,
      liquidityPools,
      liquiditySweeps
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SMCEngine;
}
