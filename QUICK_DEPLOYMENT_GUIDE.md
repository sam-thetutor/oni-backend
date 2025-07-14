# 🚀 Quick Vercel Deployment Guide

## Prerequisites
- Vercel account: [vercel.com](https://vercel.com)
- Vercel CLI: `npm install -g vercel`
- Git repository with your code

## 🎯 Quick Deployment Steps

### 1. Install Vercel CLI & Login
```bash
npm install -g vercel
vercel login
```

### 2. Deploy from Backend Directory
```bash
cd backend
vercel
```

### 3. Follow the Prompts
- Set up and deploy: `Y`
- Which scope: Select your account
- Link to existing project: `N`
- Project name: `buai-backend` (or your preferred name)
- Directory: `./` (current directory)
- Override settings: `N`

### 4. Set Environment Variables
```bash
vercel env add PRIVY_APP_ID
vercel env add PRIVY_APP_SECRET
vercel env add MONGODB_URI
vercel env add ENCRYPTION_KEY
vercel env add GROQ_API_KEY
vercel env add RPC_URL
vercel env add CHAIN_ID
vercel env add FRONTEND_URL
```

### 5. Deploy to Production
```bash
vercel --prod
```

## 🔧 Required Environment Variables

Copy these values to Vercel dashboard:

```env
# Privy Configuration
PRIVY_APP_ID=cmcp9doki0072k30m7wxy5loa
PRIVY_APP_SECRET=your_privy_app_secret_here

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/buai?retryWrites=true&w=majority

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

## 🗄️ MongoDB Atlas Setup

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free cluster
3. Set up database access (username/password)
4. Set up network access (allow all IPs: `0.0.0.0/0`)
5. Get connection string and add to `MONGODB_URI`

## ✅ Post-Deployment Checklist

- [ ] Backend deploys successfully
- [ ] Health endpoint works: `https://your-backend.vercel.app/health`
- [ ] Environment variables are set
- [ ] Database connection works
- [ ] Test API endpoints

## 🔗 Your Backend URL
After deployment, you'll get a URL like:
`https://buai-backend-xxxxx.vercel.app`

## 📱 Next Steps
1. Update frontend configuration with backend URL
2. Deploy frontend to Vercel
3. Test full application

## 🆘 Troubleshooting

**Build fails**: Check TypeScript errors locally first
**Environment variables missing**: Add them in Vercel dashboard
**Database connection fails**: Check MongoDB Atlas settings
**CORS errors**: Update FRONTEND_URL environment variable

## 📞 Support
- Check Vercel deployment logs
- Verify environment variables
- Test locally with production config 