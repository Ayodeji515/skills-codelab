const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supported Forex Pairs with Base Rates & Volatilities
const PAIRS_CONFIG = {
  'EURUSD': { name: 'EUR / USD', basePrice: 1.08450, pipDecimal: 4, spread: 0.8, volatility: 0.00012, flag: '🇪🇺 🇺🇸', category: 'Major' },
  'GBPUSD': { name: 'GBP / USD', basePrice: 1.29320, pipDecimal: 4, spread: 1.1, volatility: 0.00016, flag: '🇬🇧 🇺🇸', category: 'Major' },
  'USDJPY': { name: 'USD / JPY', basePrice: 154.650, pipDecimal: 2, spread: 0.9, volatility: 0.035, flag: '🇺🇸 🇯🇵', category: 'Major' },
  'AUDUSD': { name: 'AUD / USD', basePrice: 0.65850, pipDecimal: 4, spread: 1.2, volatility: 0.00014, flag: '🇦🇺 🇺🇸', category: 'Major' },
  'USDCAD': { name: 'USD / CAD', basePrice: 1.38240, pipDecimal: 4, spread: 1.3, volatility: 0.00015, flag: '🇺🇸 🇨🇦', category: 'Major' },
  'USDCHF': { name: 'USD / CHF', basePrice: 0.88420, pipDecimal: 4, spread: 1.4, volatility: 0.00013, flag: '🇺🇸 🇨🇭', category: 'Major' },
  'GBPJPY': { name: 'GBP / JPY', basePrice: 199.850, pipDecimal: 2, spread: 1.8, volatility: 0.045, flag: '🇬🇧 🇯🇵', category: 'Cross' },
  'EURJPY': { name: 'EUR / JPY', basePrice: 167.720, pipDecimal: 2, spread: 1.5, volatility: 0.040, flag: '🇪🇺 🇯🇵', category: 'Cross' }
};

// In-Memory state for pairs
const marketState = {};
const persistentCandleStore = {}; // [pair][timeframe] -> array of stable candles

const TIMEFRAMES_MINUTES = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440
};

// Seed initial persistent historical candles
function initPersistentStore() {
  const now = Math.floor(Date.now() / 1000);

  Object.keys(PAIRS_CONFIG).forEach(pair => {
    const cfg = PAIRS_CONFIG[pair];
    marketState[pair] = {
      currentPrice: cfg.basePrice,
      open24h: cfg.basePrice * (1 + (Math.random() * 0.003 - 0.0015)),
      high24h: cfg.basePrice * 1.004,
      low24h: cfg.basePrice * 0.996,
      lastTickTime: Date.now()
    };

    persistentCandleStore[pair] = {};

    Object.keys(TIMEFRAMES_MINUTES).forEach(tf => {
      const minutes = TIMEFRAMES_MINUTES[tf];
      const intervalSec = minutes * 60;
      const count = 150;
      const candles = [];

      let currentClose = cfg.basePrice;
      const raw = [];

      // Realistic sine waves with trend cycle for clean SMC patterns (OB, FVG, BOS)
      const waveCycle = Math.PI * 2 / 24;
      const trendBias = (pair === 'EURUSD' || pair === 'GBPUSD' || pair === 'AUDUSD') ? 0.00008 : -0.00008;

      for (let i = 0; i < count; i++) {
        const time = now - (i * intervalSec);
        const wave = Math.sin(i * waveCycle) * (cfg.volatility * 3.5);
        const noise = (Math.sin(i * 1.7) * 0.5) * (cfg.volatility * 1.5);
        const change = wave + noise + trendBias;

        const close = currentClose;
        const open = close - change;
        const high = Math.max(open, close) + Math.abs(Math.cos(i)) * cfg.volatility * 1.2;
        const low = Math.min(open, close) - Math.abs(Math.sin(i)) * cfg.volatility * 1.2;
        const volume = Math.floor(1200 + Math.abs(change) * 200000 + Math.sin(i) * 500);

        raw.push({
          time,
          open: parseFloat(open.toFixed(cfg.pipDecimal === 2 ? 3 : 5)),
          high: parseFloat(high.toFixed(cfg.pipDecimal === 2 ? 3 : 5)),
          low: parseFloat(low.toFixed(cfg.pipDecimal === 2 ? 3 : 5)),
          close: parseFloat(close.toFixed(cfg.pipDecimal === 2 ? 3 : 5)),
          volume
        });

        currentClose = open;
      }

      persistentCandleStore[pair][tf] = raw.reverse();
    });
  });
}

initPersistentStore();

// REST Endpoints
app.get('/api/pairs', (req, res) => {
  const result = Object.keys(PAIRS_CONFIG).map(symbol => {
    const cfg = PAIRS_CONFIG[symbol];
    const state = marketState[symbol];
    const change = state.currentPrice - state.open24h;
    const changePercent = (change / state.open24h) * 100;
    return {
      symbol,
      name: cfg.name,
      flag: cfg.flag,
      category: cfg.category,
      price: state.currentPrice,
      pipDecimal: cfg.pipDecimal,
      spread: cfg.spread,
      change24h: change,
      changePercent24h: changePercent,
      high24h: state.high24h,
      low24h: state.low24h
    };
  });
  res.json({ success: true, pairs: result });
});

app.get('/api/candles', (req, res) => {
  const pair = (req.query.pair || 'EURUSD').toUpperCase();
  const timeframe = req.query.timeframe || '15m';

  if (!PAIRS_CONFIG[pair] || !persistentCandleStore[pair] || !persistentCandleStore[pair][timeframe]) {
    return res.status(400).json({ error: 'Unsupported pair or timeframe' });
  }

  const candles = persistentCandleStore[pair][timeframe];
  res.json({
    success: true,
    pair,
    timeframe,
    count: candles.length,
    candles
  });
});

app.get('/api/market-sessions', (req, res) => {
  const now = new Date();
  const utcHour = now.getUTCHours();

  const sessions = {
    sydney: { name: 'Sydney', active: utcHour >= 21 || utcHour < 6, hours: '21:00 - 06:00 UTC' },
    tokyo: { name: 'Tokyo', active: utcHour >= 0 && utcHour < 9, hours: '00:00 - 09:00 UTC' },
    london: { name: 'London', active: utcHour >= 7 && utcHour < 16, hours: '07:00 - 16:00 UTC' },
    newyork: { name: 'New York', active: utcHour >= 12 && utcHour < 21, hours: '12:00 - 21:00 UTC' }
  };

  res.json({
    success: true,
    utcTime: now.toISOString(),
    sessions
  });
});

// Periodic realistic live tick update
setInterval(() => {
  const nowSec = Math.floor(Date.now() / 1000);

  Object.keys(PAIRS_CONFIG).forEach(pair => {
    const cfg = PAIRS_CONFIG[pair];
    const state = marketState[pair];
    
    // Controlled smooth micro-delta
    const delta = (Math.random() - 0.495) * (cfg.volatility * 0.15);
    state.currentPrice = parseFloat((state.currentPrice + delta).toFixed(cfg.pipDecimal === 2 ? 3 : 5));
    if (state.currentPrice > state.high24h) state.high24h = state.currentPrice;
    if (state.currentPrice < state.low24h) state.low24h = state.currentPrice;
    state.lastTickTime = Date.now();

    // Update active live candle in each timeframe
    Object.keys(TIMEFRAMES_MINUTES).forEach(tf => {
      const series = persistentCandleStore[pair][tf];
      if (!series || !series.length) return;

      const lastCandle = series[series.length - 1];
      const intervalSec = TIMEFRAMES_MINUTES[tf] * 60;

      if (nowSec >= lastCandle.time + intervalSec) {
        // Roll over to new candle
        const newCandle = {
          time: lastCandle.time + intervalSec,
          open: state.currentPrice,
          high: state.currentPrice,
          low: state.currentPrice,
          close: state.currentPrice,
          volume: 50
        };
        series.push(newCandle);
        if (series.length > 200) series.shift();
      } else {
        // Update current open candle
        lastCandle.close = state.currentPrice;
        if (state.currentPrice > lastCandle.high) lastCandle.high = state.currentPrice;
        if (state.currentPrice < lastCandle.low) lastCandle.low = state.currentPrice;
        lastCandle.volume += Math.floor(Math.random() * 8 + 1);
      }
    });
  });
}, 1500);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Forex Quantum Terminal Engine running on port ${PORT}`);
  console.log(`🔗 Dashboard: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
