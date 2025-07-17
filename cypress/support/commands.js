// Custom commands for Bitcoin Price Tracker testing

/**
 * Mock all Bitcoin APIs to return successful responses
 */
Cypress.Commands.add('mockAllApisSuccess', () => {
  cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
    fixture: 'binance-api-success.json'
  }).as('binanceAPI')

  cy.intercept('GET', '**/get?url=*coingecko*', {
    fixture: 'coingecko-proxy-success.json'
  }).as('coingeckoAPI')

  cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
    fixture: 'kraken-api-success.json'
  }).as('krakenAPI')
})

/**
 * Mock all Bitcoin APIs to return errors
 */
Cypress.Commands.add('mockAllApisError', () => {
  cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
    statusCode: 500,
    body: { error: 'Internal Server Error' }
  }).as('binanceError')

  cy.intercept('GET', '**/get?url=*coingecko*', {
    statusCode: 503,
    body: { error: 'Service Unavailable' }
  }).as('coingeckoError')

  cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
    statusCode: 500,
    body: { error: 'Internal Server Error' }
  }).as('krakenError')
})

/**
 * Mock Binance API to fail and allow fallback testing
 */
Cypress.Commands.add('mockBinanceFailWithFallback', (fallbackApi = 'coingecko') => {
  cy.intercept('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
    statusCode: 500
  }).as('binanceFail')

  if (fallbackApi === 'coingecko') {
    cy.intercept('GET', '**/get?url=*coingecko*', {
      fixture: 'coingecko-proxy-success.json'
    }).as('coingeckoAPI')

    cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
      statusCode: 500
    }).as('krakenFail')
  } else if (fallbackApi === 'kraken') {
    cy.intercept('GET', '**/get?url=*coingecko*', {
      statusCode: 500
    }).as('coingeckoFail')

    cy.intercept('GET', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
      fixture: 'kraken-api-success.json'
    }).as('krakenAPI')
  }
})

/**
 * Wait for Bitcoin price to be loaded and updated
 */
Cypress.Commands.add('waitForPriceUpdate', () => {
  cy.get('#price').should('not.contain', 'Loading...')
  cy.get('#lastUpdated').should('not.contain', '--')
  cy.get('#statusText').should('contain', 'Data updated')
})

/**
 * Check that price formatting is correct
 */
Cypress.Commands.add('verifyPriceFormatting', (price) => {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price)

  cy.get('#price').should('contain', formattedPrice)
})

/**
 * Trigger offline/online events for testing
 */
Cypress.Commands.add('goOffline', () => {
  cy.window().then((win) => {
    win.dispatchEvent(new Event('offline'))
  })
})

Cypress.Commands.add('goOnline', () => {
  cy.window().then((win) => {
    win.dispatchEvent(new Event('online'))
  })
})
