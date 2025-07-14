import express from "express";
import cors from "cors";
import { config } from "dotenv";
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
import { PriceCacheService } from "./services/price-cache.js";
import { DCAExecutorService } from "./services/dca-executor.js";
import { setCurrentUserId } from "./tools.js";
import {setUserContext} from "./middleware/setUserContext.js"

config();

const app = express();
const PORT = process.env.PORT || 3030;

// CORS configuration for production
const corsOptions = {
  origin: '*',
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
    message: 'Backend is running successfully!'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodbUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
    encryptionKey: process.env.ENCRYPTION_KEY ? 'Set' : 'Not set'
  });
});

// Debug endpoint to check database connection
app.get('/debug/db', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    res.json({
      databaseState: states[dbState],
      readyState: dbState,
      message: dbState === 1 ? 'Database is connected' : 'Database is not connected'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check database status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}); 


// API routes
app.use('/api/contract', authenticateToken, setUserContext, contractRoutes);
app.use('/api/gamification', setUserContext, gamificationRoutes);
app.use('/api/user/wallet', authenticateToken, setUserContext, userWalletRoutes);
app.use('/api/user/payment-links', authenticateToken, setUserContext, userPaymentLinksRoutes);
app.use('/api/price-data', authenticateToken, setUserContext, priceDataRoutes);
app.use('/api/dca', authenticateToken, setUserContext, dcaRoutes);
// Main message endpoint
app.post('/message', authenticateToken, requireWalletConnection, async (req: AuthenticatedRequest, res) => {
  try {
    const { message } = req.body;
    const user = req.user!;

    console.log(`Processing message from user ${user.id}: ${message}`);

    console.log("user connectred waller :",user)

    // Add user message to memory
    memoryStore.addMessage(user.id, new HumanMessage(message));

    // Get conversation history
    const history = memoryStore.getHistory(user.id);

    // Run the graph with user ID in state
    const result = await graph.invoke({
      messages: history,
      userId: user.walletAddress, // Pass user ID to graph state
    });

    // Add AI response to memory
    const aiMessage = result.messages[result.messages.length - 1];
    if (aiMessage) {
      memoryStore.addMessage(user.id, aiMessage);
    }

    // Extract the response
    const response = aiMessage?.content || "I'm sorry, I couldn't generate a response.";

    console.log(`Response to user ${user.id}: ${response}`);

    res.json({ response });
  } catch (error: any) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
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

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
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
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  DCAExecutorService.stopExecutor();
  process.exit(0);
});

// Start the server
startServer(); 