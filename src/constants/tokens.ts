import { config } from 'dotenv';
config();

// Environment-aware token contract addresses
const isProduction = process.env.ENVIRONMENT === 'production';

export const TOKEN_ADDRESSES = {
  XFI: '0x0000000000000000000000000000000000000000', // Native token (address 0) - same for both networks
  tUSDC: isProduction 
    ? '0x0000000000000000000000000000000000000000' // TODO: Replace with actual mainnet tUSDC address when available
    : '0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50', // Testnet tUSDC contract address
} as const;

// Token metadata
export const TOKEN_METADATA = {
  XFI: {
    symbol: 'XFI',
    name: 'CrossFi',
    decimals: 18,
    isNative: true,
    address: TOKEN_ADDRESSES.XFI,
  },
  tUSDC: {
    symbol: 'tUSDC',
    name: isProduction ? 'USD Coin' : 'Test USD Coin',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.tUSDC,
  }
} as const;

// Supported DCA trading pairs
export const SUPPORTED_DCA_PAIRS = [
  {
    from: 'tUSDC',
    to: 'XFI',
    description: 'Buy XFI with tUSDC',
    minAmount: '1', // Minimum 1 tUSDC
    maxAmount: '10000', // Maximum 10,000 tUSDC
  },
  {
    from: 'XFI',
    to: 'tUSDC',
    description: 'Sell XFI for tUSDC',
    minAmount: '0.1', // Minimum 0.1 XFI
    maxAmount: '1000', // Maximum 1,000 XFI
  }
] as const;

// DCA configuration limits
export const DCA_LIMITS = {
  MAX_ORDERS_PER_USER: 10,
  MIN_TRIGGER_PRICE: 0.001, // Minimum $0.001
  MAX_TRIGGER_PRICE: 1000, // Maximum $1000
  MIN_SLIPPAGE: 0.1, // 0.1%
  MAX_SLIPPAGE: 50, // 50%
  DEFAULT_SLIPPAGE: 5, // 5%
  MAX_ORDER_LIFETIME_DAYS: 365, // 1 year max
  EXECUTION_TIMEOUT_MINUTES: 10,
} as const;

// Price feed configuration
export const PRICE_CONFIG = {
  XFI_PRICE_DECIMALS: 8, // Price precision
  UPDATE_INTERVAL_SECONDS: 30, // Check price every 30 seconds
  PRICE_TOLERANCE: 0.001, // 0.1% price tolerance for triggers
} as const;

// Swap configuration
export const SWAP_CONFIG = {
  GAS_LIMIT_MULTIPLIER: 1.2, // Add 20% gas buffer
  MAX_GAS_PRICE_GWEI: 100, // Maximum gas price
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_SECONDS: 5,
} as const;

// Helper functions
export function getTokenByAddress(address: string) {
  return Object.values(TOKEN_METADATA).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(symbol: string) {
  return TOKEN_METADATA[symbol as keyof typeof TOKEN_METADATA];
}

export function isSupportedPair(fromSymbol: string, toSymbol: string): boolean {
  return SUPPORTED_DCA_PAIRS.some(
    pair => pair.from === fromSymbol && pair.to === toSymbol
  );
}

export function getPairConfig(fromSymbol: string, toSymbol: string) {
  return SUPPORTED_DCA_PAIRS.find(
    pair => pair.from === fromSymbol && pair.to === toSymbol
  );
}

// Validation functions
export function validateTokenAmount(symbol: string, amount: string): boolean {
  const token = getTokenBySymbol(symbol);
  if (!token) return false;
  
  const numAmount = parseFloat(amount);
  const pair = SUPPORTED_DCA_PAIRS.find(p => p.from === symbol);
  
  if (!pair) return false;
  
  return numAmount >= parseFloat(pair.minAmount) && numAmount <= parseFloat(pair.maxAmount);
}

export function validateTriggerPrice(price: number): boolean {
  return price >= DCA_LIMITS.MIN_TRIGGER_PRICE && price <= DCA_LIMITS.MAX_TRIGGER_PRICE;
}

export function validateSlippage(slippage: number): boolean {
  return slippage >= DCA_LIMITS.MIN_SLIPPAGE && slippage <= DCA_LIMITS.MAX_SLIPPAGE;
} 