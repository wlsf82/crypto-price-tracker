const url = Cypress.env('environment') === 'prod'
  ? 'https://price-bitcoin.s3.eu-central-1.amazonaws.com/index.html'
  : './src/index.html'

describe('Bitcoin Price Tracker - Comprehensive Test Suite', () => {
  beforeEach(() => {
    // Intercept service worker registration to avoid console errors in tests
    cy.intercept('GET', '**/sw.js', { statusCode: 404 }).as('swRequest')

    cy.visit(url)
  })

  describe('Initial page load', () => {
    it('should display the page title and initial loading state', () => {
      cy.title().should('eq', 'Bitcoin Price Tracker')
      cy.get('h1').should('contain', 'Bitcoin Price Tracker')
      cy.get('#price').should('contain', 'Loading...')
      cy.get('#change').should('contain', '--')
      cy.get('#changePercent').should('contain', '--%')
      cy.get('#lastUpdated').should('contain', '--')
      // Note: Status changes immediately from 'Ready' due to auto-fetch,
      // so we just check it's not empty
      cy.get('#statusText').should('not.be.empty')
    })

    it('should display all market statistics placeholders', () => {
      cy.get('#high24h').should('contain', '--')
      cy.get('#low24h').should('contain', '--')
      cy.get('#marketCap').should('contain', '--')
      cy.get('#volume24h').should('contain', '--')
    })

    it('should have update button enabled', () => {
      cy.get('#updateBtn').should('be.enabled')
      cy.get('#updateBtn').should('contain', 'Update Data')
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
      cy.get('#price').should('contain', '51,111.10')

      // Verify positive change display (from fixture: priceChange: "1234.56")
      cy.get('#change').should('contain', '+$1,234.56')
      cy.get('#changePercent').should('contain', '+2.45%') // Use exact percentage from fixture
      cy.get('#change').should('have.class', 'positive')
      cy.get('#changePercent').should('have.class', 'positive')

      // Verify market data
      cy.get('#high24h').should('contain', '52,000.00')
      cy.get('#low24h').should('contain', '49,500.00')
      cy.get('#marketCap').should('contain', '$1.01T') // 51111.10 * 19700000
      cy.get('#volume24h').should('contain', '$630.79B')

      // Verify status
      cy.get('#statusText').should('contain', 'Data updated')
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

      cy.get('#price').should('contain', '51,111.10')
      cy.get('#statusText').should('contain', 'Data updated')
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

      cy.get('#price').should('contain', '51,111.10')
      cy.get('#change').should('contain', '+$1,234.56') // 51111.10 - 49876.54
      cy.get('#changePercent').should('contain', '+2.48%') // Calculated: (1234.56 / 49876.54) * 100
      cy.get('#high24h').should('contain', '52,100.00') // Kraken h[1] value
      cy.get('#low24h').should('contain', '49,400.00') // Kraken l[1] value
      cy.get('#statusText').should('contain', 'Data updated')
    })

    it('should handle negative price changes correctly', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-negative-change.json'
      }).as('binanceNegative')

      cy.visit(url)
      cy.wait('@binanceNegative')

      cy.get('#change').should('contain', '-$2,500.75') // From fixture
      cy.get('#changePercent').should('contain', '-4.67%') // From fixture
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

      cy.get('#statusText').should('contain', 'Update failed - check connection')
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

      cy.get('#statusText').should('contain', 'Update failed - check connection')
      cy.get('#statusDot').should('have.class', 'error')
    })

    it('should handle all APIs failing (custom commands)', () => {
      cy.mockAllApisError()
      cy.visit(url)

      cy.get('#statusText').should('contain', 'Update failed - check connection')
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
      cy.get('#statusText').should('contain', 'Fetching data...')
      cy.get('#statusDot').should('have.class', 'connecting')

      cy.wait('@binanceAPI')

      // Button should be enabled again after completion
      cy.get('#updateBtn').should('be.enabled')
      cy.get('#updateBtn').should('not.have.class', 'loading')
      cy.get('#statusText').should('contain', 'Data updated')
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
      cy.get('#statusText').should('contain', 'Data updated')
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

      cy.get('#statusText').should('contain', 'Offline')
      cy.get('#statusDot').should('have.class', 'error')
    })

    it('should handle returning online', () => {
      // First go offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'))
      })
      cy.get('#statusText').should('contain', 'Offline')

      // Then come back online
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'))
      })

      // Status should change but might not show exact text due to auto-update
      cy.get('#statusDot').should('not.have.class', 'error')
    })

    it('should handle offline and online events (custom commands)', () => {
      cy.goOffline()
      cy.get('#statusText').should('contain', 'Offline')
      cy.get('#statusDot').should('have.class', 'error')

      cy.goOnline()
      cy.get('#statusDot').should('not.have.class', 'error')
    })
  })

  describe('Accessibility and UI', () => {
    it('should have proper heading structure', () => {
      cy.visit(url)

      cy.get('h1').should('exist')
      cy.get('h1').should('contain', 'Bitcoin Price Tracker')

      // Check for proper semantic structure
      cy.get('main').should('exist')
    })

    it('should have accessible button', () => {
      cy.visit(url)

      cy.get('#updateBtn').should('have.attr', 'type', 'button')
      cy.get('#updateBtn').should('be.visible')
      cy.get('#updateBtn').should('not.have.attr', 'aria-hidden', 'true')
    })

    it('should display proper currency formatting', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Check number formatting with commas
      cy.get('#price').should('contain', '51,111.10')
      cy.get('#high24h').should('contain', '52,000.00')
      cy.get('#low24h').should('contain', '49,500.00')

      // Check currency formatting
      cy.get('#change').should('contain', '$')
      cy.get('#marketCap').should('contain', '$')
      cy.get('#volume24h').should('contain', '$630.79B')

      // Check percentage formatting
      cy.get('#changePercent').should('contain', '%')
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
      cy.get('#statusText').should('contain', 'Data updated')
    })

    it('should handle very large numbers correctly', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Verify large number formatting (billions)
      cy.get('#volume24h').should('contain', 'B')
      // Verify trillion formatting for market cap
      cy.get('#marketCap').should('contain', 'T')
    })
  })
})
