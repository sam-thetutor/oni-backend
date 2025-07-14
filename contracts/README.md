# CrossFI Swap Contract

A decentralized exchange (DEX) smart contract for swapping between tUSDC and XFI tokens on the CrossFI testnet.

## Features

- **Automated Market Maker (AMM)**: Uses constant product formula (x * y = k) for price calculation
- **Liquidity Management**: Add and remove liquidity to earn trading fees
- **Swap Functions**: Swap between XFI (native token) and tUSDC (ERC20)
- **Slippage Protection**: Built-in minimum output protection
- **Fee System**: 0.3% trading fee for liquidity providers
- **Security Features**: Reentrancy protection, pausable, access control
- **Price Oracles**: Real-time price calculation based on reserves

## Contract Architecture

### Core Functions

1. **addLiquidity()**: Add XFI and tUSDC to the liquidity pool
2. **removeLiquidity()**: Remove liquidity and receive proportional tokens
3. **swapXFIForTUSDC()**: Swap native XFI for tUSDC tokens
4. **swapTUSDCForXFI()**: Swap tUSDC tokens for native XFI
5. **getAmountOut()**: Calculate expected output for a given input
6. **getCurrentXFIPrice()**: Get current XFI price in tUSDC

### Key Parameters

- **tUSDC Address**: `0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50` (CrossFI testnet)
- **Swap Fee**: 0.3% (30/10000)
- **Minimum Liquidity**: 1000 wei (prevents division by zero)

## Setup and Installation

### Prerequisites

- Node.js v16 or higher
- npm or yarn
- CrossFI testnet wallet with XFI and tUSDC tokens

### Installation

```bash
# Navigate to contracts directory
cd backend/contracts

# Install dependencies
npm install

# Install OpenZeppelin contracts
npm install @openzeppelin/contracts@^4.9.3

# Install Hardhat and tooling
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### Environment Setup

Create a `.env` file in the contracts directory:

```env
# Your wallet private key (without 0x prefix)
# IMPORTANT: Never commit your real private key to version control!
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix

# CrossFI Testnet RPC URL (default is usually fine)
CROSSFI_RPC_URL=https://rpc.testnet.ms

# Optional: Explorer API key for contract verification
ETHERSCAN_API_KEY=your_explorer_api_key_if_available
```

**To get your private key:**
1. Open your wallet (MetaMask, Trust Wallet, etc.)
2. Go to Account Details → Export Private Key
3. Copy the private key (remove the "0x" prefix if present)
4. Paste it in the `.env` file

**Make sure you have XFI tokens** in your wallet for deployment gas fees on CrossFI testnet.

**To get XFI testnet tokens:**
- Visit the CrossFI testnet faucet (if available)
- Or ask in the CrossFI Discord/Telegram for testnet tokens
- You'll need at least 0.1 XFI for deployment

## Compilation and Testing

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Test Coverage

```bash
npx hardhat coverage
```

## Deployment

### Local Development

```bash
# Start local Hardhat network
npx hardhat node

# Deploy to local network (in another terminal)
npx hardhat run scripts/deploy.js --network localhost
```

### CrossFI Testnet Deployment

```bash
# Make sure you have XFI tokens for gas fees
npx hardhat run scripts/deploy.js --network crossfi_testnet
```

### Expected Output

```
Deploying CrossFI Swap Contract...
Network: crossfi_testnet
tUSDC Address: 0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50
Deploying contracts with account: 0x...
Account balance: 1.234567 XFI
✅ CrossFI Swap Contract deployed successfully!
📍 Contract address: 0x...
🔗 Transaction hash: 0x...
```

## Usage Examples

### Adding Initial Liquidity

```javascript
// Add 1 XFI and 80 tUSDC to the pool
await swapContract.addLiquidity(
  ethers.utils.parseUnits("80", 18), // tUSDC amount
  0, // min XFI (no slippage protection for initial)
  0, // min tUSDC (no slippage protection for initial)
  { value: ethers.utils.parseEther("1") } // XFI amount
);
```

### Swapping XFI for tUSDC

```javascript
// Swap 0.1 XFI for tUSDC with 1% slippage protection
const xfiAmount = ethers.utils.parseEther("0.1");
const expectedTUSDC = await swapContract.getAmountOut(
  xfiAmount,
  await swapContract.reserveXFI(),
  await swapContract.reserveTUSDC()
);
const minTUSDC = expectedTUSDC.mul(99).div(100); // 1% slippage

await swapContract.swapXFIForTUSDC(minTUSDC, {
  value: xfiAmount
});
```

### Swapping tUSDC for XFI

```javascript
// First approve the contract to spend tUSDC
await tUSDCContract.approve(swapContract.address, ethers.utils.parseUnits("8", 18));

// Swap 8 tUSDC for XFI with 1% slippage protection
const tusdcAmount = ethers.utils.parseUnits("8", 18);
const expectedXFI = await swapContract.getAmountOut(
  tusdcAmount,
  await swapContract.reserveTUSDC(),
  await swapContract.reserveXFI()
);
const minXFI = expectedXFI.mul(99).div(100); // 1% slippage

await swapContract.swapTUSDCForXFI(tusdcAmount, minXFI);
```

### Removing Liquidity

```javascript
// Remove 50% of your liquidity
const liquidityBalance = await swapContract.liquidityBalance(userAddress);
const liquidityToRemove = liquidityBalance.div(2);

await swapContract.removeLiquidity(
  liquidityToRemove,
  0, // min XFI to receive
  0  // min tUSDC to receive
);
```

## Integration with Backend

### Update Backend Configuration

After deployment, update your backend configuration:

```typescript
// backend/src/constants/contract.ts
export const SWAP_CONTRACT_ADDRESS = "0x..."; // Your deployed contract address
export const SWAP_CONTRACT_ABI = [...]; // Import from artifacts
```

### Update Swap Service

```typescript
// backend/src/services/swap.ts
import { SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI } from '../constants/contract.js';

export class SwapService {
  private swapContract: Contract;

  constructor() {
    this.swapContract = new ethers.Contract(
      SWAP_CONTRACT_ADDRESS,
      SWAP_CONTRACT_ABI,
      publicClient
    );
  }

  async executeSwap(from: string, to: string, amount: string) {
    // Use actual contract calls instead of simulations
    if (from === 'XFI' && to === 'tUSDC') {
      return await this.swapContract.swapXFIForTUSDC(minOutput, { value: amount });
    } else if (from === 'tUSDC' && to === 'XFI') {
      return await this.swapContract.swapTUSDCForXFI(amount, minOutput);
    }
  }
}
```

## Security Considerations

1. **Slippage Protection**: Always set appropriate minimum output amounts
2. **Approval Management**: Only approve necessary amounts for ERC20 transfers
3. **Front-running**: Consider using commit-reveal schemes for large trades
4. **Liquidity Risks**: Pool can become imbalanced with large trades
5. **Admin Functions**: Contract owner can pause in emergencies

## Contract Addresses

### CrossFI Testnet
- **tUSDC Token**: `0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50`
- **Swap Contract**: TBD (after deployment)

## Support and Troubleshooting

### Common Issues

1. **"Insufficient Liquidity"**: Pool needs initial liquidity before swaps
2. **"Excessive Slippage"**: Increase slippage tolerance or reduce trade size
3. **"Transfer Failed"**: Check token approvals and balances
4. **Gas Estimation Failed**: Ensure sufficient XFI balance for gas

### Gas Optimization Tips

- Batch multiple operations when possible
- Use appropriate gas price for network conditions
- Consider trade size impact on slippage

### Getting Help

- Check transaction on CrossFI testnet explorer
- Verify contract addresses and function calls
- Test with small amounts first
- Review contract events for debugging

## License

MIT License - see LICENSE file for details. 