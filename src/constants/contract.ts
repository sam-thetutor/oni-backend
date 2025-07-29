import { config } from 'dotenv';

// Load environment variables
config();

const isProduction = process.env.ENVIRONMENT === 'production';
export const PAYLINK_CONTRACT_ADDRESS = isProduction 
  ? "0x8Ceb24694b8d3965Bd7224652B15B2A4f65Bd130" // CrossFi Mainnet Payment Link Contract
  : "0x03f0b9919B7A1341A17B15b2A2DA360d059Cc320"; // CrossFi Testnet Payment Link Contract

// CrossFI Swap Contract - Environment aware
export const SWAP_CONTRACT_ADDRESS = isProduction 
  ? "0xFb8cc0D4E2c025A1B6429Ef942bf33D0f41fED34" // TODO: Update with mainnet swap contract
  : "0xFb8cc0D4E2c025A1B6429Ef942bf33D0f41fED34"; // CrossFi Testnet Swap Contract

// CrossFI Swap Contract ABI - Matches the actual deployed contract
export const SWAP_CONTRACT_ABI = [
  // Constructor
  {
    "inputs": [{"internalType": "address", "name": "_tUSDC", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  // Swap Functions
  {
    "inputs": [{"internalType": "uint256", "name": "minTUSDCOut", "type": "uint256"}],
    "name": "swapXFIForTUSDC",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tusdcIn", "type": "uint256"},
      {"internalType": "uint256", "name": "minXFIOut", "type": "uint256"}
    ],
    "name": "swapTUSDCForXFI",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Liquidity Functions
  {
    "inputs": [
      {"internalType": "uint256", "name": "tusdcAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "minXFI", "type": "uint256"},
      {"internalType": "uint256", "name": "minTUSDC", "type": "uint256"}
    ],
    "name": "addLiquidity",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Quote Functions - CORRECT signature with 3 parameters
  {
    "inputs": [
      {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"internalType": "uint256", "name": "reserveIn", "type": "uint256"},
      {"internalType": "uint256", "name": "reserveOut", "type": "uint256"}
    ],
    "name": "getAmountOut",
    "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
    "stateMutability": "pure",
    "type": "function"
  },
  // Price Functions  
  {
    "inputs": [],
    "name": "getCurrentXFIPrice",
    "outputs": [{"internalType": "uint256", "name": "price", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Reserve Functions - Using the actual contract functions
  {
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      {"internalType": "uint256", "name": "xfiReserve", "type": "uint256"},
      {"internalType": "uint256", "name": "tusdcReserve", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Public variables (auto-generated getters)
  {
    "inputs": [],
    "name": "reserveXFI",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reserveTUSDC",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "tokenIn", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "tokenOut", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "amountOut", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256"}
    ],
    "name": "Swap",
    "type": "event"
  }
] as const;