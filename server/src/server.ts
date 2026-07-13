import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/api';
import { documentStore } from './utils/documentStore';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all requests (allows frontend port 5173 access)
app.use(cors());

// Parse incoming JSON and urlencoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
app.use('/api', apiRoutes);

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// Centralized error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Create HTTP server for WebSockets wrapping Express app
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from Vite frontend
    methods: ['GET', 'POST', 'DELETE'],
  },
});

interface ActiveUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; ch: number };
}

const activeUsers: Map<string, ActiveUser> = new Map();
const avatarColors = [
  '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
  '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6'
];

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Assign a random user identity initially
  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
  const tempUser: ActiveUser = {
    id: socket.id,
    name: `User-${socket.id.substring(0, 4)}`,
    color: randomColor,
  };
  activeUsers.set(socket.id, tempUser);

  // Send current document content and name to the client
  socket.emit('document-init', {
    content: documentStore.getEditorContent(),
    fileName: documentStore.getFileName(),
    users: Array.from(activeUsers.values()),
  });

  // Notify other clients about the new user
  io.emit('user-list-update', Array.from(activeUsers.values()));

  // Listen to user status profile updates (e.g. customized user name)
  socket.on('update-profile', (data: { name: string; color?: string }) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      user.name = data.name;
      if (data.color) user.color = data.color;
      activeUsers.set(socket.id, user);
      io.emit('user-list-update', Array.from(activeUsers.values()));
      console.log(`[Socket] User profile updated for ${socket.id}: ${user.name}`);
    }
  });

  // Client requests current document state
  socket.on('get-document', () => {
    socket.emit('document-update', {
      content: documentStore.getEditorContent(),
      fileName: documentStore.getFileName(),
    });
  });

  // Listen to live document edits from client
  socket.on('document-change', (data: { content: string; fileName?: string | null; source: string }) => {
    documentStore.updateEditorContent(data.content);
    if (data.fileName !== undefined) {
      if (data.fileName === null) {
        documentStore.clearStore();
      } else {
        documentStore.setDocument(data.fileName, data.content, documentStore.getFileBuffer(), documentStore.getMimeType());
      }
    }
    // Broadcast the change to all other connected clients
    socket.broadcast.emit('document-change', {
      content: data.content,
      fileName: data.fileName,
      senderId: socket.id,
    });
  });

  // Listen to cursor movement updates
  socket.on('cursor-move', (data: { line: number; ch: number } | undefined) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      user.cursor = data;
      activeUsers.set(socket.id, user);
      // Broadcast cursor update to other clients
      socket.broadcast.emit('cursor-update', {
        userId: socket.id,
        name: user.name,
        color: user.color,
        cursor: data,
      });
    }
  });

  // Client requests AI insertion (streaming or block insert)
  socket.on('insert-ai-text', (data: { text: string; position: { line: number; ch: number } }) => {
    io.emit('insert-ai-text-broadcast', {
      text: data.text,
      position: data.position,
      senderId: socket.id,
    });
  });

  // Listen to disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    activeUsers.delete(socket.id);
    io.emit('user-list-update', Array.from(activeUsers.values()));
    // Notify clients to clear cursor of disconnected user
    socket.broadcast.emit('cursor-update', {
      userId: socket.id,
      cursor: undefined,
    });
  });
});

server.listen(PORT, () => {
  console.log(`[Server] running on http://localhost:${PORT}`);
  console.log(`[Server] AI model provider set to: ${process.env.AI_PROVIDER || 'gemini'}`);
});

