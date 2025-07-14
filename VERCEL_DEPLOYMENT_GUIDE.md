# Vercel Backend Deployment Guide

## 🚀 Deploying Your CrossFI Backend to Vercel

This guide will help you deploy your backend API to Vercel with all the necessary configurations.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally
   ```bash
   npm install -g vercel
   ```
3. **Git Repository**: Your code should be in a Git repository

## 🔧 Pre-Deployment Setup

### 1. Build Your Project Locally
```bash
cd backend
npm install
npm run build
```

### 2. Test Local Build
```bash
npm start
# Should start without errors
```

## 🌐 Environment Variables Setup

### Required Environment Variables

You'll need to set these in Vercel's dashboard:

```env
# Privy Configuration
PRIVY_APP_ID=cmcp9doki0072k30m7wxy5loa
PRIVY_APP_SECRET=your_privy_app_secret_here

# Database Configuration
MONGODB_URI=your_mongodb_atlas_connection_string

# Encryption Key (32 characters)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# CrossFI Network Configuration
RPC_URL=https://rpc.testnet.ms
CHAIN_ID=4157

# LLM Provider Configuration
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile

# Frontend URL (update after frontend deployment)
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Node Environment
NODE_ENV=production
```

## 🗄️ Database Setup (MongoDB Atlas)

### 1. Create MongoDB Atlas Cluster
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free cluster
3. Set up database access (username/password)
4. Set up network access (allow all IPs: `0.0.0.0/0`)

### 2. Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string
4. Replace `<password>` with your database password
5. Add to Vercel environment variables as `MONGODB_URI`

## 🚀 Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy from backend directory**:
   ```bash
   cd backend
   vercel
   ```

3. **Follow the prompts**:
   - Set up and deploy: `Y`
   - Which scope: Select your account
   - Link to existing project: `N`
   - Project name: `buai-backend` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings: `N`

4. **Set environment variables**:
   ```bash
   vercel env add PRIVY_APP_ID
   vercel env add PRIVY_APP_SECRET
   vercel env add MONGODB_URI
   vercel env add ENCRYPTION_KEY
   vercel env add GROQ_API_KEY
   # ... add all other required variables
   ```

5. **Redeploy with environment variables**:
   ```bash
   vercel --prod
   ```

### Method 2: Vercel Dashboard

1. **Connect your Git repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository

2. **Configure project**:
   - Framework Preset: `Other`
   - Root Directory: `backend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add environment variables**:
   - Go to Project Settings → Environment Variables
   - Add each variable from the list above

4. **Deploy**:
   - Click "Deploy"

## 🔍 Post-Deployment Verification

### 1. Check Deployment Status
```bash
vercel ls
# or check Vercel dashboard
```

### 2. Test Your API Endpoints
```bash
# Test health endpoint
curl https://your-backend-url.vercel.app/health

# Test message endpoint (requires authentication)
curl -X POST https://your-backend-url.vercel.app/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"message": "Hello"}'
```

### 3. Check Logs
```bash
vercel logs
# or check in Vercel dashboard
```

## 🔧 Common Issues & Solutions

### Issue 1: Build Failures
**Error**: TypeScript compilation errors
**Solution**:
```bash
# Fix TypeScript errors locally first
npm run build
# Fix any errors, then redeploy
vercel --prod
```

### Issue 2: Environment Variables Not Set
**Error**: `process.env.PRIVY_APP_SECRET is undefined`
**Solution**:
```bash
# Add missing environment variables
vercel env add PRIVY_APP_SECRET
vercel --prod
```

### Issue 3: Database Connection Issues
**Error**: MongoDB connection failed
**Solution**:
1. Check `MONGODB_URI` format
2. Ensure MongoDB Atlas network access allows all IPs
3. Verify database credentials

### Issue 4: Function Timeout
**Error**: Function execution timeout
**Solution**:
- Vercel functions have a 10-second timeout by default
- For longer operations, consider using background jobs
- Update `vercel.json` if needed

## 📊 Monitoring & Analytics

### 1. Vercel Analytics
- Function execution times
- Error rates
- Request volumes

### 2. Custom Logging
```typescript
// Add to your server.ts
console.log('Server started on port:', process.env.PORT);
console.log('Environment:', process.env.NODE_ENV);
```

## 🔄 Continuous Deployment

### Automatic Deployments
- Every push to `main` branch triggers deployment
- Preview deployments for pull requests
- Automatic rollback on failures

### Manual Deployments
```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit secrets to Git
- Use Vercel's environment variable encryption
- Rotate secrets regularly

### 2. CORS Configuration
```typescript
// Update CORS in server.ts for production
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### 3. Rate Limiting
Consider adding rate limiting for production:
```bash
npm install express-rate-limit
```

## 📱 Frontend Integration

### Update Frontend Configuration
After backend deployment, update your frontend:

```typescript
// src/hooks/useBackend.ts
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://your-backend-url.vercel.app';
```

### Environment Variables for Frontend
Add to your frontend `.env`:
```env
VITE_BACKEND_URL=https://your-backend-url.vercel.app
```

## 🎯 Next Steps

1. **Test all API endpoints** thoroughly
2. **Monitor performance** and error rates
3. **Set up alerts** for critical failures
4. **Deploy frontend** to Vercel
5. **Configure custom domain** (optional)

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test locally with production config
4. Check MongoDB Atlas connection
5. Review Vercel documentation

Your backend should now be successfully deployed and ready to serve your CrossFI application! 🚀 