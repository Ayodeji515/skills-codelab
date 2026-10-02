/**
 * FX Quantum Institutional Terminal Controller
 * Handles live feeds, TradingView widget, SMC engine, MTF matrix, and Pre-Trade tickets.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    selectedPair: 'EURUSD',
    selectedTimeframe: '15m',
    selectedTVInterval: '15',
    activeMode: 'tv', // 'tv' or 'algo'
    activeFilter: 'all', // 'all', 'majors', 'crosses'
    pairs: [],
    candles: [],
    activeSignal: null,
    patterns: [],
    smcData: null,
    mtfScanResult: null,
    audioEnabled: true,
    autoTrade: false,
    virtualTrades: [],
    closedTrades: [],
    stats: {
      wins: 0,
      losses: 0,
      totalPips: 0,
      winRate: '0.0%'
    }
  };

  const TV_SYMBOLS = {
    'EURUSD': 'FX:EURUSD',
    'GBPUSD': 'FX:GBPUSD',
    'USDJPY': 'FX:USDJPY',
    'AUDUSD': 'FX:AUDUSD',
    'USDCAD': 'FX:USDCAD',
    'USDCHF': 'FX:USDCHF',
    'GBPJPY': 'FX:GBPJPY',
    'EURJPY': 'FX:EURJPY'
  };

  // Initialize Canvas Chart
  const chart = new ForexChart('chart-container');

  // DOM Elements
  const timeframeBtns = document.querySelectorAll('.tf-item');
  const heroPairSymbolEl = document.getElementById('hero-pair-symbol');
  const currentPriceEl = document.getElementById('current-price');
  const priceChangeEl = document.getElementById('price-change');
  const signalDecisionEl = document.getElementById('signal-decision');
  const signalBadgeEl = document.getElementById('signal-badge');
  const confidenceBarEl = document.getElementById('confidence-bar');
  const entryPriceEl = document.getElementById('sig-entry');
  const tp1PriceEl = document.getElementById('sig-tp1');
  const tp2PriceEl = document.getElementById('sig-tp2');
  const tp3PriceEl = document.getElementById('sig-tp3');
  const lotsEl = document.getElementById('sig-lots');
  const slPriceEl = document.getElementById('sig-sl');
  const rrrEl = document.getElementById('sig-rrr');
  const confirmationsCountEl = document.getElementById('confirmations-count');
  const confirmationsListEl = document.getElementById('confirmations-list');
  const smcObCountEl = document.getElementById('smc-ob-count');
  const smcFvgCountEl = document.getElementById('smc-fvg-count');
  const smcEqZoneEl = document.getElementById('smc-eq-zone');
  const patternsListEl = document.getElementById('patterns-list');
  const watchlistContainerEl = document.getElementById('watchlist-container');
  const winRateEl = document.getElementById('stat-winrate');
  const totalPipsEl = document.getElementById('stat-pips');
  const totalTradesEl = document.getElementById('stat-trades');
  const tradeHistoryTableEl = document.getElementById('trade-history-body');
  const audioToggleBtn = document.getElementById('audio-toggle');
  const autoTradeToggleBtn = document.getElementById('autotrade-toggle');
  const executeTradeBtn = document.getElementById('btn-execute-signal');
  const btnModeTV = document.getElementById('btn-mode-tv');
  const btnModeAlgo = document.getElementById('btn-mode-algo');
  const algoControls = document.getElementById('algo-overlay-controls');
  const tvContainer = document.getElementById('tradingview_chart');
  const algoContainer = document.getElementById('chart-container');

  // Multi-Timeframe DOM Elements
  const mtfRecTfEl = document.getElementById('mtf-rec-tf');
  const mtfRecActionEl = document.getElementById('mtf-rec-action');
  const mtfMatrixChips = document.querySelectorAll('.mtf-seg-item');

  // Direction Banner DOM Elements
  const directionBannerEl = document.getElementById('direction-banner');
  const dirTypeTextEl = document.getElementById('dir-type-text');
  const dirActionTextEl = document.getElementById('dir-action-text');

  // Dossier Modal Elements
  const btnOpenDossier = document.getElementById('btn-open-dossier');
  const dossierModal = document.getElementById('dossier-modal');
  const btnCloseDossier = document.getElementById('btn-close-dossier');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirmTrade = document.getElementById('btn-modal-confirm-trade');
  const dossierPairTfEl = document.getElementById('dossier-pair-tf');
  const dossierThesisEl = document.getElementById('dossier-thesis');
  const dActionEl = document.getElementById('d-action');
  const dTfEl = document.getElementById('d-tf');
  const dEntryEl = document.getElementById('d-entry');
  const dSlEl = document.getElementById('d-sl');
  const dTp1El = document.getElementById('d-tp1');
  const dTp2El = document.getElementById('d-tp2');
  const dTp3El = document.getElementById('d-tp3');
  const dLotsEl = document.getElementById('d-lots');
  const dRrrEl = document.getElementById('d-rrr');
  const dRiskEl = document.getElementById('d-risk');
  const dossierConfirmationsListEl = document.getElementById('dossier-confirmations-list');
  const dossierInvalidationTextEl = document.getElementById('dossier-invalidation-text');

  // Tab Switcher on Right Panel
  const intelTabBtns = document.querySelectorAll('.intel-tab-btn');
  intelTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      intelTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
      const targetPane = document.getElementById(`pane-${targetTab}`);
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  // Watchlist Filter Pills
  document.querySelectorAll('.f-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.f-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderWatchlist();
    });
  });

  // Update Global Sessions
  async function fetchMarketSessions() {
    try {
      const res = await fetch('/api/market-sessions');
      const data = await res.json();
      if (data.success) {
        ['sydney', 'tokyo', 'london', 'newyork'].forEach(k => {
          const el = document.getElementById(`session-${k}`);
          if (el && data.sessions[k]) {
            el.classList.toggle('active', data.sessions[k].active);
          }
        });
      }
    } catch (e) {
      console.warn('Session clock sync warning:', e);
    }
  }

  // TradingView Widget Initializer
  let tvWidgetInstance = null;
  function updateTradingViewWidget() {
    const symbol = TV_SYMBOLS[state.selectedPair] || 'FX:EURUSD';
    const interval = state.selectedTVInterval || '15';

    if (window.TradingView && tvContainer) {
      tvContainer.innerHTML = '';
      try {
        tvWidgetInstance = new TradingView.widget({
          "autosize": true,
          "symbol": symbol,
          "interval": interval,
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "toolbar_bg": "#0b0f19",
          "enable_publishing": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": "tradingview_chart",
          "studies": [
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies",
            "BollingerBands@tv-basicstudies"
          ],
          "overrides": {
            "mainSeriesProperties.candleStyle.upColor": "#00f59b",
            "mainSeriesProperties.candleStyle.downColor": "#ff3b69",
            "mainSeriesProperties.candleStyle.drawWick": true,
            "mainSeriesProperties.candleStyle.drawBorder": true,
            "mainSeriesProperties.candleStyle.borderColor": "#00f59b",
            "mainSeriesProperties.candleStyle.borderUpColor": "#00f59b",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ff3b69",
            "mainSeriesProperties.candleStyle.wickUpColor": "#00f59b",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ff3b69",
            "paneProperties.background": "#07090e",
            "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.04)",
            "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.04)",
            "scalesProperties.textColor": "#94a3b8"
          }
        });
      } catch (e) {
        console.warn('TradingView initialization warning:', e);
      }
    }
  }

  function switchChartMode(mode) {
    state.activeMode = mode;
    if (mode === 'tv') {
      btnModeTV.classList.add('active');
      btnModeAlgo.classList.remove('active');
      tvContainer.style.display = 'block';
      algoContainer.style.display = 'none';
      algoControls.style.display = 'none';
      updateTradingViewWidget();
    } else {
      btnModeAlgo.classList.add('active');
      btnModeTV.classList.remove('active');
      tvContainer.style.display = 'none';
      algoContainer.style.display = 'block';
      algoControls.style.display = 'flex';
      chart.resize();
      fetchCandles();
    }
  }

  btnModeTV.addEventListener('click', () => switchChartMode('tv'));
  btnModeAlgo.addEventListener('click', () => switchChartMode('algo'));

  // Audio Alerts
  function playSignalSound(type = 'BUY') {
    if (!state.audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'BUY') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440.00, ctx.currentTime + 0.15);
      }

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio feedback warning', e);
    }
  }

  function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-header">
        <strong>${title}</strong>
        <span style="color: var(--text-muted); font-size: 9px;">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="toast-body">${message}</div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  // Fetch Watchlist Pairs
  async function fetchPairs() {
    try {
      const res = await fetch('/api/pairs');
      const data = await res.json();
      if (data.success) {
        state.pairs = data.pairs;
        renderWatchlist();
        updateMarketHeader();
      }
    } catch (e) {
      console.error('Error fetching pairs:', e);
    }
  }

  function renderWatchlist() {
    watchlistContainerEl.innerHTML = '';
    let filtered = state.pairs;
    if (state.activeFilter === 'majors') {
      filtered = state.pairs.filter(p => p.category === 'Major');
    } else if (state.activeFilter === 'crosses') {
      filtered = state.pairs.filter(p => p.category === 'Cross');
    }

    filtered.forEach(p => {
      const isSelected = p.symbol === state.selectedPair;
      const isPositive = p.changePercent24h >= 0;
      const card = document.createElement('div');
      card.className = `watch-row ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="wr-top">
          <span class="wr-symbol">${p.flag} ${p.symbol}</span>
          <span class="wr-price ${isPositive ? 'bull-text' : 'bear-text'}">${p.price.toFixed(p.pipDecimal)}</span>
        </div>
        <div class="wr-bottom">
          <span>Spread ${p.spread}p</span>
          <span class="wr-delta ${isPositive ? 'badge-bull' : 'badge-bear'}">${isPositive ? '+' : ''}${p.changePercent24h.toFixed(2)}%</span>
        </div>
      `;
      card.addEventListener('click', () => {
        state.selectedPair = p.symbol;
        if (state.activeMode === 'tv') {
          updateTradingViewWidget();
        }
        fetchCandles();
        renderWatchlist();
      });
      watchlistContainerEl.appendChild(card);
    });
  }

  function updateMarketHeader() {
    const currentPairObj = state.pairs.find(p => p.symbol === state.selectedPair);
    if (!currentPairObj) return;

    if (heroPairSymbolEl) heroPairSymbolEl.textContent = `${currentPairObj.flag} ${currentPairObj.symbol}`;
    currentPriceEl.textContent = currentPairObj.price.toFixed(currentPairObj.pipDecimal);
    const isPos = currentPairObj.changePercent24h >= 0;
    const pipDelta = (currentPairObj.change24h * (currentPairObj.pipDecimal === 2 ? 100 : 10000)).toFixed(1);
    priceChangeEl.textContent = `${isPos ? '+' : ''}${currentPairObj.changePercent24h.toFixed(2)}% (${isPos ? '+' : ''}${pipDelta}p)`;
    priceChangeEl.className = `live-price-delta ${isPos ? 'bull-text' : 'bear-text'}`;
  }

  // Fetch Candle Data & Run Analysis
  async function fetchCandles() {
    try {
      const res = await fetch(`/api/candles?pair=${state.selectedPair}&timeframe=${state.selectedTimeframe}&count=140`);
      const data = await res.json();
      if (data.success && data.candles.length) {
        state.candles = data.candles;
        const currentPairObj = state.pairs.find(p => p.symbol === state.selectedPair);
        const pipDecimal = currentPairObj ? currentPairObj.pipDecimal : 4;

        state.patterns = CandlestickPatterns.scanAll(state.candles);
        state.smcData = SMCEngine.analyzeAll(state.candles, pipDecimal);
        const newSignal = SignalEngine.analyze(state.selectedPair, state.selectedTimeframe, state.candles, pipDecimal);
        
        if (newSignal && newSignal.action !== 'HOLD' && (!state.activeSignal || state.activeSignal.decision !== newSignal.decision)) {
          playSignalSound(newSignal.action);
          showToast(`🚨 Institutional ${newSignal.decision}`, `${newSignal.pair} [${newSignal.timeframe.toUpperCase()}] at ${newSignal.entryPrice}. Confidence: ${newSignal.confidence}%`, newSignal.action === 'BUY' ? 'bull' : 'bear');
          
          if (state.autoTrade) {
            executeVirtualTrade(newSignal);
          }
        }

        state.activeSignal = newSignal;

        if (state.activeMode === 'algo') {
          chart.setData(state.candles, pipDecimal, state.activeSignal, state.patterns, state.smcData);
        }

        renderSignalPanel();
        renderConfirmationsList();
        renderSMCDetails();
        renderPatternsList();
        checkVirtualTrades();
        runMTFScan(pipDecimal);
      }
    } catch (e) {
      console.error('Error fetching candles:', e);
    }
  }

  async function runMTFScan(pipDecimal = 4) {
    try {
      const scanRes = await MultiTimeframeScanner.scanPairAllTimeframes(state.selectedPair, pipDecimal);
      state.mtfScanResult = scanRes;
      renderMTFView();
    } catch (e) {
      console.warn('MTF scan error:', e);
    }
  }

  function renderMTFView() {
    if (!state.mtfScanResult) return;
    const { recommendation, timeframeResults } = state.mtfScanResult;

    const alignText = recommendation.alignmentScore ? ` • ${recommendation.alignmentScore}% ALIGNMENT` : '';
    mtfRecTfEl.textContent = `${recommendation.optimalTimeframe.toUpperCase()} (${recommendation.compositeScore}% CONFLUENCE${alignText})`;
    mtfRecActionEl.textContent = `${recommendation.optimalAction} (${recommendation.macroTrend} MACRO)`;
    mtfRecActionEl.className = `mtf-action-pill ${recommendation.optimalAction === 'BUY' ? 'badge-bull' : recommendation.optimalAction === 'SELL' ? 'badge-bear' : 'badge-neutral'}`;

    mtfMatrixChips.forEach(chip => {
      const tf = chip.dataset.tf;
      const tfData = timeframeResults[tf];
      if (tfData) {
        const strongEl = chip.querySelector('strong');
        const dotEl = chip.querySelector('.mtf-dot');
        if (strongEl) {
          strongEl.textContent = tfData.signal;
          strongEl.className = tfData.signal === 'BUY' ? 'bull-text' : tfData.signal === 'SELL' ? 'bear-text' : 'neutral-text';
        }
        if (dotEl) {
          dotEl.className = `mtf-dot ${tfData.signal === 'BUY' ? 'bull' : tfData.signal === 'SELL' ? 'bear' : ''}`;
        }
      }
      chip.classList.toggle('active', tf === state.selectedTimeframe);
    });
  }

  function renderSignalPanel() {
    const sig = state.activeSignal;
    if (!sig) return;

    const currentPairObj = state.pairs.find(p => p.symbol === state.selectedPair);
    const pipDec = currentPairObj ? currentPairObj.pipDecimal : 4;

    if (sig.action === 'BUY') {
      directionBannerEl.className = 'signal-hero-banner bull-theme';
      dirTypeTextEl.textContent = 'HIGH CONFLUENCE INSTITUTIONAL SETUP';
      dirActionTextEl.textContent = '🟢 BUY ORDER';
    } else if (sig.action === 'SELL') {
      directionBannerEl.className = 'signal-hero-banner bear-theme';
      dirTypeTextEl.textContent = 'HIGH CONFLUENCE INSTITUTIONAL SETUP';
      dirActionTextEl.textContent = '🔴 SELL ORDER';
    } else {
      directionBannerEl.className = 'signal-hero-banner neutral-theme';
      dirTypeTextEl.textContent = 'MARKET ACCUMULATION / INDECISION';
      dirActionTextEl.textContent = '⚪ WAIT FOR SETUP';
    }

    signalDecisionEl.textContent = sig.decision;
    signalDecisionEl.className = `${sig.action === 'BUY' ? 'bull-text' : sig.action === 'SELL' ? 'bear-text' : 'neutral-text'}`;
    
    signalBadgeEl.textContent = `${sig.confidence}% CONFLUENCE`;
    signalBadgeEl.className = `conf-pill ${sig.action === 'BUY' ? 'pill-bull' : sig.action === 'SELL' ? 'pill-bear' : 'pill-neutral'}`;
    
    confidenceBarEl.style.width = `${sig.confidence}%`;
    confidenceBarEl.style.background = sig.action === 'BUY' ? 'linear-gradient(90deg, #00f59b, #00d2ff)' : sig.action === 'SELL' ? 'linear-gradient(90deg, #ff3b69, #ff9f1c)' : '#64748b';

    entryPriceEl.textContent = sig.entryPrice.toFixed(pipDec);
    tp1PriceEl.textContent = `${sig.tp1Price.toFixed(pipDec)} (+${sig.tp1Pips}p)`;
    tp2PriceEl.textContent = `${sig.tp2Price.toFixed(pipDec)} (+${sig.tp2Pips}p)`;
    if (tp3PriceEl && sig.tp3Price) {
      tp3PriceEl.textContent = `${sig.tp3Price.toFixed(pipDec)} (+${sig.tp3Pips}p)`;
    }
    if (lotsEl && sig.recommendedLots) {
      lotsEl.textContent = `${sig.recommendedLots} Lots ($100 Risk)`;
    }
    slPriceEl.textContent = `${sig.stopLossPrice.toFixed(pipDec)} (-${sig.stopLossPips}p)`;
    rrrEl.textContent = sig.rrr;
  }

  function renderConfirmationsList() {
    const sig = state.activeSignal;
    if (!sig || !sig.confirmations) return;

    confirmationsCountEl.textContent = `${sig.confirmedCount}/${sig.confirmations.length}`;

    confirmationsListEl.innerHTML = '';
    sig.confirmations.forEach(c => {
      const item = document.createElement('div');
      item.className = 'reason-box';
      const isConfirmed = c.status === 'CONFIRMED';
      const isBull = c.type === 'BULLISH';
      const isBear = c.type === 'BEARISH';
      
      item.innerHTML = `
        <div class="reason-bullet ${isConfirmed ? (isBull ? 'dot-bull' : 'dot-bear') : 'dot-neutral'}"></div>
        <div style="width: 100%;">
          <div class="reason-title" style="display: flex; justify-content: space-between;">
            <span>${c.stage}: <strong>${c.title}</strong></span>
            <span class="${isConfirmed ? (isBull ? 'badge-bull' : 'badge-bear') : 'badge-neutral'}" style="font-size: 9px; padding: 1px 4px; border-radius: 3px;">${c.status}</span>
          </div>
          <div class="reason-detail">${c.desc}</div>
        </div>
      `;
      confirmationsListEl.appendChild(item);
    });
  }

  function renderSMCDetails() {
    if (!state.smcData) return;
    const smc = state.smcData;
    smcObCountEl.textContent = `${smc.activeOBs.length} Active (${smc.activeOBs.filter(o => o.type === 'BULLISH_OB').length} Demand / ${smc.activeOBs.filter(o => o.type === 'BEARISH_OB').length} Supply)`;
    smcFvgCountEl.textContent = `${smc.activeFVGs.length} Unfilled Gaps (${smc.liquiditySweeps ? smc.liquiditySweeps.length : 0} Sweeps / ${smc.liquidityPools ? smc.liquidityPools.length : 0} Pools)`;
    if (smc.equilibrium) {
      smcEqZoneEl.textContent = `${smc.equilibrium.zone.split(' ')[0]} (${smc.equilibrium.discountPercent}%)`;
      smcEqZoneEl.className = `tile-value ${smc.equilibrium.zone.includes('DISCOUNT') ? 'bull-text' : 'bear-text'}`;
    }
  }

  function renderPatternsList() {
    patternsListEl.innerHTML = '';
    const recent = state.patterns.slice(-6).reverse();
    if (!recent.length) {
      patternsListEl.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px;">No major patterns identified in scope.</div>';
      return;
    }

    recent.forEach(pat => {
      const isBull = pat.type === 'BULLISH';
      const item = document.createElement('div');
      item.className = 'reason-box';
      const timeStr = new Date(pat.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.innerHTML = `
        <div class="reason-bullet ${isBull ? 'dot-bull' : pat.type === 'BEARISH' ? 'dot-bear' : 'dot-neutral'}"></div>
        <div style="width: 100%;">
          <div class="reason-title" style="display: flex; justify-content: space-between;">
            <span>${pat.name}</span>
            <span class="${isBull ? 'badge-bull' : 'badge-bear'}" style="font-size: 9px; padding: 1px 4px; border-radius: 3px;">${pat.type}</span>
          </div>
          <div class="reason-detail">${pat.description}</div>
          <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 4px;">
            <span>Price: ${pat.price}</span>
            <span>Time: ${timeStr}</span>
          </div>
        </div>
      `;
      patternsListEl.appendChild(item);
    });
  }

  // Pre-Trade Dossier Modal Controller
  function openPreTradeDossier() {
    const sig = state.activeSignal;
    if (!sig || !sig.dossier) {
      showToast('Dossier Not Ready', 'Please wait for market analysis to complete.', 'info');
      return;
    }

    const d = sig.dossier;
    const currentPairObj = state.pairs.find(p => p.symbol === state.selectedPair);
    const pipDec = currentPairObj ? currentPairObj.pipDecimal : 4;

    dossierPairTfEl.textContent = `${d.pair} • ${d.timeframe.toUpperCase()} TIMEFRAME • ${new Date().toLocaleTimeString()}`;
    dossierThesisEl.textContent = d.tradeThesis;

    dActionEl.textContent = `${d.action} (${d.decision})`;
    dActionEl.className = `d-spec-val ${d.action === 'BUY' ? 'bull-text' : d.action === 'SELL' ? 'bear-text' : 'neutral-text'}`;

    const bestTf = state.mtfScanResult ? state.mtfScanResult.recommendation.optimalTimeframe.toUpperCase() : d.timeframe.toUpperCase();
    dTfEl.textContent = `${bestTf} (Optimal Entry Window)`;
    dEntryEl.textContent = d.entryPrice.toFixed(pipDec);
    dSlEl.textContent = `${d.stopLossPrice.toFixed(pipDec)} (-${d.stopLossPips} pips)`;
    dTp1El.textContent = `${d.tp1Price.toFixed(pipDec)} (+${d.tp1Pips} pips)`;
    dTp2El.textContent = `${d.tp2Price.toFixed(pipDec)} (+${d.tp2Pips} pips)`;
    if (dTp3El && d.tp3Price) {
      dTp3El.textContent = `${d.tp3Price.toFixed(pipDec)} (+${d.tp3Pips} pips)`;
    }
    if (dLotsEl && d.recommendedLots) {
      dLotsEl.textContent = `${d.recommendedLots} Lots ($100 Risk)`;
    }
    dRrrEl.textContent = d.rrr;
    dRiskEl.textContent = d.executionPlan.riskRecommendation;

    dossierConfirmationsListEl.innerHTML = '';
    d.confirmations.forEach(c => {
      const item = document.createElement('div');
      item.className = 'reason-box';
      const isConfirmed = c.status === 'CONFIRMED';
      const isBull = c.type === 'BULLISH';
      const isBear = c.type === 'BEARISH';
      
      item.innerHTML = `
        <div class="reason-bullet ${isConfirmed ? (isBull ? 'dot-bull' : 'dot-bear') : 'dot-neutral'}"></div>
        <div style="width: 100%;">
          <div class="reason-title" style="display: flex; justify-content: space-between;">
            <span>${c.stage}: <strong>${c.title}</strong></span>
            <span class="${isConfirmed ? (isBull ? 'badge-bull' : 'badge-bear') : 'badge-neutral'}" style="font-size: 9px; padding: 1px 4px; border-radius: 3px;">${c.status}</span>
          </div>
          <div class="reason-detail">${c.desc}</div>
        </div>
      `;
      dossierConfirmationsListEl.appendChild(item);
    });

    dossierInvalidationTextEl.textContent = `Setup Invalidation Rule: A candle close beyond ${d.invalidationPrice.toFixed(pipDec)} completely invalidates this institutional premise. TP1 (+${d.tp1Pips}p) takes 50% profit, TP2 (+${d.tp2Pips}p) takes 30% profit, and TP3 (+${d.tp3Pips}p) lets runners ride with stop moved to Breakeven.`;

    dossierModal.style.display = 'flex';
  }

  function closePreTradeDossier() {
    dossierModal.style.display = 'none';
  }

  btnOpenDossier.addEventListener('click', openPreTradeDossier);
  btnCloseDossier.addEventListener('click', closePreTradeDossier);
  btnModalCancel.addEventListener('click', closePreTradeDossier);
  btnModalConfirmTrade.addEventListener('click', () => {
    closePreTradeDossier();
    executeVirtualTrade();
  });

  // Execute Virtual Trade
  function executeVirtualTrade(signal = state.activeSignal) {
    if (!signal || signal.action === 'HOLD') {
      showToast('No Active Signal', 'Cannot execute trade on neutral market condition.', 'neutral');
      return;
    }

    const trade = {
      id: 'TRD-' + Date.now().toString().slice(-5),
      pair: signal.pair,
      type: signal.action,
      timeframe: signal.timeframe,
      entryPrice: signal.entryPrice,
      tp1Price: signal.tp1Price,
      tp2Price: signal.tp2Price,
      slPrice: signal.stopLossPrice,
      tp1Pips: signal.tp1Pips,
      slPips: signal.stopLossPips,
      openTime: new Date().toLocaleTimeString(),
      status: 'OPEN',
      pips: 0
    };

    state.virtualTrades.push(trade);
    showToast(`Order Placed #${trade.id}`, `${trade.type} ${trade.pair} @ ${trade.entryPrice}`, trade.type === 'BUY' ? 'bull' : 'bear');
    renderTradeHistory();
  }

  function checkVirtualTrades() {
    if (!state.virtualTrades.length) return;
    const currentPairObj = state.pairs.find(p => p.symbol === state.selectedPair);
    if (!currentPairObj) return;

    const currentPrice = currentPairObj.price;

    for (let i = state.virtualTrades.length - 1; i >= 0; i--) {
      const trd = state.virtualTrades[i];
      if (trd.pair !== state.selectedPair) continue;

      let closed = false;
      let outcome = '';
      let gainPips = 0;

      if (trd.type === 'BUY') {
        if (currentPrice >= trd.tp1Price) {
          closed = true;
          outcome = 'TP1 HIT';
          gainPips = trd.tp1Pips;
          state.stats.wins++;
        } else if (currentPrice <= trd.slPrice) {
          closed = true;
          outcome = 'SL HIT';
          gainPips = -trd.slPips;
          state.stats.losses++;
        }
      } else if (trd.type === 'SELL') {
        if (currentPrice <= trd.tp1Price) {
          closed = true;
          outcome = 'TP1 HIT';
          gainPips = trd.tp1Pips;
          state.stats.wins++;
        } else if (currentPrice >= trd.slPrice) {
          closed = true;
          outcome = 'SL HIT';
          gainPips = -trd.slPips;
          state.stats.losses++;
        }
      }

      if (closed) {
        trd.status = outcome;
        trd.pips = gainPips;
        trd.closeTime = new Date().toLocaleTimeString();
        state.stats.totalPips += gainPips;

        state.closedTrades.unshift(trd);
        state.virtualTrades.splice(i, 1);

        const totalFinished = state.stats.wins + state.stats.losses;
        state.stats.winRate = totalFinished > 0 ? ((state.stats.wins / totalFinished) * 100).toFixed(1) + '%' : '0.0%';

        showToast(`Trade Result #${trd.id}`, `${trd.status} (${gainPips > 0 ? '+' : ''}${gainPips} pips)`, gainPips > 0 ? 'bull' : 'bear');
      }
    }

    renderStats();
    renderTradeHistory();
  }

  function renderStats() {
    winRateEl.textContent = state.stats.winRate;
    totalPipsEl.textContent = `${state.stats.totalPips >= 0 ? '+' : ''}${state.stats.totalPips} p`;
    totalPipsEl.className = `metric-highlight ${state.stats.totalPips >= 0 ? 'bull-text' : 'bear-text'}`;
    totalTradesEl.textContent = state.stats.wins + state.stats.losses + state.virtualTrades.length;
  }

  function renderTradeHistory() {
    tradeHistoryTableEl.innerHTML = '';
    const all = [...state.virtualTrades, ...state.closedTrades];
    if (!all.length) {
      tradeHistoryTableEl.innerHTML = '<tr><td colspan="7" class="text-center" style="text-align: center; color: var(--text-muted); padding: 14px;">No active virtual trades recorded yet.</td></tr>';
      return;
    }

    all.forEach(t => {
      const row = document.createElement('tr');
      const isWin = t.pips > 0;
      row.innerHTML = `
        <td><strong>#${t.id}</strong></td>
        <td>${t.pair} (${t.timeframe})</td>
        <td><span class="${t.type === 'BUY' ? 'badge-bull' : 'badge-bear'}" style="padding: 1px 5px; border-radius: 3px; font-weight: 700;">${t.type}</span></td>
        <td>${t.entryPrice}</td>
        <td><span class="${t.status === 'OPEN' ? 'status-active' : isWin ? 'badge-bull' : 'badge-bear'}" style="padding: 1px 5px; border-radius: 3px; font-weight: 700;">${t.status}</span></td>
        <td class="${isWin ? 'bull-text' : t.pips < 0 ? 'bear-text' : ''}">${t.status === 'OPEN' ? 'Active' : (t.pips > 0 ? '+' : '') + t.pips + ' p'}</td>
        <td>${t.openTime}</td>
      `;
      tradeHistoryTableEl.appendChild(row);
    });
  }

  // Timeframe Controls
  timeframeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timeframeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedTimeframe = btn.dataset.tf;
      state.selectedTVInterval = btn.dataset.tv;
      if (state.activeMode === 'tv') {
        updateTradingViewWidget();
      }
      fetchCandles();
    });
  });

  mtfMatrixChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const tf = chip.dataset.tf;
      const matchingBtn = document.querySelector(`.tf-item[data-tf="${tf}"]`);
      if (matchingBtn) {
        matchingBtn.click();
      }
    });
  });

  document.querySelectorAll('.overlay-toggle').forEach(chk => {
    chk.addEventListener('change', () => {
      chart.toggleOverlay(chk.dataset.overlay);
    });
  });

  audioToggleBtn.addEventListener('click', () => {
    state.audioEnabled = !state.audioEnabled;
    audioToggleBtn.classList.toggle('active', state.audioEnabled);
    audioToggleBtn.textContent = state.audioEnabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
  });

  autoTradeToggleBtn.addEventListener('click', () => {
    state.autoTrade = !state.autoTrade;
    autoTradeToggleBtn.classList.toggle('active', state.autoTrade);
    autoTradeToggleBtn.textContent = state.autoTrade ? '⚡ Auto-Sim: ON' : '⚡ Auto-Sim: OFF';
    showToast('Auto Trade Simulator', state.autoTrade ? 'Signals will now be automatically simulated!' : 'Auto-execution disabled.', 'info');
  });

  executeTradeBtn.addEventListener('click', () => {
    executeVirtualTrade();
  });

  // Initial Boot
  fetchMarketSessions();
  fetchPairs().then(() => {
    fetchCandles();
    updateTradingViewWidget();
  });
  
  // Real-time loop
  setInterval(() => {
    fetchPairs();
    checkVirtualTrades();
  }, 1400);

  setInterval(() => {
    fetchCandles();
    fetchMarketSessions();
  }, 4000);
});
