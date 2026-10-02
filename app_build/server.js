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
  'EURUSD': { name: 'EUR / USD', basePrice: 1.08450, pipDecimal: 4, spread: 0.8, volatility: 0.00018, flag: '🇪🇺 🇺🇸', category: 'Major' },
  'GBPUSD': { name: 'GBP / USD', basePrice: 1.29320, pipDecimal: 4, spread: 1.1, volatility: 0.00025, flag: '🇬🇧 🇺🇸', category: 'Major' },
  'USDJPY': { name: 'USD / JPY', basePrice: 154.650, pipDecimal: 2, spread: 0.9, volatility: 0.045, flag: '🇺🇸 🇯🇵', category: 'Major' },
  'AUDUSD': { name: 'AUD / USD', basePrice: 0.65850, pipDecimal: 4, spread: 1.2, volatility: 0.00020, flag: '🇦🇺 🇺🇸', category: 'Major' },
  'USDCAD': { name: 'USD / CAD', basePrice: 1.38240, pipDecimal: 4, spread: 1.3, volatility: 0.00022, flag: '🇺🇸 🇨🇦', category: 'Major' },
  'USDCHF': { name: 'USD / CHF', basePrice: 0.88420, pipDecimal: 4, spread: 1.4, volatility: 0.00019, flag: '🇺🇸 🇨🇭', category: 'Major' },
  'GBPJPY': { name: 'GBP / JPY', basePrice: 199.850, pipDecimal: 2, spread: 1.8, volatility: 0.065, flag: '🇬🇧 🇯🇵', category: 'Cross' },
  'EURJPY': { name: 'EUR / JPY', basePrice: 167.720, pipDecimal: 2, spread: 1.5, volatility: 0.055, flag: '🇪🇺 🇯🇵', category: 'Cross' }
};

// In-Memory state for pairs
const marketState = {};
Object.keys(PAIRS_CONFIG).forEach(pair => {
  const cfg = PAIRS_CONFIG[pair];
  marketState[pair] = {
    currentPrice: cfg.basePrice,
    open24h: cfg.basePrice * (1 + (Math.random() * 0.004 - 0.002)),
    high24h: cfg.basePrice * 1.006,
    low24h: cfg.basePrice * 0.994,
    lastTickTime: Date.now()
  };
});

// Generate realistic Historical Candles for any timeframe
function generateCandles(pair, timeframe = '15m', count = 100) {
  const config = PAIRS_CONFIG[pair] || PAIRS_CONFIG['EURUSD'];
  const state = marketState[pair] || { currentPrice: config.basePrice };
  const candles = [];
  
  let tfMinutes = 15;
  if (timeframe === '1m') tfMinutes = 1;
  else if (timeframe === '5m') tfMinutes = 5;
  else if (timeframe === '15m') tfMinutes = 15;
  else if (timeframe === '1h') tfMinutes = 60;
  else if (timeframe === '4h') tfMinutes = 240;
  else if (timeframe === '1d') tfMinutes = 1440;

  const intervalMs = tfMinutes * 60 * 1000;
  const now = Date.now();
  let currentClose = state.currentPrice;

  // Build backwards then reverse
  const rawCandles = [];
  let prevClose = currentClose;

  // Wave generator parameters for realistic trend cycles
  const waveCycle = Math.PI * 2 / 25;
  const trendSlope = (Math.sin(Date.now() / 1000000) * 0.0005);

  for (let i = 0; i < count; i++) {
    const time = now - (i * intervalMs);
    const wave = Math.sin(i * waveCycle) * (config.volatility * 4);
    const noise = (Math.random() - 0.49) * config.volatility * 3;
    const change = wave + noise + trendSlope;
    
    const close = prevClose;
    const open = close - change;
    const high = Math.max(open, close) + Math.random() * config.volatility * 2.2;
    const low = Math.min(open, close) - Math.random() * config.volatility * 2.2;
    const volume = Math.floor(800 + Math.random() * 3500 + Math.abs(change) * 100000);

    rawCandles.push({
      time: Math.floor(time / 1000),
      open: parseFloat(open.toFixed(config.pipDecimal === 2 ? 3 : 5)),
      high: parseFloat(high.toFixed(config.pipDecimal === 2 ? 3 : 5)),
      low: parseFloat(low.toFixed(config.pipDecimal === 2 ? 3 : 5)),
      close: parseFloat(close.toFixed(config.pipDecimal === 2 ? 3 : 5)),
      volume
    });

    prevClose = open;
  }

  return rawCandles.reverse();
}

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
  const count = parseInt(req.query.count) || 120;

  if (!PAIRS_CONFIG[pair]) {
    return res.status(400).json({ error: 'Unsupported pair' });
  }

  const candles = generateCandles(pair, timeframe, count);
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

// Periodic live market tick simulator
setInterval(() => {
  Object.keys(PAIRS_CONFIG).forEach(pair => {
    const cfg = PAIRS_CONFIG[pair];
    const state = marketState[pair];
    const delta = (Math.random() - 0.498) * (cfg.volatility * 0.4);
    state.currentPrice = parseFloat((state.currentPrice + delta).toFixed(cfg.pipDecimal === 2 ? 3 : 5));
    if (state.currentPrice > state.high24h) state.high24h = state.currentPrice;
    if (state.currentPrice < state.low24h) state.low24h = state.currentPrice;
    state.lastTickTime = Date.now();
  });
}, 1200);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Forex Trend & Technical Analysis Hub running on port ${PORT}`);
  console.log(`🔗 Dashboard: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
