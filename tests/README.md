# Backend Tests

This folder contains all test files for the CrossFI BUAI backend system.

## Test Files Overview

### Payment Link Tests
- **test-payment-link-contract.js** - Tests payment link contract functionality
- **check-contract-balance.js** - Checks contract balance and payment status

### DCA (Dollar Cost Averaging) Tests
- **test-dca-api.js** - Tests DCA API endpoints
- **test-dca-service.js** - Tests DCA service functionality
- **test-dca-trigger-fix.js** - Tests DCA trigger fixes
- **check-dca-orders.js** - Checks DCA orders status

### Swap Tests
- **test-actual-usdc-xfi-swap.js** - Tests USDC to XFI swaps
- **test-usdc-to-native-xfi.js** - Tests USDC to native XFI conversion
- **test-token-send.js** - Tests token sending functionality

### Balance Tests
- **test-balance.js** - Basic balance checking
- **test-balance-direct.js** - Direct balance checking without database
- **test-balance-no-db.js** - Balance checking without database dependency

### Network & Integration Tests
- **test-network-diagnostic.js** - Network connectivity diagnostics
- **test-backend-integration.js** - Backend integration tests
- **test-mongodb-connection.js** - MongoDB connection tests

### Analytics Tests
- **test-analytics.js** - Analytics functionality tests

### Contract Tests
- **test-contract-info.js** - Contract information retrieval tests

### Utility Tests
- **find-crossfi-tokens.js** - CrossFI token discovery
- **switch-provider.js** - Provider switching functionality

## Running Tests

To run a specific test:

```bash
# From the backend directory
node tests/test-filename.js

# Or using tsx for TypeScript support
npx tsx tests/test-filename.js
```

## Test Categories

### 🔗 Payment Link Tests
Tests for payment link creation, payment processing, and contract interactions.

### 📈 DCA Tests
Tests for Dollar Cost Averaging functionality including order creation, execution, and monitoring.

### 💱 Swap Tests
Tests for token swapping functionality between different tokens (USDC, XFI, etc.).

### 💰 Balance Tests
Tests for wallet balance checking and balance-related functionality.

### 🌐 Network Tests
Tests for network connectivity, RPC endpoints, and blockchain interactions.

### 📊 Analytics Tests
Tests for analytics and data collection functionality.

### 🔧 Utility Tests
Tests for utility functions and helper services.

## Notes

- Most tests require proper environment variables to be set
- Some tests require a running MongoDB instance
- Network tests require valid RPC endpoints
- Contract tests require deployed smart contracts

## Environment Setup

Before running tests, ensure you have:

1. Proper `.env` file with required variables
2. MongoDB connection string
3. Valid RPC endpoints
4. Deployed smart contracts (for contract tests)
5. Required dependencies installed (`npm install` or `pnpm install`) 