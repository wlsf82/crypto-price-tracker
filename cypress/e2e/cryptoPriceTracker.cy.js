const url = Cypress.env('environment') === 'prod'
  ? 'https://price-bitcoin.s3.eu-central-1.amazonaws.com/index.html'
  : './src/index.html'

describe('Crypto Price Tracker', () => {
  beforeEach(() => {
    // Intercept service worker registration to avoid console errors in tests
    cy.intercept('GET', '**/sw.js', { statusCode: 404 }).as('swRequest')

    cy.visit(url)
  })

  context('Initial page load', () => {
    it('should display the page title and initial loading state', () => {
      // Mock API to delay response to catch loading state
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json',
        delay: 1000
      }).as('binanceAPIDelayed')

      cy.visit(url)

      cy.title().should('eq', 'Crypto Price Tracker')
      cy.contains('h1', 'Crypto Price Tracker').should('be.visible')
      cy.contains('#price', 'Loading...').should('be.visible')
      cy.contains('#change', '--').should('be.visible')
      cy.contains('#changePercent', '--%').should('be.visible')
      cy.contains('#lastUpdated', '--').should('be.visible')
      cy.contains('#statusText', 'Fetching data...').should('be.visible')

      cy.wait('@binanceAPIDelayed')
    })

    it('should display all market statistics placeholders', () => {
      // Mock API to delay response to catch placeholder state
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json',
        delay: 1000
      }).as('binanceAPIDelayed')

      cy.visit(url)

      cy.contains('#high24h', '--').should('be.visible')
      cy.contains('#low24h', '--').should('be.visible')
      cy.contains('#marketCap', '--').should('be.visible')
      cy.contains('#volume24h', '--').should('be.visible')

      cy.wait('@binanceAPIDelayed')
    })

    it('should have update button enabled', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

      cy.contains('#updateBtn', 'Update Data')
        .should('be.visible')
        .and('be.enabled')
    })
  })

  context('Successful API responses', () => {
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
      cy.contains('#marketCap', '$1.02T').should('be.visible')
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

  context('Error handling', () => {
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

  context('Fallback scenarios with custom commands', () => {
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

  context('User interactions', () => {
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

    it('should automatically fetch data every 10 seconds', () => {
      // Setup clock before visiting the page
      cy.clock()

      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI') // Wait for initial load

      // Verify initial data is displayed
      cy.contains('#price', '51,111.10').should('be.visible')
      cy.contains('#statusText', 'Data updated').should('be.visible')

      // Mock a different response for the auto-fetch
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-negative-change.json'
      }).as('binanceAutoFetch')

      // Fast-forward time by 10 seconds to trigger auto-fetch
      cy.tick(10000)

      // Wait for the auto-fetch request
      cy.wait('@binanceAutoFetch')

      // Verify the data was updated automatically
      cy.contains('#change', '-$2,500.75').should('be.visible') // From binance-negative-change.json
      cy.contains('#changePercent', '-4.67%').should('be.visible')
      cy.get('#change').should('have.class', 'negative')
      cy.get('#changePercent').should('have.class', 'negative')
      cy.contains('#statusText', 'Data updated').should('be.visible')
    })
  })

  context('Offline scenarios', () => {
    beforeEach(() => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')
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

      // Mock API for when coming back online
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPIOnline')

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

  context('Accessibility and UI', () => {
    it('should have proper heading structure', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

      cy.contains('h1', 'Crypto Price Tracker').should('be.visible')

      // Check for proper semantic structure
      cy.get('main').should('exist')
    })

    it('should have accessible button', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

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

    it('should have alert condition select with proper label association', () => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

      // Verify the select element has a label with the correct for attribute
      cy.get('label[for="alertCondition"]').should('exist')
      cy.get('#alertCondition').should('be.visible')

      // Verify the label text is accessible (even if visually hidden)
      cy.get('label[for="alertCondition"]')
        .should('contain', 'Alert condition')
        .and('have.class', 'sr-only')
    })
  })

  context('Data validation', () => {
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

    it('should display approximate market cap symbol (~) for calculated values from Binance API', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-api-success.json'
      }).as('binanceAPI')

      cy.visit(url)
      cy.wait('@binanceAPI')

      // Market cap from Binance should show ~ symbol since it's calculated from hardcoded supply
      cy.get('#marketCap').should('contain.text', '~')
      cy.get('#marketCap').should('contain.text', '$')
      cy.get('#marketCap').should('contain.text', 'T')
    })

    it('should NOT display approximate market cap symbol (~) for actual values from CoinGecko API', () => {
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        statusCode: 500
      }).as('binanceFail')

      cy.intercept('GET', '**/get?url=*coingecko*', {
        fixture: 'coingecko-proxy-success.json'
      }).as('coingeckoAPI')

      cy.visit(url)
      cy.wait('@binanceFail')
      cy.wait('@coingeckoAPI')

      // Market cap from CoinGecko should NOT show ~ symbol since it's actual market cap data
      cy.get('#marketCap').should('not.contain.text', '~')
      cy.get('#marketCap').should('contain.text', '$')
      cy.get('#marketCap').should('contain.text', 'T')
    })

    it('should display approximate market cap symbol (~) for calculated values from Kraken API', () => {
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

      // Market cap from Kraken should show ~ symbol since it's calculated from hardcoded supply
      cy.get('#marketCap').should('contain.text', '~')
      cy.get('#marketCap').should('contain.text', '$')
      cy.get('#marketCap').should('contain.text', 'T')
    })
  })

  context('Price Alerts', () => {
    beforeEach(() => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')
    })

    it('should show no price alerts set for Bitcoin', () => {
      // Verify no alerts are initially set for Bitcoin
      cy.contains('.alerts-empty', 'No price alerts set').should('be.visible')
    })

    it('should show no price alerts set for Ethereum', () => {
      // Go the Ethereum view
      cy.get('.crypto-selector [data-crypto="ethereum"]').click()
      // Verify no alerts are initially set for Ethereum
      cy.contains('.alerts-empty', 'No price alerts set').should('be.visible')
    })

    it('should show no price alerts set for Solana', () => {
      // Go the Solana view
      cy.get('.crypto-selector [data-crypto="solana"]').click()
      // Verify no alerts are initially set for Solana
      cy.contains('.alerts-empty', 'No price alerts set').should('be.visible')
    })

    it('should show invalid price when clicking Add Alert button without specifying a price', () => {
      // Click Add Alert button without entering a price
      cy.contains('button', 'Add Alert').click()

      // Verify error message for empty price
      cy.contains('.alert-notification', 'Please enter a valid price').should('be.visible')
    })

    it('should show invalid price when price is 0', () => {
      // Enter 0 as the price
      cy.get('[placeholder="Price in USD"]').type('0')
      cy.contains('button', 'Add Alert').click()

      // Verify error message for zero price
      cy.contains('.alert-notification', 'Please enter a valid price').should('be.visible')
    })

    it('should show invalid price when price is negative', () => {
      // Enter negative price
      cy.get('[placeholder="Price in USD"]').type('-100')
      cy.contains('button', 'Add Alert').click()

      // Verify error message for negative price
      cy.contains('.alert-notification', 'Please enter a valid price').should('be.visible')
    })

    it('should successfully add a valid price alert for Bitcoin', () => {
      // Grant notification permission before the test
      cy.window().then((win) => {
        // Mock the Notification.requestPermission method to automatically grant permission
        cy.stub(win.Notification, 'requestPermission').resolves('granted')

        // Mock the Notification.permission property
        Object.defineProperty(win.Notification, 'permission', {
          writable: true,
          value: 'granted'
        })
      })

      // Enter a valid price alert
      cy.get('[placeholder="Price in USD"]').type('60000')
      cy.contains('button', 'Add Alert').click()

      // Verify the alert was added successfully
      cy.contains('.alert-item', '$60,000.00').should('be.visible')
      cy.get('.alerts-empty').should('not.exist')

      // Verify success notification
      cy.contains('.alert-notification', 'Alert added: Bitcoin above $60,000.00')
        .should('be.visible')
    })

    it('should display triggered alert when price condition is met after clicking update', () => {
      // Grant notification permission before the test
      cy.window().then((win) => {
        cy.stub(win.Notification, 'requestPermission').resolves('granted')
        Object.defineProperty(win.Notification, 'permission', {
          writable: true,
          value: 'granted'
        })
      })

      // Add an alert below current price (should trigger)
      cy.get('[placeholder="Price in USD"]').type('50000')
      cy.get('#alertCondition').select('below')
      cy.contains('button', 'Add Alert').click()

      // Verify alert was added
      cy.contains('.alert-item', '$50,000.00').should('be.visible')

      // Mock API response with price below the alert threshold
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
        fixture: 'binance-below-alert.json'
      }).as('binanceBelowAlert')

      // Click update to trigger price check
      cy.get('#updateBtn').click()
      cy.wait('@binanceBelowAlert')

      // Verify the alert notification appears
      cy.contains('.alert-notification', 'Bitcoin is now below $50,000.00! Current price: $45,000.00')
        .should('be.visible')
    })

    it('should allow removing an alert', () => {
      // Grant notification permission before the test
      cy.window().then((win) => {
        cy.stub(win.Notification, 'requestPermission').resolves('granted')
        Object.defineProperty(win.Notification, 'permission', {
          writable: true,
          value: 'granted'
        })
      })

      // Add an alert first
      cy.get('[placeholder="Price in USD"]').type('55000')
      cy.contains('button', 'Add Alert').click()

      // Verify alert was added
      cy.contains('.alert-item', '$55,000.00').should('be.visible')
      cy.get('.alerts-empty').should('not.exist')

      // Remove the alert
      cy.get('.remove-alert-btn').click()

      // Verify alert was removed and empty state is shown
      cy.contains('.alert-item', '$55,000.00').should('not.exist')
      cy.contains('.alerts-empty', 'No price alerts set').should('be.visible')
    })
  })

  context('Compare View', () => {
    beforeEach(() => {
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')

      // Mock Ethereum API response
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT', {
        fixture: 'binance-ethereum-success.json'
      }).as('ethereumAPI')

      // Mock Solana API response
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT', {
        fixture: 'binance-solana-success.json'
      }).as('solanaAPI')

      // Switch to comparison view
      cy.get('.view-btn[data-view="comparison"]').click()
    })

    it('should display all three crypto cards when all checkboxes are checked', () => {
      // Wait for the comparison data to load
      cy.wait('@ethereumAPI')
      cy.wait('@solanaAPI')

      // Verify all checkboxes are checked by default
      cy.get('input[data-crypto="bitcoin"]').should('be.checked')
      cy.get('input[data-crypto="ethereum"]').should('be.checked')
      cy.get('input[data-crypto="solana"]').should('be.checked')

      // Verify all three cards are displayed
      cy.get('.comparison-card[data-crypto="bitcoin"]').should('be.visible')
      cy.get('.comparison-card[data-crypto="ethereum"]').should('be.visible')
      cy.get('.comparison-card[data-crypto="solana"]').should('be.visible')

      // Verify the cards contain the expected crypto names
      cy.contains('.comparison-card', 'Bitcoin').should('be.visible')
      cy.contains('.comparison-card', 'Ethereum').should('be.visible')
      cy.contains('.comparison-card', 'Solana').should('be.visible')

      // Verify the price data is displayed correctly
      cy.get('#comparison-price-bitcoin').should('contain', '51,111.10')
      cy.get('#comparison-price-ethereum').should('contain', '3,300.50')
      cy.get('#comparison-price-solana').should('contain', '238.75')

      // Verify change indicators
      cy.get('#comparison-change-bitcoin').should('contain', '+$1,234.56')
      cy.get('#comparison-change-ethereum').should('contain', '+$123.45')
      cy.get('#comparison-change-solana').should('contain', '-$5.25')
    })

    it('should display only two cards when one checkbox is unchecked', () => {
      // Wait for initial data load
      cy.wait('@ethereumAPI')
      cy.wait('@solanaAPI')

      // Uncheck the Solana checkbox
      cy.get('input[data-crypto="solana"]').uncheck()

      // Verify only Bitcoin and Ethereum cards are displayed
      cy.get('.comparison-card[data-crypto="bitcoin"]').should('be.visible')
      cy.get('.comparison-card[data-crypto="ethereum"]').should('be.visible')
      cy.get('.comparison-card[data-crypto="solana"]').should('not.exist')

      // Verify the remaining cards contain the expected crypto names and data
      cy.contains('.comparison-card', 'Bitcoin').should('be.visible')
      cy.contains('.comparison-card', 'Ethereum').should('be.visible')
      cy.contains('.comparison-card', 'Solana').should('not.exist')

      // Verify price data for remaining cards
      cy.get('#comparison-price-bitcoin').should('contain', '51,111.10')
      cy.get('#comparison-price-ethereum').should('contain', '3,300.50')
    })

    it('should show empty state when at least two checkboxes are unchecked', () => {
      // Uncheck all checkboxes
      cy.get('input[data-crypto="bitcoin"]').uncheck()
      cy.get('input[data-crypto="ethereum"]').uncheck()

      // Verify empty state message is displayed
      cy.contains('.comparison-empty', 'Select at least two cryptocurrencies to compare').should('be.visible')

      // Verify no comparison cards are displayed
      cy.get('.comparison-card').should('not.exist')

      // Verify Update Data button is disabled
      cy.get('#comparisonUpdateBtn').should('be.disabled')

      // Verify status shows error message
      cy.contains('#comparisonStatusText', 'Select at least two cryptocurrencies').should('be.visible')
      cy.get('#comparisonStatusDot').should('have.class', 'error')
    })

    it('should display approximate market cap symbol (~) in comparison view for calculated values', () => {
      // Wait for initial data load
      cy.wait('@ethereumAPI')
      cy.wait('@solanaAPI')

      // Verify market cap shows ~ symbol for all cryptocurrencies since they use Binance API (calculated values)
      cy.get('#comparison-mcap-bitcoin').should('contain.text', '~')
      cy.get('#comparison-mcap-bitcoin').should('contain.text', '$')
      cy.get('#comparison-mcap-bitcoin').should('contain.text', 'T')

      cy.get('#comparison-mcap-ethereum').should('contain.text', '~')
      cy.get('#comparison-mcap-ethereum').should('contain.text', '$')

      cy.get('#comparison-mcap-solana').should('contain.text', '~')
      cy.get('#comparison-mcap-solana').should('contain.text', '$')
    })
  })

  context('Mobile viewport', () => {
    beforeEach(() => {
      // Set mobile viewport
      cy.viewport(375, 667) // iPhone SE dimensions
      cy.mockAllApisSuccess()
      cy.visit(url)
      cy.wait('@binanceAPI')
    })

    it('should display abbreviated crypto button texts in single view on mobile', () => {
      // Verify that the full names are hidden on mobile
      cy.get('.crypto-btn .crypto-name-full').should('not.be.visible')

      // Verify that the abbreviated names are visible on mobile
      cy.get('.crypto-btn .crypto-name-short').should('be.visible')

      // Check specific button texts
      cy.contains('.crypto-btn[data-crypto="bitcoin"] .crypto-name-short', 'BTC')
        .should('be.visible')
      cy.contains('.crypto-btn[data-crypto="ethereum"] .crypto-name-short', 'ETH')
        .should('be.visible')
      cy.contains('.crypto-btn[data-crypto="solana"] .crypto-name-short', 'SOL')
        .should('be.visible')

      // Verify symbols are still visible
      cy.contains('.crypto-btn[data-crypto="bitcoin"] .crypto-symbol', '₿')
        .should('be.visible')
      cy.contains('.crypto-btn[data-crypto="ethereum"] .crypto-symbol', 'Ξ')
        .should('be.visible')
      cy.contains('.crypto-btn[data-crypto="solana"] .crypto-symbol', '◎')
        .should('be.visible')

      // Verify buttons are displayed side by side (row layout)
      cy.get('.crypto-btn').should('have.css', 'flex-direction', 'row')
    })

    it('should display abbreviated crypto checkbox texts in comparison view on mobile', () => {
      // Mock APIs for comparison view
      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT', {
        fixture: 'binance-ethereum-success.json'
      }).as('ethereumAPI')

      cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT', {
        fixture: 'binance-solana-success.json'
      }).as('solanaAPI')

      // Switch to comparison view
      cy.get('.view-btn[data-view="comparison"]').click()
      cy.wait('@ethereumAPI')
      cy.wait('@solanaAPI')

      // Verify that the full names are hidden on mobile
      cy.get('.crypto-checkbox .crypto-name-full').should('not.be.visible')

      // Verify that the abbreviated names are visible on mobile
      cy.get('.crypto-checkbox .crypto-name-short').should('be.visible')

      // Check specific checkbox texts
      cy.contains('.crypto-checkbox[data-crypto="bitcoin"] .crypto-name-short', 'BTC')
        .should('be.visible')
      cy.contains('.crypto-checkbox[data-crypto="ethereum"] .crypto-name-short', 'ETH')
        .should('be.visible')
      cy.contains('.crypto-checkbox[data-crypto="solana"] .crypto-name-short', 'SOL')
        .should('be.visible')

      // Verify symbols are still visible
      cy.contains('.crypto-checkbox[data-crypto="bitcoin"] .crypto-symbol', '₿')
        .should('be.visible')
      cy.contains('.crypto-checkbox[data-crypto="ethereum"] .crypto-symbol', 'Ξ')
        .should('be.visible')
      cy.contains('.crypto-checkbox[data-crypto="solana"] .crypto-symbol', '◎')
        .should('be.visible')

      // Verify checkboxes are displayed side by side (row layout)
      cy.get('.crypto-checkboxes').should('have.css', 'flex-direction', 'row')
    })
  })
})
