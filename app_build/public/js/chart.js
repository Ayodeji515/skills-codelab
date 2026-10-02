/**
 * Interactive Financial Candlestick & SMC Overlay Charting Engine
 * Built with HTML5 Canvas. Supports FVG, Order Blocks, BOS/CHoCH structures, EMAs, and Bollinger Bands.
 */
class ForexChart {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.candles = [];
    this.overlays = {
      ema9: true,
      ema21: true,
      ema50: false,
      bollinger: true,
      patterns: true,
      signals: true,
      smc: true
    };

    this.pipDecimal = 4;
    this.visibleCandles = 65;
    this.scrollOffset = 0;
    this.mousePos = null;
    this.isDragging = false;
    this.dragStartX = 0;

    this.activeSignal = null;
    this.activePatterns = [];
    this.smcData = null;

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);

    this.render();
  }

  setData(candles, pipDecimal = 4, signal = null, patterns = [], smcData = null) {
    this.candles = candles || [];
    this.pipDecimal = pipDecimal;
    this.activeSignal = signal;
    this.activePatterns = patterns || [];
    this.smcData = smcData;
    this.render();
  }

  toggleOverlay(key) {
    if (this.overlays.hasOwnProperty(key)) {
      this.overlays[key] = !this.overlays[key];
      this.render();
    }
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      if (this.isDragging) {
        const deltaX = this.mousePos.x - this.dragStartX;
        const candleWidth = this.width / this.visibleCandles;
        const offsetDelta = Math.round(deltaX / candleWidth);
        this.scrollOffset = Math.max(0, Math.min(this.candles.length - this.visibleCandles, this.scrollOffset - offsetDelta));
        this.dragStartX = this.mousePos.x;
      }

      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mousePos = null;
      this.isDragging = false;
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.canvas.getBoundingClientRect().left;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.visibleCandles = Math.max(25, this.visibleCandles - 4);
      } else {
        this.visibleCandles = Math.min(180, this.visibleCandles + 4);
      }
      this.render();
    });
  }

  render() {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    // Clear Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    if (!this.candles || this.candles.length === 0) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading live market data...', width / 2, height / 2);
      return;
    }

    // Chart margins
    const rightMargin = 75;
    const bottomMargin = 28;
    const topMargin = 20;
    const chartWidth = width - rightMargin;
    const chartHeight = height - bottomMargin - topMargin;
    const volumeHeight = chartHeight * 0.18;
    const priceChartHeight = chartHeight - volumeHeight;

    // Slicing visible window
    const totalCandles = this.candles.length;
    const startIndex = Math.max(0, totalCandles - this.visibleCandles - this.scrollOffset);
    const endIndex = Math.min(totalCandles, startIndex + this.visibleCandles);
    const visibleData = this.candles.slice(startIndex, endIndex);

    if (visibleData.length === 0) return;

    // Price Bounds
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    visibleData.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVolume) maxVolume = c.volume;
    });

    const pricePadding = (maxPrice - minPrice) * 0.08 || 0.001;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice;

    // Coordinate Mappers
    const getX = (indexInVisible) => (indexInVisible + 0.5) * (chartWidth / visibleData.length);
    const getY = (price) => topMargin + priceChartHeight - ((price - minPrice) / priceRange) * priceChartHeight;
    const getVolY = (vol) => topMargin + priceChartHeight + volumeHeight - (vol / (maxVolume || 1)) * volumeHeight;

    // 1. Draw Grid Lines
    ctx.strokeStyle = '#1e2632';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const y = topMargin + (priceChartHeight / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const priceAtY = maxPrice - (i / gridSteps) * priceRange;
      ctx.fillStyle = '#8b949e';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(priceAtY.toFixed(this.pipDecimal), chartWidth + 8, y + 4);
    }
    ctx.setLineDash([]);

    // 2. Draw Smart Money Concepts (SMC) Overlays: Order Blocks & FVGs
    if (this.overlays.smc && this.smcData) {
      // Draw Order Blocks (OB)
      if (this.smcData.activeOBs) {
        this.smcData.activeOBs.forEach(ob => {
          const visIdx = ob.index - startIndex;
          if (visIdx >= 0 || true) {
            const startX = Math.max(0, getX(Math.max(0, visIdx)));
            const topY = getY(ob.high);
            const bottomY = getY(ob.low);
            const obHeight = Math.max(3, bottomY - topY);

            const isBull = ob.type === 'BULLISH_OB';
            ctx.fillStyle = isBull ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 59, 105, 0.12)';
            ctx.fillRect(startX, topY, chartWidth - startX, obHeight);

            ctx.strokeStyle = isBull ? 'rgba(0, 245, 155, 0.4)' : 'rgba(255, 59, 105, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(startX, topY, chartWidth - startX, obHeight);

            // Label
            ctx.fillStyle = isBull ? '#00f59b' : '#ff3b69';
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.fillText(isBull ? 'DEMAND OB' : 'SUPPLY OB', chartWidth - 70, topY + 10);
          }
        });
      }

      // Draw Fair Value Gaps (FVG)
      if (this.smcData.activeFVGs) {
        this.smcData.activeFVGs.forEach(fvg => {
          const startX = Math.max(0, getX(Math.max(0, fvg.startIndex - startIndex)));
          const topY = getY(fvg.top);
          const bottomY = getY(fvg.bottom);
          const fvgHeight = Math.max(2, bottomY - topY);

          const isBull = fvg.type === 'BULLISH_FVG';
          ctx.fillStyle = isBull ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 159, 28, 0.15)';
          ctx.fillRect(startX, topY, chartWidth - startX, fvgHeight);

          ctx.strokeStyle = isBull ? '#00d2ff' : '#ff9f1c';
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(startX, topY, chartWidth - startX, fvgHeight);
          ctx.setLineDash([]);

          ctx.fillStyle = isBull ? '#00d2ff' : '#ff9f1c';
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillText(isBull ? '+FVG' : '-FVG', chartWidth - 35, topY + 8);
        });
      }

      // Draw BOS & CHoCH Structure Break Lines
      if (this.smcData.structures) {
        this.smcData.structures.forEach(st => {
          const visIdx = st.index - startIndex;
          if (visIdx >= 0 && visIdx < visibleData.length) {
            const x = getX(visIdx);
            const y = getY(st.price);
            const isBull = st.direction === 'BULLISH';

            ctx.strokeStyle = isBull ? '#00f59b' : '#ff3b69';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.moveTo(x - 30, y);
            ctx.lineTo(x + 20, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = isBull ? '#00f59b' : '#ff3b69';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.fillText(st.type.split(' ')[0], x - 10, isBull ? y - 6 : y + 12);
          }
        });
      }
    }

    // 3. Draw Technical Overlays (Bollinger Bands & EMAs)
    if (this.overlays.bollinger) {
      const bb = Indicators.calculateBollingerBands(this.candles, 20, 2);
      ctx.fillStyle = 'rgba(0, 210, 255, 0.04)';
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < visibleData.length; i++) {
        const fullIdx = startIndex + i;
        if (bb.upper[fullIdx] !== null) {
          const x = getX(i);
          const y = getY(bb.upper[fullIdx]);
          if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
          else ctx.lineTo(x, y);
        }
      }
      for (let i = visibleData.length - 1; i >= 0; i--) {
        const fullIdx = startIndex + i;
        if (bb.lower[fullIdx] !== null) {
          const x = getX(i);
          const y = getY(bb.lower[fullIdx]);
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      ['upper', 'lower'].forEach(k => {
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < visibleData.length; i++) {
          const val = bb[k][startIndex + i];
          if (val !== null) {
            const x = getX(i);
            const y = getY(val);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });
    }

    // EMA Overlays
    const drawEMA = (period, color) => {
      const emaVals = Indicators.calculateEMA(this.candles, period);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visibleData.length; i++) {
        const val = emaVals[startIndex + i];
        if (val !== null) {
          const x = getX(i);
          const y = getY(val);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    if (this.overlays.ema9) drawEMA(9, '#00d2ff');
    if (this.overlays.ema21) drawEMA(21, '#ff9f1c');
    if (this.overlays.ema50) drawEMA(50, '#9d4edd');

    // 4. Draw Volume Bars
    const candleSpacing = chartWidth / visibleData.length;
    const barWidth = Math.max(1, candleSpacing * 0.7);

    visibleData.forEach((c, i) => {
      const x = getX(i);
      const isBull = c.close >= c.open;
      const volY = getVolY(c.volume);
      const volHeight = (topMargin + priceChartHeight + volumeHeight) - volY;

      ctx.fillStyle = isBull ? 'rgba(0, 245, 155, 0.2)' : 'rgba(255, 59, 105, 0.2)';
      ctx.fillRect(x - barWidth / 2, volY, barWidth, volHeight);
    });

    // 5. Draw Candlesticks
    visibleData.forEach((c, i) => {
      const x = getX(i);
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);
      const isBull = c.close >= c.open;

      const bodyColor = isBull ? '#00f59b' : '#ff3b69';
      ctx.strokeStyle = bodyColor;
      ctx.fillStyle = bodyColor;
      ctx.lineWidth = 1.2;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    });

    // 6. Draw Active Signal Targets (Entry, TP1, TP2, SL)
    if (this.overlays.signals && this.activeSignal && this.activeSignal.action !== 'HOLD') {
      const sig = this.activeSignal;
      this.drawTargetLine(ctx, chartWidth, getY(sig.entryPrice), `#ffd166`, `ENTRY ${sig.entryPrice.toFixed(this.pipDecimal)}`);
      this.drawTargetLine(ctx, chartWidth, getY(sig.tp1Price), `#00f59b`, `TP1 (+${sig.tp1Pips}p)`);
      this.drawTargetLine(ctx, chartWidth, getY(sig.tp2Price), `#00f59b`, `TP2 (+${sig.tp2Pips}p)`);
      this.drawTargetLine(ctx, chartWidth, getY(sig.stopLossPrice), `#ff3b69`, `SL (-${sig.stopLossPips}p)`);
    }

    // 7. Draw Candlestick Pattern Badges
    if (this.overlays.patterns && this.activePatterns.length > 0) {
      this.activePatterns.forEach(pat => {
        const visIdx = pat.index - startIndex;
        if (visIdx >= 0 && visIdx < visibleData.length) {
          const c = visibleData[visIdx];
          const x = getX(visIdx);
          const isBull = pat.type === 'BULLISH';
          const y = isBull ? getY(c.low) + 16 : getY(c.high) - 16;

          ctx.fillStyle = isBull ? '#00f59b' : '#ff3b69';
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(pat.name.split(' ')[0], x, isBull ? y + 12 : y - 8);
        }
      });
    }

    // 8. Interactive Crosshair & Tooltip
    if (this.mousePos && this.mousePos.x <= chartWidth && this.mousePos.y <= height - bottomMargin) {
      const mouseX = this.mousePos.x;
      const mouseY = this.mousePos.y;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      ctx.beginPath();
      ctx.moveTo(mouseX, 0);
      ctx.lineTo(mouseX, height - bottomMargin);
      ctx.moveTo(0, mouseY);
      ctx.lineTo(chartWidth, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);

      const hoveredPrice = maxPrice - ((mouseY - topMargin) / priceChartHeight) * priceRange;
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(chartWidth + 2, mouseY - 10, rightMargin - 4, 20);
      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hoveredPrice.toFixed(this.pipDecimal), chartWidth + (rightMargin / 2), mouseY + 4);

      const candleIdx = Math.floor(mouseX / candleSpacing);
      if (candleIdx >= 0 && candleIdx < visibleData.length) {
        const c = visibleData[candleIdx];
        const dateStr = new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        ctx.fillStyle = '#161b22';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.fillRect(10, 8, 380, 22);
        ctx.strokeRect(10, 8, 380, 22);

        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#8b949e';
        ctx.fillText(`O:`, 18, 23);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${c.open.toFixed(this.pipDecimal)}`, 32, 23);

        ctx.fillStyle = '#8b949e';
        ctx.fillText(`H:`, 95, 23);
        ctx.fillStyle = '#00f59b';
        ctx.fillText(`${c.high.toFixed(this.pipDecimal)}`, 110, 23);

        ctx.fillStyle = '#8b949e';
        ctx.fillText(`L:`, 175, 23);
        ctx.fillStyle = '#ff3b69';
        ctx.fillText(`${c.low.toFixed(this.pipDecimal)}`, 188, 23);

        ctx.fillStyle = '#8b949e';
        ctx.fillText(`C:`, 255, 23);
        ctx.fillStyle = c.close >= c.open ? '#00f59b' : '#ff3b69';
        ctx.fillText(`${c.close.toFixed(this.pipDecimal)}`, 270, 23);

        ctx.fillStyle = '#8b949e';
        ctx.fillText(`Time: ${dateStr}`, 335, 23);
      }
    }

    // 9. Time Axis Labels at bottom
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(visibleData.length / 6));
    for (let i = 0; i < visibleData.length; i += step) {
      const c = visibleData[i];
      const x = getX(i);
      const timeStr = new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(timeStr, x, height - 8);
    }
  }

  drawTargetLine(ctx, chartWidth, y, color, label) {
    if (y < 0 || y > this.height) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.fillRect(chartWidth - 110, y - 9, 105, 18);
    ctx.fillStyle = '#0a0d14';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, chartWidth - 58, y + 3);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForexChart;
}
