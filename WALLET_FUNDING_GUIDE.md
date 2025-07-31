# Wallet Funding Guide

## Overview

The wallet funding feature automatically sends 0.01 XFI to new users when they create a wallet, ensuring their wallet is activated and ready to use.

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Wallet Funding Configuration
FUNDING_PRIVATE_KEY=d0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5
FUNDING_AMOUNT=0.01
```

### Funding Wallet Details

- **Address**: `0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7`
- **Current Balance**: ~60.125 XFI
- **Funding Amount**: 0.01 XFI per new user
- **Capacity**: Can fund ~6,012 new wallets

## How It Works

1. **User Creation**: When a new user creates an account
2. **Wallet Generation**: A new wallet is generated for the user
3. **Automatic Funding**: 0.01 XFI is automatically sent to the new wallet
4. **Activation**: The wallet is immediately activated and ready to use

## API Endpoints

### Check Funding Status
```http
GET /api/userWallet/funding-status
```

**Response:**
```json
{
  "hasBeenFunded": true,
  "walletAddress": "0x..."
}
```

### Get Funding Wallet Info
```http
GET /api/userWallet/funding-wallet
```

**Response:**
```json
{
  "fundingAddress": "0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7",
  "fundingBalance": "60.1254535625",
  "fundingAmount": "0.01"
}
```

## Testing

Run the test script to verify the funding service:

```bash
node test-wallet-funding.js
```

## Safety Features

- **Balance Check**: Verifies funding wallet has sufficient balance before sending
- **Error Handling**: Graceful handling of funding failures
- **Logging**: Comprehensive logging for monitoring and debugging
- **Non-blocking**: Funding failures don't prevent user creation

## Monitoring

Check the server logs for funding-related messages:

```
🎉 New user created, funding wallet: 0x...
💰 Funding new wallet: 0x...
📊 Amount: 0.01 XFI
✅ Wallet funded successfully! Transaction: 0x...
```

## Troubleshooting

### Common Issues

1. **Insufficient Balance**: Add more XFI to the funding wallet
2. **Private Key Error**: Ensure the private key is properly formatted
3. **Network Issues**: Check RPC connection and gas fees

### Funding Wallet Management

To add funds to the funding wallet, send XFI to:
`0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7`

## Security Notes

- The funding private key should be kept secure
- Consider using environment variables for sensitive data
- Monitor funding wallet balance regularly
- Set up alerts for low balance conditions 