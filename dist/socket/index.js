import { Server as SocketIOServer } from 'socket.io';
import { setupSocketEvents } from './events.js';
let io = null;
export const initializeSocket = (server) => {
    try {
        console.log('🔌 Initializing WebSocket server...');
        io = new SocketIOServer(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:5173",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });
        console.log('🔌 Socket.IO server created');
        // Temporarily skip authentication for testing
        // io.use(authenticateSocket);
        console.log('🔌 Authentication middleware skipped for testing');
        // Setup proper event handlers
        setupSocketEvents(io);
        console.log('🔌 Basic event handlers setup complete');
        console.log('🔌 WebSocket server initialized successfully');
        return io;
    }
    catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error);
        throw error;
    }
};
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};
export const closeSocket = () => {
    if (io) {
        io.close();
        io = null;
        console.log('🔌 WebSocket server closed');
    }
};
