#!/bin/bash

# Vercel Backend Deployment Script
# This script automates the deployment process to Vercel

set -e  # Exit on any error

echo "🚀 Starting Vercel Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the backend directory
if [ ! -f "package.json" ] || [ ! -f "vercel.json" ]; then
    print_error "Please run this script from the backend directory"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed. Please install it first:"
    echo "npm install -g vercel"
    exit 1
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_warning "You are not logged in to Vercel. Please login first:"
    echo "vercel login"
    exit 1
fi

print_status "Building project..."
npm run build

if [ $? -eq 0 ]; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Please fix the errors and try again"
    exit 1
fi

print_status "Testing build..."
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Test health endpoint
if curl -f http://localhost:3030/health &> /dev/null; then
    print_success "Local server test passed"
else
    print_warning "Local server test failed, but continuing with deployment"
fi

# Kill the test server
kill $SERVER_PID 2>/dev/null || true

print_status "Deploying to Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    print_success "Deployment completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Set up environment variables in Vercel dashboard"
    echo "2. Test your API endpoints"
    echo "3. Deploy your frontend"
    echo ""
    print_status "Environment variables you need to set:"
    echo "- PRIVY_APP_ID"
    echo "- PRIVY_APP_SECRET"
    echo "- MONGODB_URI"
    echo "- ENCRYPTION_KEY"
    echo "- GROQ_API_KEY"
    echo "- RPC_URL"
    echo "- CHAIN_ID"
    echo "- FRONTEND_URL"
else
    print_error "Deployment failed"
    exit 1
fi 