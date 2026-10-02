/**
 * Candlestick Pattern Recognition Engine
 * Detects 12+ standard Forex price-action reversal & continuation patterns
 */
const CandlestickPatterns = {
  scanAll(candles) {
    const patterns = [];
    if (!candles || candles.length < 5) return patterns;

    for (let i = 2; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const prev2 = candles[i - 2];

      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const isBullish = c.close > c.open;
      const isBearish = c.close < c.open;

      const prevBody = Math.abs(prev.close - prev.open);
      const prevIsBullish = prev.close > prev.open;
      const prevIsBearish = prev.close < prev.open;

      // 1. Hammer (Bullish Reversal)
      if (lowerWick >= 2 * body && upperWick <= 0.2 * body && range > 0 && isBullish) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Hammer',
          type: 'BULLISH',
          reliability: 'HIGH',
          description: 'Strong buyer rejection at lower price levels. High probability upward reversal.'
        });
      }

      // 2. Shooting Star (Bearish Reversal)
      else if (upperWick >= 2 * body && lowerWick <= 0.2 * body && range > 0 && isBearish) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Shooting Star',
          type: 'BEARISH',
          reliability: 'HIGH',
          description: 'Strong seller rejection at high levels. High probability downward reversal.'
        });
      }

      // 3. Bullish Engulfing
      else if (prevIsBearish && isBullish && c.open <= prev.close && c.close >= prev.open && body > prevBody) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Bullish Engulfing',
          type: 'BULLISH',
          reliability: 'VERY_HIGH',
          description: 'Current green candle completely engulfs previous red candle. Institutional buying surge.'
        });
      }

      // 4. Bearish Engulfing
      else if (prevIsBullish && isBearish && c.open >= prev.close && c.close <= prev.open && body > prevBody) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Bearish Engulfing',
          type: 'BEARISH',
          reliability: 'VERY_HIGH',
          description: 'Current red candle completely engulfs previous green candle. Institutional sell-off.'
        });
      }

      // 5. Morning Star (3-Candle Bullish Reversal)
      else if (prev2 && prev2.close < prev2.open && prevBody < (Math.abs(prev2.close - prev2.open) * 0.4) && isBullish && c.close > (prev2.open + prev2.close) / 2) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Morning Star',
          type: 'BULLISH',
          reliability: 'VERY_HIGH',
          description: 'Triple-candle pattern marking exhaustion of selling pressure and powerful upward rally.'
        });
      }

      // 6. Evening Star (3-Candle Bearish Reversal)
      else if (prev2 && prev2.close > prev2.open && prevBody < (Math.abs(prev2.close - prev2.open) * 0.4) && isBearish && c.close < (prev2.open + prev2.close) / 2) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: 'Evening Star',
          type: 'BEARISH',
          reliability: 'VERY_HIGH',
          description: 'Triple-candle pattern marking exhaustion of buying momentum into a strong downtrend.'
        });
      }

      // 7. Doji (Indecision / Pivot)
      else if (body <= range * 0.08 && range > 0) {
        const isDragonfly = lowerWick >= 0.7 * range;
        const isGravestone = upperWick >= 0.7 * range;
        const patternName = isDragonfly ? 'Dragonfly Doji' : isGravestone ? 'Gravestone Doji' : 'Standard Doji';
        const type = isDragonfly ? 'BULLISH' : isGravestone ? 'BEARISH' : 'NEUTRAL';
        
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: patternName,
          type,
          reliability: 'MEDIUM',
          description: 'Market equilibrium where buyers and sellers are equalized. Precursor to trend continuation or breakout.'
        });
      }

      // 8. Marubozu (Strong Momentum)
      else if (body >= range * 0.90 && range > 0) {
        patterns.push({
          index: i,
          time: c.time,
          price: c.close,
          name: isBullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
          type: isBullish ? 'BULLISH' : 'BEARISH',
          reliability: 'HIGH',
          description: 'Full-bodied candle with virtually no wicks indicating relentless one-directional order flow.'
        });
      }
    }

    return patterns;
  },

  getLatestPattern(candles) {
    const all = this.scanAll(candles);
    if (!all.length) return null;
    return all[all.length - 1];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CandlestickPatterns;
}
