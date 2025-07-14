import express from "express";
import cors from "cors";
import { config } from "dotenv";
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
import { setUserContext } from "./middleware/setUserContext.js";
config();
const app = express();
const PORT = process.env.PORT || 3030;
const corsOptions = {
    origin: ["http://localhost:5173"],
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
        message: 'Backend is running successfully!'
    });
});
app.get('/test', (req, res) => {
    res.json({
        message: 'Backend API is working!',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/contract', authenticateToken, setUserContext, contractRoutes);
app.use('/api/gamification', setUserContext, gamificationRoutes);
app.use('/api/user/wallet', authenticateToken, setUserContext, userWalletRoutes);
app.use('/api/user/payment-links', authenticateToken, setUserContext, userPaymentLinksRoutes);
app.use('/api/price-data', authenticateToken, setUserContext, priceDataRoutes);
app.use('/api/dca', authenticateToken, setUserContext, dcaRoutes);
app.post('/message', authenticateToken, requireWalletConnection, async (req, res) => {
    try {
        const { message } = req.body;
        const user = req.user;
        console.log(`Processing message from user ${user.id}: ${message}`);
        console.log("user connectred waller :", user);
        memoryStore.addMessage(user.id, new HumanMessage(message));
        const history = memoryStore.getHistory(user.id);
        const result = await graph.invoke({
            messages: history,
            userId: user.walletAddress,
        });
        const aiMessage = result.messages[result.messages.length - 1];
        if (aiMessage) {
            memoryStore.addMessage(user.id, aiMessage);
        }
        const response = aiMessage?.content || "I'm sorry, I couldn't generate a response.";
        console.log(`Response to user ${user.id}: ${response}`);
        res.json({ response });
    }
    catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
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
            console.log('✅ Connected to MongoDB');
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
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
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
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    DCAExecutorService.stopExecutor();
    process.exit(0);
});
startServer();
//# sourceMappingURL=server.js.map