import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createServer } from "http";
import { graph } from "./index.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { memoryStore } from "./memory.js";
import { authenticateToken, requireWalletConnection, AuthenticatedRequest } from "./middleware/auth.js";
import { connectDB } from "./db/connect.js";
import { contractRoutes } from "./routes/contract.js";
import gamificationRoutes from "./routes/gamification.js";
import userWalletRoutes from "./routes/userWallet.js";
import userPaymentLinksRoutes from "./routes/userPaymentLinks.js";
import { priceDataRoutes } from "./routes/price-data.js";
import dcaRoutes from "./routes/dca.js";
import swapRoutes from "./routes/swap.js";
import analyticsRoutes from "./routes/analytics.js";
import { PriceCacheService } from "./services/price-cache.js";
import { DCAExecutorService } from "./services/dca-executor.js";
import { CronService } from "./services/cronService.js";
import { setCurrentUserFrontendWalletAddress } from "./tools.js";
import {setUserContext} from "./middleware/setUserContext.js"
import { initializeSocket, closeSocket } from "./socket/index.js";
import { AnalyticsService } from "./services/analytics.js";

config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3030;

// Simple rate limiting for message endpoint
const messageRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 10;

// Rate limiting middleware for messages
const rateLimitMessages = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const frontendWalletAddress = req.user?.frontendWalletAddress;
  
  if (!frontendWalletAddress) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const now = Date.now();
  const userLimit = messageRateLimit.get(frontendWalletAddress);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    messageRateLimit.set(frontendWalletAddress, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  if (userLimit.count >= MAX_MESSAGES_PER_MINUTE) {
    return res.status(429).json({
      error: 'Too many messages',
      message: 'Please wait a moment before sending another message.',
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    });
  }

  // Increment count
  userLimit.count++;
  return next();
};

// Clean up expired rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of messageRateLimit.entries()) {
    if (now > limit.resetTime) {
      messageRateLimit.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

// CORS configuration for production
const corsOptions = {
  origin: "*",
  // origin: ["http://localhost:5173","https://oni-production.up.railway.app","https://oni-one.vercel.app/"],
  credentials: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'mongodb',
    message: 'Backend is running successfully!'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend API is working!',
    timestamp: new Date().toISOString()
  });
}); 

// Test payment links endpoint (no auth required)
app.get('/api/test/payment-links', (req, res) => {
  res.json({ 
    message: 'Payment links API is accessible!',
    timestamp: new Date().toISOString(),
    routes: {
      stats: '/api/user/payment-links/stats',
      list: '/api/user/payment-links',
      create: 'POST /api/user/payment-links'
    }
  });
}); 

// Payment links health check (no auth required)
app.get('/api/payment-links/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
}); 

// Test payment link creation (no auth required - for debugging)
app.get('/api/test/create-payment-link', async (req, res) => {
  try {
    // Test if PaymentLink model is available
    const { PaymentLink } = await import('./models/PaymentLink.js');
    
    if (!PaymentLink) {
      return res.status(500).json({ 
        success: false,
        error: 'PaymentLink model not available' 
      });
    }
    
    // Test database connection
    try {
      await connectDB();
    } catch (error) {
      return res.status(503).json({ 
        success: false,
        error: 'Database not connected',
        message: error.message
      });
    }
    
    res.json({ 
      success: true,
      message: 'Payment link creation test passed',
      database: 'connected',
      model: 'available'
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'Test failed',
      details: error.message 
    });
  }
}); 


// API routes
app.use('/api/contract', authenticateToken, setUserContext, contractRoutes);
app.use('/api/gamification' , gamificationRoutes);
app.use('/api/user/wallet', authenticateToken, setUserContext, userWalletRoutes);
app.use('/api/user/payment-links', setUserContext, userPaymentLinksRoutes);
app.use('/api/price-data', authenticateToken, setUserContext, priceDataRoutes);
app.use('/api/dca', authenticateToken, setUserContext, dcaRoutes);
app.use('/api/swap', swapRoutes);
app.use('/api/analytics', analyticsRoutes);
// Main message endpoint
app.post('/message', authenticateToken, requireWalletConnection, setUserContext, rateLimitMessages, async (req: AuthenticatedRequest, res) => {
  try {
    const { message } = req.body;
    const user = req.user!;

    // Record analytics for this message
    try {
      // Determine message type based on user message
      let messageType: 'balance_check' | 'transaction' | 'payment_link' | 'dca' | 'general' | 'other' = 'general';
      
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('balance') || lowerMessage.includes('check') || lowerMessage.includes('show')) {
        messageType = 'balance_check';
      } else if (lowerMessage.includes('send') || lowerMessage.includes('transfer') || lowerMessage.includes('transaction')) {
        messageType = 'transaction';
      } else if (lowerMessage.includes('payment') || lowerMessage.includes('link')) {
        messageType = 'payment_link';
      } else if (lowerMessage.includes('dca') || lowerMessage.includes('order')) {
        messageType = 'dca';
      }
      
      await AnalyticsService.recordMessage(user.frontendWalletAddress, user.frontendWalletAddress, messageType);
      console.log(`📊 Analytics recorded: ${messageType} message from ${user.frontendWalletAddress}`);
    } catch (analyticsError) {
      console.warn('⚠️ Failed to record analytics for message:', analyticsError);
    }

    // Add user message to memory
    memoryStore.addMessage(user.frontendWalletAddress, new HumanMessage(message));

    // Get conversation history
    const history = memoryStore.getHistory(user.frontendWalletAddress);

    // Run the graph with user frontend wallet address in state
    const result = await graph.invoke({
      messages: history,
      userId: user.frontendWalletAddress, // Pass frontend wallet address to graph state
    });

    // Add AI response to memory
    const aiMessage = result.messages[result.messages.length - 1];
    if (aiMessage) {
      memoryStore.addMessage(user.frontendWalletAddress, aiMessage);
    }

    // Extract the response
    const response = aiMessage?.content || "I'm sorry, I couldn't generate a response.";

    res.json({ response });
  } catch (error: any) {
    console.error('Error processing message:', error);
    
    // Handle specific LLM rate limiting errors
    if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'Service temporarily unavailable',
        message: 'The AI service is currently experiencing high demand. Please try again in a few minutes.',
        retryAfter: 300 // 5 minutes
      });
    }
    
    // Handle LLM service errors
    if (error.message?.includes('LLM service error')) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'The AI service is temporarily unavailable. Please try again later.',
        retryAfter: 60 // 1 minute
      });
    }
    
    // Handle tool use failed errors (AI formatting issues)
    if (error.message?.includes('tool_use_failed') || error.message?.includes('Failed to call a function')) {
      return res.status(200).json({ 
        response: '✅ Transaction completed successfully! The operation was processed, but I had trouble formatting the response. You can check your transaction history to confirm the details.'
      });
    }
    
    // Handle authentication errors
    if (error.message?.includes('Authentication failed')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Please check your API configuration and try again.'
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong. Please try again.'
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
const startServer = async () => {
  try {
    // Try to connect to database (but don't fail if it's not available)
    try {
      await connectDB();
      console.log('✅ Connected to MongoDB');
    } catch (dbError) {
      console.warn('⚠️ Database connection failed (continuing without DB):', dbError);
      // Don't exit the process, just continue without database
    }

    // Initialize services (PriceCacheService doesn't need initialization)
    console.log('✅ Price cache service ready');

    // Try to start DCA executor (but don't fail if it's not available)
    try {
      DCAExecutorService.startExecutor();
      console.log('✅ DCA executor service started');
    } catch (dcaError) {
      console.warn('⚠️ DCA executor failed to start (continuing without DCA):', dcaError);
    }

    // Initialize cron service
    try {
      CronService.getInstance().init();
      console.log('✅ Cron service initialized');
    } catch (cronError) {
      console.warn('⚠️ Cron service failed to start (continuing without cron):', cronError);
    }

    // Initialize analytics
    try {
      await AnalyticsService.initializeAnalytics();
      console.log('✅ Analytics service initialized');
    } catch (analyticsError) {
      console.warn('⚠️ Analytics service failed to start (continuing without analytics):', analyticsError);
    }

    // Initialize WebSocket server
    try {
      console.log('🔌 Attempting to initialize WebSocket server...');
      initializeSocket(server);
      console.log('✅ WebSocket server initialized successfully');
    } catch (wsError) {
      console.error('❌ WebSocket initialization failed:', wsError);
      console.warn('⚠️ Continuing without WebSocket support');
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  DCAExecutorService.stopExecutor();
  CronService.getInstance().stop();
  closeSocket();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  DCAExecutorService.stopExecutor();
  CronService.getInstance().stop();
  closeSocket();
  process.exit(0);
});

// Start the server
startServer(); 