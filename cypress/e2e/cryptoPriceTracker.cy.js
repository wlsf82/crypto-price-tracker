const url = Cypress.env('environment') === 'prod'
  ? 'https://price-bitcoin.s3.eu-central-1.amazonaws.com/index.html'
  : './src/index.html'

describe('Crypto Price Tracker', () => {
  beforeEach(() => {
    // Intercept service worker registration to avoid console errors in tests
    cy.intercept('GET', '**/sw.js', { statusCode: 404 }).as('swRequest')

    cy.visit(url)
  })

  describe('Initial page load', () => {
    it('should display the page title and initial loading state', () => {
      cy.title().should('eq', 'Crypto Price Tracker')
      cy.contains('h1', 'Crypto Price Tracker').should('be.visible')
      cy.contains('#price', 'Loading...').should('be.visible')
      cy.contains('#change', '--').should('be.visible')
      cy.contains('#changePercent', '--%').should('be.visible')
      cy.contains('#lastUpdated', '--').should('be.visible')
      // Note: Status changes immediately from 'Ready' due to auto-fetch,
      // so we just check it's not empty
      cy.get('#statusText').should('not.be.empty')
    })

    it('should display all market statistics placeholders', () => {
      cy.contains('#high24h', '--').should('be.visible')
      cy.contains('#low24h', '--').should('be.visible')
      cy.contains('#marketCap', '--').should('be.visible')
      cy.contains('#volume24h', '--').should('be.visible')
    })

    it('should have update button enabled', () => {
      cy.contains('#updateBtn', 'Update Data', { timeout: 10000 })
        .should('be.visible')
        .and('be.enabled')
    })
  })

  describe('Successful API responses', () => {
    it('should display Bitcoin price data when Binance API succeeds', () => {
      // Mock successful Binance API response
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Verify price display
      cy.contains('#price', '51,111.10').should('be.visible')

      // Verify positive change display (from fixture: priceChange: "1234.56")
      cy.contains('#change', '+$1,234.56').should('be.visible')
      cy.contains('#changePercent', '+2.45%').should('be.visible') // Use exact percentage from fixture
      cy.get('#change').should('have.class', 'positive')
      cy.get('#changePercent').should('have.class', 'positive')

      // Verify market data
      cy.contains('#high24h', '52,000.00').should('be.visible')
      cy.contains('#low24h', '49,500.00').should('be.visible')
      cy.contains('#marketCap', '$1.01T').should('be.visible') // 51111.10 * 19700000
      cy.contains('#volume24h', '$630.79B').should('be.visible')

      // Verify status
      cy.contains('#statusText', 'Data updated').should('be.visible')
      cy.get('#statusDot').should('have.class', 'connected')

      // Verify last updated time is displayed
      cy.get('#lastUpdated').should('not.contain', '--')
    })

    it('should fallback to CoinGecko proxy when Binance fails', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        statusCode: 500
      }).as('binanceFail')

      cy.intercept('GET', '**/get?url=*coingecko*', {
        fixture: 'coingecko-proxy-success.json'
      }).as('coingeckoAPI')

      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoAPI')

      cy.contains('#price', '51,111.10').should('be.visible')
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })

    it('should fallback to Kraken when both Binance and CoinGecko fail', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        statusCode: 500
      }).as('binanceFail')

      cy.intercept('GET', '**/get?url=*coingecko*', {
        statusCode: 500
      }).as('coingeckoFail')

      cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
        fixture: 'kraken-api-success.json'
      }).as('krakenAPI')

      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoFail')
      cy.wait('@krakenAPI')

      cy.contains('#price', '51,111.10').should('be.visible')
      cy.contains('#change', '+$1,234.56').should('be.visible') // 51111.10 - 49876.54
      cy.contains('#changePercent', '+2.48%').should('be.visible') // Calculated: (1234.56 / 49876.54) * 100
      cy.contains('#high24h', '52,100.00').should('be.visible') // Kraken h[1] value
      cy.contains('#low24h', '49,400.00').should('be.visible') // Kraken l[1] value
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })

    it('should handle negative price changes correctly', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-negative-change.json'
      }).as('binanceNegative')

      cy.visit(url)
      cy.wait('@binanceNegative')

      cy.contains('#change', '-$2,500.75').should('be.visible') // From fixture
      cy.contains('#changePercent', '-4.67%').should('be.visible') // From fixture
      cy.get('#change').should('have.class', 'negative')
      cy.get('#changePercent').should('have.class', 'negative')
    })

    it('should display data using successful API mock (custom commands)', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')
      cy.waitForPriceUpdate()
      cy.verifyPriceFormatting(51111.10)
    })
  })

  describe('Error handling', () => {
    it('should display error when all APIs fail', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        statusCode: 500
      }).as('binanceFail')

      cy.intercept('GET', '**/get?url=*coingecko*', {
        statusCode: 500
      }).as('coingeckoFail')

      cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
        statusCode: 500
      }).as('krakenFail')

      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoFail')
      cy.wait('@krakenFail')

      cy.contains('#statusText', 'Update failed - check connection').should('be.visible')
      cy.get('#statusDot').should('have.class', 'error')
    })

    it('should handle API errory', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        statusCode: 500
      }).as('binanceFail')

      cy.intercept('GET', '**/get?url=*coingecko*', {
        statusCode: 500
      }).as('coingeckoFail')

      cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
        statusCode: 500
      }).as('krakenFail')

      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoFail')
      cy.wait('@krakenFail')

      cy.contains('#statusText', 'Update failed - check connection').should('be.visible')
      cy.get('#statusDot').should('have.class', 'error')
    })

    it('should handle all APIs failing (custom commands)', () => {
      cy.mockAllApisError()
      cy.visit(url)

      cy.contains('#statusText', 'Update failed - check connection').should('be.visible')
      cy.get('#statusDot').should('have.class', 'error')
    })
  })

  describe('Fallback scenarios with custom commands', () => {
    it('should test CoinGecko fallback', () => {
      cy.mockBinanceFailWithFallback('coingecko')
      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoAPI')
      cy.waitForPriceUpdate()
    })

    it('should test Kraken fallback', () => {
      cy.mockBinanceFailWithFallback('kraken')
      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoFail')
      cy.wait('@krakenAPI')
      cy.waitForPriceUpdate()
    })
  })

  describe('User interactions', () => {
    it('should update data when update button is clicked', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json',
        delay: 1000 // Add delay to catch button state
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Click update button
      cy.get('#updateBtn').click()

      // Button should be disabled and show loading state
      cy.get('#updateBtn').should('be.disabled')
      cy.get('#updateBtn').should('have.class', 'loading')

      // Status should show "Fetching data..."
      cy.contains('#statusText', 'Fetching data...').should('be.visible')
      cy.get('#statusDot').should('have.class', 'connecting')

      cy.wait('@binanceAPI')

      // Button should be enabled again after completion
      cy.get('#updateBtn').should('be.enabled')
      cy.get('#updateBtn').should('not.have.class', 'loading')
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })

    it('should prevent multiple simultaneous requests', () => {
      let requestCount = 0

      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', (req) => {
        requestCount += 1
        req.reply({
          fixture: 'binance-api-success.json',
          delay: 1000 // Slow response to allow multiple button clicks
        })
      }).as('binanceSlowAPI')

      cy.visit(url)
      cy.wait('@binanceSlowAPI') // Wait for initial load

      // Reset counter after initial load
      cy.then(() => {
        requestCount = 0
      })

      // Click update button multiple times rapidly
      cy.get('#updateBtn').click()
      cy.get('#updateBtn').should('be.disabled') // Should be disabled immediately

      // Try clicking the disabled button multiple times
      cy.get('#updateBtn').click({ force: true })
      cy.get('#updateBtn').click({ force: true })
      cy.get('#updateBtn').click({ force: true })

      // Wait for the request to complete
      cy.wait('@binanceSlowAPI')
      cy.get('#updateBtn').should('be.enabled')

      // Verify only one request was made despite multiple clicks
      cy.then(() => {
        expect(requestCount, 'API calls after multiple button clicks').to.equal(1)
      })
    })

    it('should show flash animation when price changes', () => {
      // First API call with initial price
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceFirst')

      cy.visit(url)
      cy.wait('@binanceFirst')

      // Mock second API call with different price
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-negative-change.json'
      }).as('binanceSecond')

      // Click update to trigger price change
      cy.get('#updateBtn').click()
      cy.wait('@binanceSecond')

      // Verify the flash animation was applied
      cy.get('#price').should('have.class', 'flash')
      // Verify the flash animation has finished
      cy.get('#price').should('not.have.class', 'flash')
    })

    it('should update data when button is clicked (custom commands)', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

      // Click update button to verify it works
      cy.get('#updateBtn').click()
      cy.wait('@binanceAPI')
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })
  })

  describe('Offline scenarios', () => {
    beforeEach(() => {
      cy.visit(url)
    })

    it('should handle offline state', () => {
      // Simulate going offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'))
      })

      cy.contains('#statusText', 'Offline').should('be.visible')
      cy.get('#statusDot').should('have.class', 'error')
    })

    it('should handle returning online', () => {
      // First go offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'))
      })
      cy.contains('#statusText', 'Offline').should('be.visible')

      // Then come back online
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'))
      })

      // Status should change but might not show exact text due to auto-update
      cy.get('#statusDot').should('not.have.class', 'error')
    })

    it('should handle offline and online events (custom commands)', () => {
      cy.goOffline()
      cy.contains('#statusText', 'Offline').should('be.visible')
      cy.get('#statusDot').should('have.class', 'error')

      cy.goOnline()
      cy.get('#statusDot').should('not.have.class', 'error')
    })
  })

  describe('Accessibility and UI', () => {
    it('should have proper heading structure', () => {
      cy.visit(url)

      cy.contains('h1', 'Crypto Price Tracker').should('be.visible')

      // Check for proper semantic structure
      cy.get('main').should('exist')
    })

    it('should have accessible button', () => {
      cy.visit(url)

      cy.get('#updateBtn')
        .should('have.attr', 'type', 'button')
        .and('be.visible')
        .and('not.have.attr', 'aria-hidden', 'true')
    })

    it('should display proper currency formatting', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Check number formatting with commas
      cy.contains('#price', '51,111.10').should('be.visible')
      cy.contains('#high24h', '52,000.00').should('be.visible')
      cy.contains('#low24h', '49,500.00').should('be.visible')

      // Check currency formatting
      cy.contains('#change', '$').should('be.visible')
      cy.contains('#marketCap', '$').should('be.visible')
      cy.contains('#volume24h', '$630.79B').should('be.visible')

      // Check percentage formatting
      cy.contains('#changePercent', '%').should('be.visible')
    })
  })

  describe('Data validation', () => {
    it('should handle zero or negative price values gracefully', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-zero-values.json'
      }).as('binanceZero')

      cy.visit(url)
      cy.wait('@binanceZero')

      // App should still display values, even if zero
      cy.get('#price').should('not.contain', 'Loading...')
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })

    it('should handle very large numbers correctly', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Verify large number formatting (billions)
      cy.contains('#volume24h', 'B').should('be.visible')
      // Verify trillion formatting for market cap
      cy.contains('#marketCap', 'T').should('be.visible')
    })
  })
})
