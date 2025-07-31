import { config } from 'dotenv';

// Load environment variables
config();

const isProduction = process.env.ENVIRONMENT === 'production';

// Token addresses - CrossFi Mainnet (updated with real tokens from blockchain)
export const TOKEN_ADDRESSES = {
  XFI: isProduction
    ? "0x4b641f607570b93520c2e678fb3cc9d712c7d12f" // CrossFi Mainnet XFI
    : "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // CrossFi Testnet XFI (same for now)
  CFI: isProduction
    ? "0x4b641f607570b93520c2e678fb3cc9d712c7d12f" // CrossFi Mainnet CFI (same as XFI for now)
    : "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // CrossFi Testnet CFI
  // Real tokens discovered from blockchain
  WXFI: isProduction
    ? "0xC537D12bd626B135B251cCa43283EFF69eC109c4" // CrossFi Mainnet WXFI
    : "0xC537D12bd626B135B251cCa43283EFF69eC109c4", // CrossFi Testnet WXFI
  FOMO: isProduction
    ? "0x608A092CDa76620C06bD9d75b1D1719cdC36600f" // CrossFi Mainnet FOMO
    : "0x608A092CDa76620C06bD9d75b1D1719cdC36600f", // CrossFi Testnet FOMO
  WETH: isProduction
    ? "0xa084d905e3F35C6B86B5E672C2e72b0472ddA1e3" // CrossFi Mainnet WETH
    : "0xa084d905e3F35C6B86B5E672C2e72b0472ddA1e3", // CrossFi Testnet WETH
  USDC: isProduction
    ? "0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba" // CrossFi Mainnet USDC
    : "0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba", // CrossFi Testnet USDC
  WBTC: isProduction
    ? "0x417c85B9D0826501d7399FEeF417656774d333cc" // CrossFi Mainnet WBTC
    : "0x417c85B9D0826501d7399FEeF417656774d333cc", // CrossFi Testnet WBTC
  USDT: isProduction
    ? "0x38E88b1ed92065eD20241A257ef3713A131C9155" // CrossFi Mainnet USDT
    : "0x38E88b1ed92065eD20241A257ef3713A131C9155", // CrossFi Testnet USDT
  BNB: isProduction
    ? "0x40F6226bB42E440655D5741Eb62eE95d0159F344" // CrossFi Mainnet BNB
    : "0x40F6226bB42E440655D5741Eb62eE95d0159F344", // CrossFi Testnet BNB
  SOL: isProduction
    ? "0x5b9bec66bB3d1559Fc6E05bfCAE7a1b5cdf678BE" // CrossFi Mainnet SOL
    : "0x5b9bec66bB3d1559Fc6E05bfCAE7a1b5cdf678BE", // CrossFi Testnet SOL
  XUSD: isProduction
    ? "0x979B05E391c3544824E7EC19d064Ae4f0198741c" // CrossFi Mainnet XUSD
    : "0x979B05E391c3544824E7EC19d064Ae4f0198741c", // CrossFi Testnet XUSD
} as const;

export const TOKEN_METADATA = {
  XFI: {
    symbol: 'XFI',
    name: isProduction ? 'CrossFi Token' : 'Test CrossFi Token',
    decimals: 18,
    isNative: true,
    address: TOKEN_ADDRESSES.XFI,
  },
  CFI: {
    symbol: 'CFI',
    name: isProduction ? 'CrossFi Token' : 'Test CrossFi Token',
    decimals: 18,
    isNative: true,
    address: TOKEN_ADDRESSES.CFI,
  },
  // Real tokens discovered from blockchain
  WXFI: {
    symbol: 'WXFI',
    name: isProduction ? 'Wrapped XFI' : 'Test Wrapped XFI',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.WXFI,
  },
  FOMO: {
    symbol: 'FOMO',
    name: isProduction ? 'Fear of Missing Out' : 'Test Fear of Missing Out',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.FOMO,
  },
  WETH: {
    symbol: 'WETH',
    name: isProduction ? 'Wrapped Ether' : 'Test Wrapped Ether',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.WETH,
  },
  USDC: {
    symbol: 'USDC',
    name: isProduction ? 'USD Coin' : 'Test USD Coin',
    decimals: 6,
    isNative: false,
    address: TOKEN_ADDRESSES.USDC,
  },
  WBTC: {
    symbol: 'WBTC',
    name: isProduction ? 'Wrapped BTC' : 'Test Wrapped BTC',
    decimals: 8,
    isNative: false,
    address: TOKEN_ADDRESSES.WBTC,
  },
  USDT: {
    symbol: 'USDT',
    name: isProduction ? 'Tether USD' : 'Test Tether USD',
    decimals: 6,
    isNative: false,
    address: TOKEN_ADDRESSES.USDT,
  },
  BNB: {
    symbol: 'BNB',
    name: isProduction ? 'BNB' : 'Test BNB',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.BNB,
  },
  SOL: {
    symbol: 'SOL',
    name: isProduction ? 'SOL' : 'Test SOL',
    decimals: 9,
    isNative: false,
    address: TOKEN_ADDRESSES.SOL,
  },
  XUSD: {
    symbol: 'XUSD',
    name: isProduction ? 'XUSD' : 'Test XUSD',
    decimals: 18,
    isNative: false,
    address: TOKEN_ADDRESSES.XUSD,
  },
} as const;

// Supported DCA trading pairs (updated to use real tokens)
export const SUPPORTED_DCA_PAIRS = [
  {
    from: 'USDC',
    to: 'XFI',
    description: 'Buy XFI with USDC',
    minAmount: '1', // Minimum 1 USDC
    maxAmount: '10000', // Maximum 10,000 USDC
  },
  {
    from: 'XFI',
    to: 'USDC',
    description: 'Sell XFI for USDC',
    minAmount: '0.1', // Minimum 0.1 XFI
    maxAmount: '1000', // Maximum 1,000 XFI
  },
  {
    from: 'USDT',
    to: 'XFI',
    description: 'Buy XFI with USDT',
    minAmount: '1', // Minimum 1 USDT
    maxAmount: '10000', // Maximum 10,000 USDT
  },
  {
    from: 'XFI',
    to: 'USDT',
    description: 'Sell XFI for USDT',
    minAmount: '0.1', // Minimum 0.1 XFI
    maxAmount: '1000', // Maximum 1,000 XFI
  }
] as const;

// DCA configuration
export const DCA_CONFIG = {
  MIN_AMOUNT: 0.001, // Minimum amount for DCA orders
  MAX_AMOUNT: 1000, // Maximum amount for DCA orders
  MIN_INTERVAL_HOURS: 1, // Minimum interval between DCA executions
  MAX_INTERVAL_HOURS: 168, // Maximum interval (1 week)
  DEFAULT_INTERVAL_HOURS: 24, // Default interval (1 day)
  MAX_RETRIES: 3, // Maximum retry attempts for failed orders
} as const;

// DCA limits
export const DCA_LIMITS = {
  MAX_ORDERS_PER_USER: 10,
  MIN_TRIGGER_PRICE: 0.001, // Minimum $0.001
  MAX_TRIGGER_PRICE: 1000, // Maximum $1000
  MIN_SLIPPAGE: 0.1, // 0.1% minimum slippage
  MAX_SLIPPAGE: 50, // 50% maximum slippage
  DEFAULT_SLIPPAGE: 5, // 5% default slippage
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
  DEFAULT_SLIPPAGE: 5, // 5% default slippage
  MIN_SLIPPAGE: 0.1, // 0.1% minimum slippage
  MAX_SLIPPAGE: 50, // 50% maximum slippage
  GAS_LIMIT_MULTIPLIER: 1.2, // Add 20% gas buffer
  MAX_GAS_PRICE_GWEI: 100, // Maximum gas price
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_SECONDS: 5,
  DEADLINE_MINUTES: 20, // 20 minutes deadline for swaps
  SUPPORTED_TOKENS: ['CFI', 'WXFI', 'FOMO', 'WETH', 'USDC', 'WBTC', 'USDT', 'BNB', 'SOL', 'XUSD'] as const,
} as const;

// Helper functions
export function getTokenByAddress(address: string) {
  return Object.values(TOKEN_METADATA).find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(symbol: string) {
  return TOKEN_METADATA[symbol as keyof typeof TOKEN_METADATA];
}

export function validateAmount(amount: number): boolean {
  return amount >= DCA_CONFIG.MIN_AMOUNT && amount <= DCA_CONFIG.MAX_AMOUNT;
}

export function validateInterval(hours: number): boolean {
  return hours >= DCA_CONFIG.MIN_INTERVAL_HOURS && hours <= DCA_CONFIG.MAX_INTERVAL_HOURS;
}

export function validateSlippage(slippage: number): boolean {
  return slippage >= DCA_LIMITS.MIN_SLIPPAGE && slippage <= DCA_LIMITS.MAX_SLIPPAGE;
}

export function validateTriggerPrice(price: number): boolean {
  return price >= DCA_LIMITS.MIN_TRIGGER_PRICE && price <= DCA_LIMITS.MAX_TRIGGER_PRICE;
}

export function validateTokenAmount(symbol: string, amount: string): boolean {
  const token = getTokenBySymbol(symbol);
  if (!token) return false;
  
  const numAmount = parseFloat(amount);
  const pair = SUPPORTED_DCA_PAIRS.find(p => p.from === symbol);
  
  if (!pair) return false;
  
  return numAmount >= parseFloat(pair.minAmount) && numAmount <= parseFloat(pair.maxAmount);
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

// Swap validation functions
export function validateSwapSlippage(slippage: number): boolean {
  return slippage >= SWAP_CONFIG.MIN_SLIPPAGE && slippage <= SWAP_CONFIG.MAX_SLIPPAGE;
}

export function isSupportedSwapToken(symbol: string): boolean {
  return SWAP_CONFIG.SUPPORTED_TOKENS.includes(symbol as any);
} 