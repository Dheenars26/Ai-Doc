"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const api_1 = __importDefault(require("./routes/api"));
const documentStore_1 = require("./utils/documentStore");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Enable CORS for all requests (allows frontend port 5173 access)
app.use((0, cors_1.default)());
// Parse incoming JSON and urlencoded requests
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Register routes
app.use('/api', api_1.default);
// Simple health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date() });
});
// Centralized error handler middleware
app.use((err, req, res, next) => {
    console.error('[Unhandled Server Error]:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});
// Create HTTP server for WebSockets wrapping Express app
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow connections from Vite frontend
        methods: ['GET', 'POST', 'DELETE'],
    },
});
const activeUsers = new Map();
const avatarColors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
    '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6'
];
io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    // Assign a random user identity initially
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const tempUser = {
        id: socket.id,
        name: `User-${socket.id.substring(0, 4)}`,
        color: randomColor,
    };
    activeUsers.set(socket.id, tempUser);
    // Send current document content and name to the client
    socket.emit('document-init', {
        content: documentStore_1.documentStore.getEditorContent(),
        fileName: documentStore_1.documentStore.getFileName(),
        users: Array.from(activeUsers.values()),
    });
    // Notify other clients about the new user
    io.emit('user-list-update', Array.from(activeUsers.values()));
    // Listen to user status profile updates (e.g. customized user name)
    socket.on('update-profile', (data) => {
        const user = activeUsers.get(socket.id);
        if (user) {
            user.name = data.name;
            if (data.color)
                user.color = data.color;
            activeUsers.set(socket.id, user);
            io.emit('user-list-update', Array.from(activeUsers.values()));
            console.log(`[Socket] User profile updated for ${socket.id}: ${user.name}`);
        }
    });
    // Client requests current document state
    socket.on('get-document', () => {
        socket.emit('document-update', {
            content: documentStore_1.documentStore.getEditorContent(),
            fileName: documentStore_1.documentStore.getFileName(),
        });
    });
    // Listen to live document edits from client
    socket.on('document-change', (data) => {
        documentStore_1.documentStore.updateEditorContent(data.content);
        if (data.fileName !== undefined) {
            if (data.fileName === null) {
                documentStore_1.documentStore.clearStore();
            }
            else {
                documentStore_1.documentStore.setDocument(data.fileName, data.content, documentStore_1.documentStore.getFileBuffer(), documentStore_1.documentStore.getMimeType());
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
    socket.on('cursor-move', (data) => {
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
    socket.on('insert-ai-text', (data) => {
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
