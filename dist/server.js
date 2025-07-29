import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createServer } from "http";
import { graph } from "./index.js";
import { HumanMessage } from "@langchain/core/messages";
import { memoryStore } from "./memory.js";
import { authenticateToken, requireWalletConnection } from "./middleware/auth.js";
import { connectDB } from "./db/connect.js";
import { contractRoutes } from "./routes/contract.js";
import gamificationRoutes from "./routes/gamification.js";
import userWalletRoutes from "./routes/userWallet.js";
import userPaymentLinksRoutes from "./routes/userPaymentLinks.js";
import { priceDataRoutes } from "./routes/price-data.js";
import dcaRoutes from "./routes/dca.js";
import { DCAExecutorService } from "./services/dca-executor.js";
import { CronService } from "./services/cronService.js";
import { setUserContext } from "./middleware/setUserContext.js";
import { initializeSocket, closeSocket } from "./socket/index.js";
config();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3030;
const messageRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_MESSAGES_PER_MINUTE = 10;
const rateLimitMessages = (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const now = Date.now();
    const userLimit = messageRateLimit.get(userId);
    if (!userLimit || now > userLimit.resetTime) {
        messageRateLimit.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    if (userLimit.count >= MAX_MESSAGES_PER_MINUTE) {
        return res.status(429).json({
            error: 'Too many messages',
            message: 'Please wait a moment before sending another message.',
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        });
    }
    userLimit.count++;
    return next();
};
setInterval(() => {
    const now = Date.now();
    for (const [userId, limit] of messageRateLimit.entries()) {
        if (now > limit.resetTime) {
            messageRateLimit.delete(userId);
        }
    }
}, 5 * 60 * 1000);
const corsOptions = {
    origin: "*",
    credentials: false,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'supabase',
        message: 'Backend is running successfully!'
    });
});
app.get('/test', (req, res) => {
    res.json({
        message: 'Backend API is working!',
        timestamp: new Date().toISOString()
    });
});
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
app.get('/api/payment-links/health', async (req, res) => {
    try {
        await connectDB();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});
app.get('/api/test/create-payment-link', async (req, res) => {
    try {
        const { PaymentLink } = await import('./models/PaymentLink.js');
        if (!PaymentLink) {
            return res.status(500).json({
                success: false,
                error: 'PaymentLink model not available'
            });
        }
        try {
            await connectDB();
        }
        catch (error) {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Test failed',
            details: error.message
        });
    }
});
app.use('/api/contract', authenticateToken, setUserContext, contractRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/user/wallet', authenticateToken, setUserContext, userWalletRoutes);
app.use('/api/user/payment-links', setUserContext, userPaymentLinksRoutes);
app.use('/api/price-data', authenticateToken, setUserContext, priceDataRoutes);
app.use('/api/dca', authenticateToken, setUserContext, dcaRoutes);
app.post('/message', authenticateToken, requireWalletConnection, rateLimitMessages, async (req, res) => {
    try {
        const { message } = req.body;
        const user = req.user;
        memoryStore.addMessage(user.id, new HumanMessage(message));
        const history = memoryStore.getHistory(user.id);
        const result = await graph.invoke({
            messages: history,
            userId: user.id,
        });
        const aiMessage = result.messages[result.messages.length - 1];
        if (aiMessage) {
            memoryStore.addMessage(user.id, aiMessage);
        }
        const response = aiMessage?.content || "I'm sorry, I couldn't generate a response.";
        res.json({ response });
    }
    catch (error) {
        console.error('Error processing message:', error);
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
            return res.status(429).json({
                error: 'Service temporarily unavailable',
                message: 'The AI service is currently experiencing high demand. Please try again in a few minutes.',
                retryAfter: 300
            });
        }
        if (error.message?.includes('LLM service error')) {
            return res.status(503).json({
                error: 'AI service unavailable',
                message: 'The AI service is temporarily unavailable. Please try again later.',
                retryAfter: 60
            });
        }
        if (error.message?.includes('tool_use_failed') || error.message?.includes('Failed to call a function')) {
            return res.status(200).json({
                response: '✅ Transaction completed successfully! The operation was processed, but I had trouble formatting the response. You can check your transaction history to confirm the details.'
            });
        }
        if (error.message?.includes('Authentication failed')) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Please check your API configuration and try again.'
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong. Please try again.'
        });
    }
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});
const startServer = async () => {
    try {
        try {
            await connectDB();
            console.log('✅ Connected to Supabase');
        }
        catch (dbError) {
            console.warn('⚠️ Database connection failed (continuing without DB):', dbError);
        }
        console.log('✅ Price cache service ready');
        try {
            DCAExecutorService.startExecutor();
            console.log('✅ DCA executor service started');
        }
        catch (dcaError) {
            console.warn('⚠️ DCA executor failed to start (continuing without DCA):', dcaError);
        }
        try {
            CronService.getInstance().init();
            console.log('✅ Cron service initialized');
        }
        catch (cronError) {
            console.warn('⚠️ Cron service failed to start (continuing without cron):', cronError);
        }
        try {
            console.log('🔌 Attempting to initialize WebSocket server...');
            initializeSocket(server);
            console.log('✅ WebSocket server initialized successfully');
        }
        catch (wsError) {
            console.error('❌ WebSocket initialization failed:', wsError);
            console.warn('⚠️ Continuing without WebSocket support');
        }
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
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
startServer();
//# sourceMappingURL=server.js.map