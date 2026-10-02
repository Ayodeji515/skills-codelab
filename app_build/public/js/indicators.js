/**
 * Technical Indicators Calculation Library
 * Implements standard financial quantitative models
 */
const Indicators = {
  // Simple Moving Average
  calculateSMA(candles, period = 20, source = 'close') {
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j][source];
      }
      result.push(sum / period);
    }
    return result;
  },

  // Exponential Moving Average
  calculateEMA(candles, period = 20, source = 'close') {
    const result = [];
    const multiplier = 2 / (period + 1);
    
    if (candles.length < period) {
      return candles.map(() => null);
    }

    // Initial SMA
    let initialSum = 0;
    for (let i = 0; i < period; i++) {
      initialSum += candles[i][source];
      result.push(null);
    }
    
    let prevEMA = initialSum / period;
    result[period - 1] = prevEMA;

    for (let i = period; i < candles.length; i++) {
      const currentPrice = candles[i][source];
      const currentEMA = (currentPrice - prevEMA) * multiplier + prevEMA;
      result.push(currentEMA);
      prevEMA = currentEMA;
    }

    return result;
  },

  // Relative Strength Index (RSI)
  calculateRSI(candles, period = 14) {
    const result = [];
    if (candles.length < period + 1) {
      return candles.map(() => null);
    }

    let gains = [];
    let losses = [];

    for (let i = 1; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    result.push(...new Array(period).fill(null));

    // Initial average
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));

    // Smoothed RSI
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }

    return result;
  },

  // Moving Average Convergence Divergence (MACD)
  calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(candles, fastPeriod);
    const slowEMA = this.calculateEMA(candles, slowPeriod);
    
    const macdLine = [];
    for (let i = 0; i < candles.length; i++) {
      if (fastEMA[i] === null || slowEMA[i] === null) {
        macdLine.push(null);
      } else {
        macdLine.push(fastEMA[i] - slowEMA[i]);
      }
    }

    // Calculate Signal Line (EMA of MACD Line)
    const validMacdIndices = [];
    const validMacdValues = [];
    macdLine.forEach((val, idx) => {
      if (val !== null) {
        validMacdIndices.push(idx);
        validMacdValues.push({ close: val });
      }
    });

    const signalValues = this.calculateEMA(validMacdValues, signalPeriod);
    const signalLine = new Array(candles.length).fill(null);
    const histogram = new Array(candles.length).fill(null);

    validMacdIndices.forEach((origIdx, i) => {
      signalLine[origIdx] = signalValues[i];
      if (macdLine[origIdx] !== null && signalValues[i] !== null) {
        histogram[origIdx] = macdLine[origIdx] - signalValues[i];
      }
    });

    return { macdLine, signalLine, histogram };
  },

  // Bollinger Bands
  calculateBollingerBands(candles, period = 20, multiplier = 2) {
    const sma = this.calculateSMA(candles, period);
    const upper = [];
    const lower = [];
    const bandwidth = [];

    for (let i = 0; i < candles.length; i++) {
      if (sma[i] === null) {
        upper.push(null);
        lower.push(null);
        bandwidth.push(null);
        continue;
      }

      let sumSqDiff = 0;
      for (let j = 0; j < period; j++) {
        const diff = candles[i - j].close - sma[i];
        sumSqDiff += diff * diff;
      }
      const stdDev = Math.sqrt(sumSqDiff / period);
      const upperVal = sma[i] + (multiplier * stdDev);
      const lowerVal = sma[i] - (multiplier * stdDev);

      upper.push(upperVal);
      lower.push(lowerVal);
      bandwidth.push(((upperVal - lowerVal) / sma[i]) * 100);
    }

    return { upper, middle: sma, lower, bandwidth };
  },

  // Average True Range (ATR)
  calculateATR(candles, period = 14) {
    const tr = [candles[0].high - candles[0].low];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const val = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      tr.push(val);
    }

    const atr = [];
    if (candles.length < period) {
      return candles.map(() => null);
    }

    let initialATR = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = 0; i < period - 1; i++) atr.push(null);
    atr.push(initialATR);

    let prevATR = initialATR;
    for (let i = period; i < tr.length; i++) {
      const currentATR = (prevATR * (period - 1) + tr[i]) / period;
      atr.push(currentATR);
      prevATR = currentATR;
    }

    return atr;
  },

  // Stochastic Oscillator (%K, %D)
  calculateStochastic(candles, period = 14, smoothK = 3, smoothD = 3) {
    const rawK = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        rawK.push(null);
        continue;
      }
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      for (let j = 0; j < period; j++) {
        if (candles[i - j].high > highestHigh) highestHigh = candles[i - j].high;
        if (candles[i - j].low < lowestLow) lowestLow = candles[i - j].low;
      }

      const diff = highestHigh - lowestLow;
      const k = diff === 0 ? 50 : ((candles[i].close - lowestLow) / diff) * 100;
      rawK.push(k);
    }

    // Smooth %K
    const kList = [];
    for (let i = 0; i < rawK.length; i++) {
      if (i < period - 1 + smoothK - 1) {
        kList.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < smoothK; j++) sum += rawK[i - j];
        kList.push(sum / smoothK);
      }
    }

    // %D (SMA of %K)
    const dList = [];
    for (let i = 0; i < kList.length; i++) {
      if (kList[i] === null || i < period - 1 + smoothK - 1 + smoothD - 1) {
        dList.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < smoothD; j++) sum += kList[i - j];
        dList.push(sum / smoothD);
      }
    }

    return { k: kList, d: dList };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Indicators;
}
