import { Address } from 'viem';

// Swap quote interface
export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountFormatted: string;
  toAmountFormatted: string;
  price: number;
  priceImpact: number;
  minimumReceived: string;
  minimumReceivedFormatted: string;
  gasEstimate: string;
  gasEstimateFormatted: string;
  slippage: number;
  path: Address[];
  deadline: number;
}

// Swap execution parameters
export interface SwapParams {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  slippage?: number;
  deadline?: number;
  recipient?: Address;
}

// Swap result interface
export interface SwapResult {
  success: boolean;
  transactionHash?: string;
  wrapTransactionHash?: string;
  unwrapTransactionHash?: string;
  fromAmount: string;
  toAmount?: string;
  fromToken: string;
  toToken: string;
  gasUsed?: string;
  gasPrice?: string;
  wrapGasUsed?: string;
  wrapGasPrice?: string;
  unwrapGasUsed?: string;
  unwrapGasPrice?: string;
  finalToken?: string;
  error?: string;
  errorCode?: string;
  reward?: {
    basePoints: number;
    bonusPoints: number;
    totalPoints: number;
    reason: string;
  };
}

// Swap validation interface
export interface SwapValidation {
  valid: boolean;
  error?: string;
  warnings?: string[];
  balance?: string;
  allowance?: string;
  needsApproval?: boolean;
}

// Token approval interface
export interface TokenApproval {
  tokenAddress: Address;
  spenderAddress: Address;
  amount: string;
  allowance: string;
  needsApproval: boolean;
}

// Swap route interface
export interface SwapRoute {
  path: Address[];
  fromToken: Address;
  toToken: Address;
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  gasEstimate: string;
}

// Swap history interface
export interface SwapHistory {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
}

// Swap error codes
export enum SwapErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  PRICE_IMPACT_TOO_HIGH = 'PRICE_IMPACT_TOO_HIGH',
  INVALID_TOKEN_PAIR = 'INVALID_TOKEN_PAIR',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Swap configuration interface
export interface SwapConfig {
  defaultSlippage: number;
  minSlippage: number;
  maxSlippage: number;
  maxPriceImpact: number;
  gasLimitMultiplier: number;
  maxGasPriceGwei: number;
  retryAttempts: number;
  retryDelaySeconds: number;
  deadlineMinutes: number;
  supportedTokens: string[];
} 