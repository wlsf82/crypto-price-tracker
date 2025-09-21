# 📈 Cryptocurrency Price Tracker PWA

[![CI/CD](https://github.com/wlsf82/crypto-price-tracker/actions/workflows/cicd.yml/badge.svg)](https://github.com/wlsf82/crypto-price-tracker/actions/workflows/cicd.yml) [![crypto-price-tracker](https://img.shields.io/endpoint?url=https://cloud.cypress.io/badge/simple/7x6pkm&style=flat&logo=cypress)](https://cloud.cypress.io/projects/7x6pkm/runs)

A Progressive Web App that tracks cryptocurrency prices for Bitcoin (BTC), Ethereum (ETH), and Solana (SOL) using multiple APIs with automatic fallback: Binance, CoinGecko, or Kraken.

## ✨ Features

- ✅ Multi-cryptocurrency support: Bitcoin (BTC), Ethereum (ETH), and Solana (SOL)
- ✅ Cryptocurrency comparison view: Side-by-side comparison of multiple cryptocurrencies
- ✅ Cryptocurrency selection with easy switching between currencies
- ✅ View toggle: Switch between single cryptocurrency view and comparison view
- ✅ Price alerts with push notifications - Set custom alerts for price thresholds
- ✅ Price alerts with push notifications — set thresholds; alerts fire once and auto-remove
- ✅ Automatic price updates every 10 seconds - Real-time data refresh
- ✅ On-demand price updates with manual refresh button
- ✅ 24-hour price change tracking with visual indicators
- ✅ Market data including 24h high/low, market cap, and volume
- ✅ Progressive Web App (PWA) capabilities
- ✅ Offline support with Service Worker
- ✅ Mobile-responsive design
- ✅ Dark theme with cryptocurrency-themed accents
- ✅ Visual price change animations
- ✅ Connection status indicator

### 🔄 Automatic Data Updates

The app fetches data automatically and on-demand:

- **Automatic Updates**: Data refreshes every 10 seconds for real-time tracking
- **Manual Updates**: User can click the "Update Data" button for immediate refresh
- **Initial Load**: Data fetches when page loads
- **Cryptocurrency Switching**: Data fetches immediately when switching between currencies
- **Online/Offline Handling**: Auto-refresh pauses when offline and resumes when back online

The automatic updates ensure users always have the latest price information without manual intervention.

### 🔔 Price Alerts

Users can set custom price alerts for any supported cryptocurrency:

- **Alert Conditions**: Set alerts for when price goes above or below a specified value
- **One-shot Alerts**: Alerts fire once when the condition is met and are automatically removed from your alerts list
- **Persistent Storage**: Alerts are saved in browser localStorage and persist across sessions until they trigger
- **Push Notifications**: Receive browser notifications when alert conditions are met (requires notification permission)
- **Multiple Alerts**: Set multiple alerts per cryptocurrency with proper notification stacking; each alert fires once independently
- **No Manual Removal Needed**: There is no Remove button; if you need a different threshold, simply add a new alert

### 📊 Comparison View

The app features a dedicated comparison mode that allows users to:

- **Side-by-side comparison**: View multiple cryptocurrencies simultaneously with their current prices, 24h changes, and market statistics
- **Selective comparison**: Choose which cryptocurrencies to compare using checkboxes (Bitcoin, Ethereum, and/or Solana)
- **Individual cryptocurrency cards**: Each selected cryptocurrency displays in its own card with:
  - Current price in USD
  - 24-hour price change (amount and percentage)
  - Market statistics (24h high/low, market cap, volume)
  - Cryptocurrency-specific color theming and icons
- **Smart button state**: Update Data button automatically disables when fewer than two cryptocurrencies are selected
- **Responsive layout**: Comparison cards automatically adjust to screen size for optimal viewing on all devices
- **Visual consistency**: Maintains the same design language and animations as the single view

#### 💡 How to Use Comparison View

1. Click the "Compare" button in the view toggle at the top of the app
2. Select which cryptocurrencies you want to compare using the checkboxes
3. View real-time data for all selected cryptocurrencies in individual cards
4. Use the "Update Data" button to refresh all comparison data simultaneously
5. Switch back to "Single View" to focus on one cryptocurrency at a time

## 🚀 Deployment

Access the deployed app via the following URL: <https://price-bitcoin.s3.eu-central-1.amazonaws.com/index.html>.

### 💻 Local Development

1. Start a local server (`npm start`)
2. Open `http://localhost:8000/src/`

### ☁️ AWS S3 Static Hosting

The app is optimized for static hosting with CORS-friendly APIs.

Quick steps:

1. Create S3 bucket with public read access
2. Upload all project files
3. Enable static website hosting
4. Access via the S3 website endpoint

## 📡 Data Sources

This app uses multiple reliable APIs with an automatic fallback system for all supported cryptocurrencies:

- **Primary**: [Binance API](https://api.binance.com/api/v3/ticker/24hr) - Real-time ticker data with excellent CORS support
  - Bitcoin: `BTCUSDT`
  - Ethereum: `ETHUSDT`
  - Solana: `SOLUSDT`
- **Secondary**: [CoinGecko API](https://coingecko.com/) - Comprehensive market data via CORS proxy (AllOrigins)
  - Bitcoin: `bitcoin`
  - Ethereum: `ethereum`
  - Solana: `solana`
- **Fallback**: [Kraken API](https://api.kraken.com/0/public/Ticker) - Reliable exchange data
  - Bitcoin: `XBTUSD`
  - Ethereum: `XETHZUSD`
  - Solana: `SOLUSD`

### 🛠️ API Features

- Multi-cryptocurrency price tracking (Bitcoin, Ethereum, Solana) in USD
- 24-hour price changes and percentage for each cryptocurrency
- Market data (market cap, volume, 24h high/low) for all supported currencies
- CORS-friendly endpoints (perfect for static hosting)
- Automatic fallback system for maximum reliability
- Manual data refresh on user request

## 📱 PWA Features

- **Offline Support**: The app works offline using cached data
- **App-like Experience**: Can be installed on mobile and desktop
- **Fast Loading**: Resources are cached for quick loading
- **Responsive Design**: Works on all screen sizes
- **Push Notifications**: Browser notifications for price alerts (when permission granted)

## ⚙️ Technical Details

- **Supported Cryptocurrencies**: Bitcoin (BTC), Ethereum (ETH), Solana (SOL)
- **View Modes**: Single cryptocurrency view and multi-cryptocurrency comparison view
- **Update Method**: Automatic refresh every 10 seconds + manual refresh via button click
- **Comparison Features**: Selective cryptocurrency comparison with individual data cards
- **API Strategy**: Primary API with automatic fallback to secondary and tertiary APIs
- **Primary API**: Binance 24hr ticker endpoint for multiple trading pairs
- **Secondary API**: CoinGecko via AllOrigins CORS proxy
- **Fallback API**: Kraken public ticker endpoint for multiple pairs
- **Caching Strategy**: Cache first for static resources, network first for API calls
- **Browser Support**: Modern browsers with Service Worker support

## 📁 File Structure

```text
bitcoin-price/
├── src/                                  # Main application source code
│   ├── index.html                        # Main HTML file
│   ├── styles.css                        # CSS styles
│   ├── app.js                            # Main JavaScript application
│   ├── sw.js                             # Service Worker for PWA functionality
│   ├── manifest.json                     # PWA manifest file
│   ├── favicon.svg                       # App favicon
│   └── icons/                            # App icons (PNG format)
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-180x180.png
│       ├── icon-192x192.png
|       └── icon-512x512.png
├── cypress/                              # Cypress E2E testing framework
│   ├── e2e/                              # End-to-end test files
│   │   └── cryptoPriceTracker.cy.js
│   ├── fixtures/                         # Test data fixtures
│   │   ├── binance-api-error.json
│   │   ├── binance-api-success.json
│   │   ├── binance-below-alert.json
│   │   ├── binance-ethereum-success.json
│   │   ├── binance-negative-change.json
│   │   ├── binance-solana-success.json
│   │   ├── binance-zero-values.json
│   │   ├── coingecko-proxy-error.json
│   │   ├── coingecko-proxy-success.json
│   │   ├── kraken-api-error.json
│   │   └── kraken-api-success.json
│   └── support/                          # Cypress support files
│       ├── commands.js                   # Custom Cypress commands
│       └── e2e.js                        # E2E test configuration
├── cypress.config.js                     # Cypress configuration
├── package.json                          # Node.js dependencies and scripts
├── package-lock.json                     # Lockfile for npm dependencies
├── generate-png-icons.html               # Icon generation utility
├── LICENSE                               # MIT License
└── README.md                             # Project documentation
```

## 🎨 Customization

### 🖼️ Icon Files

The app uses SVG icons for better scalability and smaller file sizes:

- `favicon.svg` - Browser favicon
- `icons/icon-144x144.png` - PWA icon (144x144)
- `icons/icon-152x152.png` - PWA icon (152x152)
- `icons/icon-180x180.png` - PWA icon (180x180)
- `icons/icon-192x192.png` - PWA icon (192x192)
- `icons/icon-512x512.png` - PWA icon (512x512)

### 🎭 Styling

Modify the CSS custom properties in `styles.css` to change colors and themes:

```css
:root {
  --primary-color: #f7931a;  /* Can be customized for different crypto themes */
  --dark-bg: #1a1a1a;
  --card-bg: #2d2d2d;
  /* ... other variables */
}
```

## 🌐 Browser Compatibility

- Chrome 40+
- Firefox 44+
- Safari 11.1+
- Edge 17+

## 📄 License

This project is open source and available under the MIT License.
