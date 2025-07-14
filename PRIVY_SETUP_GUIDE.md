# Privy Authentication Setup Guide

## 🔧 Fixing the 403 Forbidden Error

The error `POST https://auth.privy.io/api/v1/siwe/init 403 (Forbidden)` is caused by missing or incorrect Privy configuration.

## 📋 Required Environment Variables

Add these to your `backend/.env` file:

```env
# Privy Configuration (REQUIRED)
PRIVY_APP_ID=cmcp9doki0072k30m7wxy5loa
PRIVY_APP_SECRET=your_privy_app_secret_here

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/buai

# Encryption Key (REQUIRED)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# CrossFI Network Configuration
RPC_URL=https://rpc.testnet.ms
CHAIN_ID=4157

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

## 🔑 Getting Your Privy App Secret

### Step 1: Access Privy Dashboard
1. Go to [console.privy.io](https://console.privy.io)
2. Sign in with your account
3. Select your app: `cmcp9doki0072k30m7wxy5loa`

### Step 2: Get App Secret
1. Navigate to **Settings** → **API Keys**
2. Copy your **App Secret** (starts with `sk_`)
3. Add it to your `.env` file as `PRIVY_APP_SECRET`

### Step 3: Verify App Configuration
In your Privy dashboard, ensure:

1. **Login Methods**: Wallet is enabled
2. **Supported Chains**: CrossFi (4157) is added
3. **App Domain**: Your domain is whitelisted

## 🛠️ Configuration Checklist

### Frontend Configuration ✅
Your `src/config/privy.ts` looks correct:
```typescript
export const privyConfig = {
  appId: 'cmcp9doki0072k30m7wxy5loa', // ✅ Correct
  config: {
    loginMethods: ['wallet'],
    defaultChain: crossfi,
    supportedChains: [crossfi],
  },
  // ... rest of config
};
```

### Backend Configuration ✅
Your `backend/src/services/privy.ts` is set up correctly:
```typescript
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);
```

## 🚨 Common Issues & Solutions

### Issue 1: Missing PRIVY_APP_SECRET
**Error**: `403 Forbidden` from Privy API
**Solution**: Add `PRIVY_APP_SECRET` to your `.env` file

### Issue 2: Incorrect App ID
**Error**: `403 Forbidden` or `App not found`
**Solution**: Verify `PRIVY_APP_ID=cmcp9doki0072k30m7wxy5loa`

### Issue 3: Domain Not Whitelisted
**Error**: `403 Forbidden` on specific domains
**Solution**: Add your domain to Privy dashboard:
1. Go to Privy Console → Settings → Domains
2. Add: `localhost`, `127.0.0.1`, your ngrok domain

### Issue 4: Chain Not Supported
**Error**: `Chain not supported` or wallet connection fails
**Solution**: Ensure CrossFi chain (4157) is configured in Privy

## 🔍 Debugging Steps

### Step 1: Check Environment Variables
```bash
cd backend
echo "PRIVY_APP_ID: $PRIVY_APP_ID"
echo "PRIVY_APP_SECRET: $PRIVY_APP_SECRET"
```

### Step 2: Test Privy Connection
Add this to your backend temporarily:
```typescript
// backend/src/server.ts (temporary debug)
import { PrivyClient } from '@privy-io/server-auth';

const testPrivy = async () => {
  try {
    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!
    );
    console.log('✅ Privy client initialized successfully');
  } catch (error) {
    console.error('❌ Privy client failed:', error);
  }
};

testPrivy();
```

### Step 3: Check Network Requests
1. Open browser DevTools → Network tab
2. Try to connect wallet
3. Look for the failing request to `auth.privy.io`
4. Check request headers and response

## 🚀 Quick Fix Steps

1. **Add missing environment variables**:
   ```bash
   cd backend
   echo "PRIVY_APP_SECRET=your_secret_here" >> .env
   echo "ENCRYPTION_KEY=your_32_char_key_here" >> .env
   ```

2. **Restart your backend**:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

3. **Clear browser cache** and try again

4. **Check Privy dashboard** for domain whitelisting

## 🔒 Security Notes

- **Never commit** your `PRIVY_APP_SECRET` to version control
- **Use strong encryption keys** for `ENCRYPTION_KEY`
- **Whitelist only necessary domains** in Privy dashboard
- **Rotate secrets** regularly in production

## 📞 Getting Help

If the issue persists:

1. **Check Privy Console** for any error messages
2. **Verify your app configuration** in the dashboard
3. **Test with a simple Privy example** to isolate the issue
4. **Contact Privy support** with your app ID and error details

## ✅ Success Indicators

When properly configured, you should see:
- ✅ Wallet connection works without 403 errors
- ✅ User authentication succeeds
- ✅ Backend can verify Privy tokens
- ✅ Database user creation works
- ✅ All wallet operations function normally 