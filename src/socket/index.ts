import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticateSocket } from './auth.js';
import { setupSocketEvents } from './events.js';

let io: SocketIOServer | null = null;

export const initializeSocket = (server: HTTPServer) => {
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

    // Setup basic event handlers
    io.on('connection', (socket) => {
      console.log('🔌 Client connected (no auth)');
      
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected');
      });
      
      socket.on('test', (data) => {
        console.log('🔌 Test event received:', data);
        socket.emit('test-response', { message: 'WebSocket is working!' });
      });
    });
    
    console.log('🔌 Basic event handlers setup complete');

    console.log('🔌 WebSocket server initialized successfully');
    return io;
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket server:', error);
    throw error;
  }
};

export const getIO = (): SocketIOServer => {
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