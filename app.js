class BitcoinPriceTracker {
  constructor() {
    // Using APIs that actually support CORS for static hosting
    this.binanceApiUrl = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
    this.krakenApiUrl = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';
    this.coingeckoProxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true');

    this.lastPrice = null;
    this.isLoading = false;

    this.initializeElements();
    this.registerServiceWorker();
    this.setupEventListeners();
    this.fetchBitcoinPrice(); // Initial fetch only
  }

  initializeElements() {
    this.elements = {
      price: document.getElementById('price'),
      change: document.getElementById('change'),
      changePercent: document.getElementById('changePercent'),
      lastUpdated: document.getElementById('lastUpdated'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      high24h: document.getElementById('high24h'),
      low24h: document.getElementById('low24h'),
      marketCap: document.getElementById('marketCap'),
      volume24h: document.getElementById('volume24h'),
      updateBtn: document.getElementById('updateBtn')
    };
  }

  setupEventListeners() {
    this.elements.updateBtn.addEventListener('click', () => {
      this.fetchBitcoinPrice();
    });
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered successfully:', registration);
      } catch (error) {
        console.log('Service Worker registration failed:', error);
      }
    }
  }

  async fetchBitcoinPrice() {
    if (this.isLoading) return; // Prevent multiple simultaneous requests

    try {
      this.isLoading = true;
      this.updateStatus('connecting', 'Fetching data...');
      this.setButtonLoading(true);

      // Try Binance API first (best CORS support and data)
      let priceData = await this.fetchBinanceAPI();

      if (!priceData) {
        // Fallback to proxied CoinGecko API
        priceData = await this.fetchProxiedCoinGeckoAPI();
      }

      if (!priceData) {
        // Final fallback to Kraken
        priceData = await this.fetchKrakenAPI();
      }

      if (priceData) {
        this.updatePrice(priceData.price);
        this.updateChange(priceData.change24h, priceData.changePercent);
        this.updateMarketData(priceData.marketData);
        this.updateLastUpdated();
        this.updateStatus('connected', 'Data updated');
      } else {
        throw new Error('All APIs failed');
      }

    } catch (error) {
      console.error('Error fetching Bitcoin price:', error);
      this.updateStatus('error', 'Update failed - check connection');
    } finally {
      this.isLoading = false;
      this.setButtonLoading(false);
    }
  }

  async fetchBinanceAPI() {
    try {
      const response = await fetch(this.binanceApiUrl);

      if (!response.ok) {
        throw new Error(`Binance API error! status: ${response.status}`);
      }

      const data = await response.json();

      const price = parseFloat(data.lastPrice);
      const change24h = parseFloat(data.priceChange); // Use absolute price change, not percentage
      const changePercent = parseFloat(data.priceChangePercent); // Get the exact percentage from API
      const volume24h = parseFloat(data.quoteVolume); // Use quote volume (already in USD)

      return {
        price: price,
        change24h: change24h,
        changePercent: changePercent, // Include the exact percentage
        marketData: {
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          marketCap: price * 19700000, // Approximate circulating supply
          volume24h: volume24h
        }
      };
    } catch (error) {
      console.log('Binance API failed:', error.message);
      return null;
    }
  }

  async fetchProxiedCoinGeckoAPI() {
    try {
      const response = await fetch(this.coingeckoProxyUrl);

      if (!response.ok) {
        throw new Error(`Proxy API error! status: ${response.status}`);
      }

      const proxyData = await response.json();
      const data = JSON.parse(proxyData.contents);
      const bitcoin = data.bitcoin;

      // Calculate absolute change from percentage
      const changePercent = bitcoin.usd_24h_change;
      const absoluteChange = (bitcoin.usd * changePercent) / 100;

      return {
        price: bitcoin.usd,
        change24h: absoluteChange,
        changePercent: changePercent, // Use the exact percentage from API
        marketData: {
          high24h: bitcoin.usd * 1.02, // Approximate based on current price
          low24h: bitcoin.usd * 0.98,  // Approximate based on current price
          marketCap: bitcoin.usd_market_cap,
          volume24h: bitcoin.usd_24h_vol
        }
      };
    } catch (error) {
      console.log('Proxied CoinGecko API failed:', error.message);
      return null;
    }
  }

  async fetchKrakenAPI() {
    try {
      const response = await fetch(this.krakenApiUrl);

      if (!response.ok) {
        throw new Error(`Kraken API error! status: ${response.status}`);
      }

      const data = await response.json();
      const ticker = data.result.XXBTZUSD;

      const price = parseFloat(ticker.c[0]); // Current price
      const high24h = parseFloat(ticker.h[1]); // 24h high
      const low24h = parseFloat(ticker.l[1]); // 24h low
      const volume24h = parseFloat(ticker.v[1]) * price; // 24h volume

      // Calculate absolute 24h change and percentage
      const open24h = parseFloat(ticker.o); // Opening price
      const absoluteChange = price - open24h;
      const changePercent = open24h !== 0 ? (absoluteChange / open24h) * 100 : 0;

      return {
        price: price,
        change24h: absoluteChange,
        changePercent: changePercent,
        marketData: {
          high24h: high24h,
          low24h: low24h,
          marketCap: price * 19700000, // Approximate circulating supply
          volume24h: volume24h
        }
      };
    } catch (error) {
      console.log('Kraken API failed:', error.message);
      return null;
    }
  }

  updatePrice(newPrice) {
    const formattedPrice = this.formatCurrency(newPrice);

    // Add flash animation if price changed
    if (this.lastPrice !== null && this.lastPrice !== newPrice) {
      this.elements.price.classList.add('flash');
      setTimeout(() => this.elements.price.classList.remove('flash'), 500);
    }

    this.elements.price.textContent = formattedPrice;
    this.lastPrice = newPrice;
  }

  updateChange(change24h, changePercent) {
    const formattedChange = this.formatCurrency(Math.abs(change24h));
    const formattedPercent = Math.abs(changePercent).toFixed(2);

    // Remove existing classes
    this.elements.change.className = 'change';
    this.elements.changePercent.className = 'change-percent';

    // Add appropriate class based on positive/negative change
    const changeClass = change24h >= 0 ? 'positive' : 'negative';
    this.elements.change.classList.add(changeClass);
    this.elements.changePercent.classList.add(changeClass);

    // Update content
    const sign = change24h >= 0 ? '+' : '-';
    this.elements.change.textContent = `${sign}$${formattedChange}`;
    this.elements.changePercent.textContent = `${sign}${formattedPercent}%`;
  }

  updateMarketData(data) {
    this.elements.high24h.textContent = this.formatCurrency(data.high24h);
    this.elements.low24h.textContent = this.formatCurrency(data.low24h);
    this.elements.marketCap.textContent = this.formatLargeNumber(data.marketCap);
    this.elements.volume24h.textContent = this.formatLargeNumber(data.volume24h);
  }

  updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.elements.lastUpdated.textContent = timeString;
  }

  updateStatus(status, text) {
    this.elements.statusDot.className = `status-dot ${status}`;
    this.elements.statusText.textContent = text;
  }

  setButtonLoading(loading) {
    if (loading) {
      this.elements.updateBtn.classList.add('loading');
      this.elements.updateBtn.disabled = true;
    } else {
      this.elements.updateBtn.classList.remove('loading');
      this.elements.updateBtn.disabled = false;
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatLargeNumber(num) {
    if (num >= 1e12) {
      return `$${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    } else {
      return `$${this.formatCurrency(num)}`;
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const tracker = new BitcoinPriceTracker();

  // Handle online/offline events
  window.addEventListener('offline', () => {
    tracker.updateStatus('error', 'Offline');
  });

  window.addEventListener('online', () => {
    tracker.updateStatus('connected', 'Back online');
  });
});
