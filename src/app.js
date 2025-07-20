class CryptoPriceTracker {
  constructor() {
    this.currentCrypto = 'bitcoin';
    this.lastPrice = null;
    this.isLoading = false;
    this.alerts = [];
    this.notificationPermission = 'default';

    // Cryptocurrency configurations
    this.cryptoConfig = {
      bitcoin: {
        name: 'Bitcoin',
        symbol: 'BTC',
        icon: '₿',
        color: '#f7931a',
        binanceSymbol: 'BTCUSDT',
        krakenSymbol: 'XBTUSD',
        coingeckoId: 'bitcoin',
        circulatingSupply: 19700000 // Approximate BTC circulating supply (as of 2024)
      },
      ethereum: {
        name: 'Ethereum',
        symbol: 'ETH',
        icon: 'Ξ',
        color: '#627eea',
        binanceSymbol: 'ETHUSDT',
        krakenSymbol: 'XETHZUSD',
        coingeckoId: 'ethereum',
        circulatingSupply: 120000000 // Approximate ETH circulating supply (as of 2024)
      },
      solana: {
        name: 'Solana',
        symbol: 'SOL',
        icon: '◎',
        color: '#9945ff',
        binanceSymbol: 'SOLUSDT',
        krakenSymbol: 'SOLUSD',
        coingeckoId: 'solana',
        circulatingSupply: 400000000 // Approximate SOL circulating supply (as of 2024)
      }
    };

    this.initializeElements();
    this.registerServiceWorker();
    this.setupEventListeners();
    this.updateTheme();

    // Initialize notification permission status without requesting
    this.initializeNotificationPermission();

    // Load alerts after everything is initialized
    this.alerts = this.loadAlertsFromStorage();
    this.renderAlerts();

    this.fetchCryptoPrice(); // Initial fetch only
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
      updateBtn: document.getElementById('updateBtn'),
      cryptoIcon: document.getElementById('cryptoIcon'),
      appTitle: document.getElementById('appTitle'),
      cryptoButtons: document.querySelectorAll('.crypto-btn'),
      alertCondition: document.getElementById('alertCondition'),
      alertPrice: document.getElementById('alertPrice'),
      addAlertBtn: document.getElementById('addAlertBtn'),
      alertsList: document.getElementById('alertsList')
    };
  }

  setupEventListeners() {
    this.elements.updateBtn.addEventListener('click', () => {
      // this.fetchCryptoPrice();
      return
    });

    this.elements.cryptoButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const crypto = e.currentTarget.dataset.crypto;
        this.switchCrypto(crypto);
      });
    });

    // Alert form listeners
    this.elements.addAlertBtn.addEventListener('click', () => {
      this.addAlert();
    });

    this.elements.alertPrice.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addAlert();
      }
    });
  }

  switchCrypto(crypto) {
    if (this.currentCrypto === crypto || this.isLoading) return;

    // Update active button
    this.elements.cryptoButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.crypto === crypto) {
        btn.classList.add('active');
      }
    });

    this.currentCrypto = crypto;
    this.lastPrice = null;
    this.updateTheme();
    this.renderAlerts();
    this.fetchCryptoPrice();
  }

  updateTheme() {
    const config = this.cryptoConfig[this.currentCrypto];
    const root = document.documentElement;

    root.style.setProperty('--primary-color', config.color);
    root.style.setProperty('--gradient', `linear-gradient(135deg, ${config.color}, ${this.lightenColor(config.color, 20)})`);

    // Update meta theme-color for browser UI
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', config.color);
    }

    this.elements.cryptoIcon.textContent = config.icon;
    this.elements.appTitle.textContent = `${config.name} Price Tracker`;
  }

  /**
   * Lightens a given hex color by a specified percentage.
   *
   * @param {string} color - The color to lighten, in hex format (e.g., "#RRGGBB").
   * @param {number} percent - The percentage to lighten the color, ranging from -100 to 100.
   *                          Positive values lighten the color, while negative values darken it.
   * @returns {string} - The lightened color in hex format (e.g., "#RRGGBB").
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = this.clampRGB((num >> 16) + amt);
    const G = this.clampRGB((num >> 8 & 0x00FF) + amt);
    const B = this.clampRGB((num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  clampRGB(value) {
    return Math.max(0, Math.min(255, value));
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

  async fetchCryptoPrice() {
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
      console.error(`Error fetching ${this.cryptoConfig[this.currentCrypto].name} price:`, error);
      this.updateStatus('error', 'Update failed - check connection');
    } finally {
      this.isLoading = false;
      this.setButtonLoading(false);
    }
  }

  async fetchBinanceAPI() {
    try {
      const config = this.cryptoConfig[this.currentCrypto];
      const binanceApiUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${config.binanceSymbol}`;
      const response = await fetch(binanceApiUrl);

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
          marketCap: price * config.circulatingSupply,
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
      const config = this.cryptoConfig[this.currentCrypto];
      const coingeckoProxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(`https://api.coingecko.com/api/v3/simple/price?ids=${config.coingeckoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`);
      const response = await fetch(coingeckoProxyUrl);

      if (!response.ok) {
        throw new Error(`Proxy API error! status: ${response.status}`);
      }

      const proxyData = await response.json();
      const data = JSON.parse(proxyData.contents);
      const cryptoData = data[config.coingeckoId];

      // Calculate absolute change from percentage
      const changePercent = cryptoData.usd_24h_change;
      const absoluteChange = (cryptoData.usd * changePercent) / 100;

      return {
        price: cryptoData.usd,
        change24h: absoluteChange,
        changePercent: changePercent, // Use the exact percentage from API
        marketData: {
          high24h: cryptoData.usd_high_24h,
          low24h: cryptoData.usd_low_24h,
          marketCap: cryptoData.usd_market_cap,
          volume24h: cryptoData.usd_24h_vol
        }
      };
    } catch (error) {
      console.log('Proxied CoinGecko API failed:', error.message);
      return null;
    }
  }

  async fetchKrakenAPI() {
    try {
      const config = this.cryptoConfig[this.currentCrypto];
      const krakenApiUrl = `https://api.kraken.com/0/public/Ticker?pair=${config.krakenSymbol}`;
      const response = await fetch(krakenApiUrl);

      if (!response.ok) {
        throw new Error(`Kraken API error! status: ${response.status}`);
      }

      const data = await response.json();

      // Kraken returns different key formats for different pairs
      let ticker;
      const possibleKeys = Object.keys(data.result);
      if (possibleKeys.length > 0) {
        ticker = data.result[possibleKeys[0]]; // Use the first (and usually only) key
      } else {
        throw new Error('No ticker data found in Kraken response');
      }

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
          marketCap: price * config.circulatingSupply,
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

    // Check alerts before updating lastPrice
    this.checkAlerts(newPrice);

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

  // Alert Management Methods
  initializeNotificationPermission() {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      // Only request permission if it hasn't been determined yet
      if (this.notificationPermission === 'default') {
        this.notificationPermission = await Notification.requestPermission();
      }
      return this.notificationPermission;
    }
    return 'denied';
  }

  async addAlert() {
    const condition = this.elements.alertCondition.value;
    const priceValue = parseFloat(this.elements.alertPrice.value);

    if (!priceValue || priceValue <= 0) {
      this.showAlertConfirmation('Please enter a valid price', 'alert');
      return;
    }

    // Request notification permission when creating first alert
    if (this.notificationPermission === 'default') {
      await this.requestNotificationPermission();
    }

    const priceAlert = {
      id: Date.now().toString(),
      crypto: this.currentCrypto,
      condition: condition,
      price: priceValue,
      created: new Date().toISOString()
    };

    this.alerts.push(priceAlert);
    this.saveAlertsToStorage();
    this.renderAlerts();

    // Clear form
    this.elements.alertPrice.value = '';

    // Show confirmation with permission status
    const permissionNote = this.notificationPermission === 'granted' ?
      '' : ' (Enable notifications in your browser to receive alerts)';
    this.showAlertConfirmation(`Alert added: ${this.cryptoConfig[this.currentCrypto].name} ${condition} $${this.formatCurrency(priceValue)}${permissionNote}`);
  }

  removeAlert(alertId) {
    this.alerts = this.alerts.filter(alertItem => alertItem.id !== alertId);
    this.saveAlertsToStorage();
    this.renderAlerts();
  }

  checkAlerts(currentPrice) {
    const currentCryptoAlerts = this.alerts.filter(alertItem => alertItem.crypto === this.currentCrypto);
    const triggeredAlerts = [];

    currentCryptoAlerts.forEach(alertItem => {
      let shouldTrigger = false;

      if (alertItem.condition === 'above' && currentPrice >= alertItem.price) {
        shouldTrigger = true;
      } else if (alertItem.condition === 'below' && currentPrice <= alertItem.price) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        triggeredAlerts.push(alertItem);
      }
    });

    // If multiple alerts triggered, show them all
    if (triggeredAlerts.length > 0) {
      this.triggerMultipleAlerts(triggeredAlerts, currentPrice);
    }
  }

  triggerAlert(alertItem, currentPrice, notificationIndex = 0) {
    const cryptoConfig = this.cryptoConfig[alertItem.crypto];
    const title = `${cryptoConfig.name} Price Alert`;
    const body = `${cryptoConfig.name} is now ${alertItem.condition} $${this.formatCurrency(alertItem.price)}! Current price: $${this.formatCurrency(currentPrice)}`;

    // Show browser notification if permission granted
    if (this.notificationPermission === 'granted') {
      this.showNotification(title, body, alertItem.id);
    }

    // Also show an in-app alert with calculated position
    this.showAlertConfirmation(`🔔 ${body}`, 'alert', notificationIndex);
  }

  triggerMultipleAlerts(triggeredAlerts, currentPrice) {
    // Show individual notifications for each alert with calculated positions
    triggeredAlerts.forEach((alertItem, index) => {
      setTimeout(() => {
        this.triggerAlert(alertItem, currentPrice, index);
      }, index * 100); // Reduced stagger time since positioning is now calculated
    });
  }

  showNotification(title, body, tag = null) {
    if ('serviceWorker' in navigator && this.notificationPermission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        // Generate unique tag if not provided to allow multiple notifications
        const uniqueTag = tag || `price-alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        registration.showNotification(title, {
          body: body,
          icon: './icons/icon-192x192.svg',
          badge: './icons/icon-192x192.svg',
          tag: uniqueTag,
          requireInteraction: true
        });
      });
    }
  }

  showAlertConfirmation(message, type = 'success', predefinedIndex = null) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = `alert-notification ${type}`;
    notification.textContent = message;

    // Calculate position - use predefined index for multiple alerts or count existing
    const existingNotifications = document.querySelectorAll('.alert-notification');
    const notificationIndex = predefinedIndex !== null ? predefinedIndex : existingNotifications.length;
    const notificationHeight = 90; // Increased height to prevent overlap
    const topOffset = 20 + (notificationIndex * notificationHeight);

    notification.style.cssText = `
      position: fixed;
      top: ${topOffset}px;
      right: 20px;
      background: ${type === 'alert' ? '#ff6b6b' : '#00d4aa'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: ${1000 + notificationIndex};
      max-width: 320px;
      min-height: 60px;
      font-weight: 600;
      animation: slideIn 0.3s ease;
      transition: all 0.3s ease;
      margin-bottom: 20px;
      line-height: 1.4;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
          // Reposition remaining notifications
          this.repositionNotifications();
        }
      }, 300);
    }, 6000); // Show for 6 seconds to give time to read multiple notifications
  }

  repositionNotifications() {
    const notifications = document.querySelectorAll('.alert-notification');
    const notificationHeight = 90;
    notifications.forEach((notification, index) => {
      notification.style.top = `${20 + (index * notificationHeight)}px`;
      notification.style.zIndex = `${1000 + index}`;
    });
  }

  renderAlerts() {
    const currentCryptoAlerts = this.alerts.filter(alertItem => alertItem.crypto === this.currentCrypto);

    if (currentCryptoAlerts.length === 0) {
      this.elements.alertsList.innerHTML = '<div class="alerts-empty">No price alerts set for ' + this.cryptoConfig[this.currentCrypto].name + '</div>';
      return;
    }

    this.elements.alertsList.innerHTML = currentCryptoAlerts.map(alertItem => {
      return `
        <div class="alert-item active" data-alert-id="${alertItem.id}">
          <div class="alert-details">
            <div class="alert-condition">
              ${this.cryptoConfig[alertItem.crypto].icon} ${alertItem.condition.charAt(0).toUpperCase() + alertItem.condition.slice(1)} $${this.formatCurrency(alertItem.price)}
            </div>
            <div class="alert-crypto">
              ${this.cryptoConfig[alertItem.crypto].name} • Created ${new Date(alertItem.created).toLocaleDateString()}
            </div>
            <div class="alert-status active">🔔 Active</div>
          </div>
          <div class="alert-actions">
            <button type="button" class="remove-alert-btn" onclick="window.tracker.removeAlert('${alertItem.id}')">
              ❌ Remove
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  loadAlertsFromStorage() {
    try {
      const saved = localStorage.getItem('cryptoAlerts');
      const alerts = saved ? JSON.parse(saved) : [];
      return alerts;
    } catch (error) {
      console.error('Error loading alerts from storage:', error);
      return [];
    }
  }

  saveAlertsToStorage() {
    try {
      localStorage.setItem('cryptoAlerts', JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Error saving alerts to storage:', error);
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tracker = new CryptoPriceTracker();

  // Handle online/offline events
  window.addEventListener('offline', () => {
    window.tracker.updateStatus('error', 'Offline');
  });

  window.addEventListener('online', () => {
    window.tracker.updateStatus('connected', 'Back online');
  });
});
