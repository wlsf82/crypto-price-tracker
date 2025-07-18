# Bitcoin Price Tracker PWA

[![CI](https://github.com/wlsf82/bitcoin-price/actions/workflows/ci.yml/badge.svg)](https://github.com/wlsf82/bitcoin-price/actions/workflows/ci.yml)

A Progressive Web App that tracks Bitcoin prices using multiple APIs with automatic fallback: Binance, CoinGecko, or Kraken.

## Features

- ✅ On-demand Bitcoin price updates with manual refresh button
- ✅ 24-hour price change tracking with visual indicators
- ✅ Market data including 24h high/low, market cap, and volume
- ✅ Progressive Web App (PWA) capabilities
- ✅ Offline support with Service Worker
- ✅ Mobile-responsive design
- ✅ Dark theme with Bitcoin orange accents
- ✅ Visual price change animations
- ✅ Connection status indicator

## Deployment

### Local Development

1. Start a local server (Python, Node.js, or PHP)
2. Open `http://localhost:8000`

### AWS S3 Static Hosting

The app is optimized for static hosting with CORS-friendly APIs.

Quick steps:

1. Create S3 bucket with public read access
2. Upload all project files
3. Enable static website hosting
4. Access via the S3 website endpoint

## Data Sources

This app uses multiple reliable APIs with an automatic fallback system:

- **Primary**: [Binance API](https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT) - Real-time ticker data with excellent CORS support
- **Secondary**: [CoinGecko API](https://coingecko.com/) - Comprehensive market data via CORS proxy (AllOrigins)
- **Fallback**: [Kraken API](https://api.kraken.com/0/public/Ticker?pair=XBTUSD) - Reliable exchange data

### API Features

- Bitcoin price in USD
- 24-hour price changes and percentage
- Market data (market cap, volume, 24h high/low)
- CORS-friendly endpoints (perfect for static hosting)
- Automatic fallback system for maximum reliability
- Manual data refresh on user request

## PWA Features

- **Offline Support**: The app works offline using cached data
- **App-like Experience**: Can be installed on mobile and desktop
- **Fast Loading**: Resources are cached for quick loading
- **Responsive Design**: Works on all screen sizes

## Technical Details

- **Update Method**: Manual refresh via button click (no automatic updates)
- **API Strategy**: Primary API with automatic fallback to secondary and tertiary APIs
- **Primary API**: Binance 24hr ticker endpoint
- **Secondary API**: CoinGecko via AllOrigins CORS proxy
- **Fallback API**: Kraken public ticker endpoint
- **Caching Strategy**: Cache first for static resources, network first for API calls
- **Browser Support**: Modern browsers with Service Worker support

## File Structure

```text
bitcoin-price/
├── src/                                  # Main application source code
│   ├── index.html                        # Main HTML file
│   ├── styles.css                        # CSS styles
│   ├── app.js                            # Main JavaScript application
│   ├── sw.js                             # Service Worker for PWA functionality
│   ├── manifest.json                     # PWA manifest file
│   ├── favicon.svg                       # App favicon
│   └── icons/                            # App icons (SVG format)
│       ├── icon-192x192.svg
│       └── icon-512x512.svg
├── cypress/                              # Cypress E2E testing framework
│   ├── e2e/                              # End-to-end test files
│   │   └── btcPriceTracker.cy.js
│   ├── fixtures/                         # Test data fixtures
│   │   ├── binance-api-error.json
│   │   ├── binance-api-success.json
│   │   ├── binance-negative-change.json
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
├── generate-icons.html                   # Icon generation utility
├── LICENSE                               # MIT License
└── README.md                             # Project documentation
```

## Customization

### Icon Files

The app uses SVG icons for better scalability and smaller file sizes:

- `favicon.svg` - Browser favicon
- `icons/icon-192x192.svg` - PWA icon (192x192)
- `icons/icon-512x512.svg` - PWA icon (512x512)

### Manual Data Updates

The app fetches data when:

- Page loads initially
- User clicks the "Update Data" button
- User comes back online (after being offline)

There is no automatic periodic refresh - all updates are user-initiated.

### Styling

Modify the CSS custom properties in `styles.css` to change colors and themes:

```css
:root {
  --bitcoin-orange: #f7931a;
  --dark-bg: #1a1a1a;
  --card-bg: #2d2d2d;
  /* ... other variables */
}
```

## Browser Compatibility

- Chrome 40+
- Firefox 44+
- Safari 11.1+
- Edge 17+

## License

This project is open source and available under the MIT License.
