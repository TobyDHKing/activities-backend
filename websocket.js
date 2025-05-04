import { Server } from "socket.io";
import {authMiddleware, JWT_SECRET} from "./index.js";
import jwt from "jsonwebtoken";

export const userSockets = new Map(); // Store connected users

export default function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            methods: ["GET", "POST"]
        }
    });

    // Middleware for authenticating sockets
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }

        try {
            const verified = jwt.verify(token, JWT_SECRET);
            socket.user = verified; // Attach user info to the socket
            next();
        } catch (err) {
            console.error("Authentication error:", err.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log("New user connected", socket.id, "User:", socket.user);
        socket.on("disconnect", () => {
            console.log("User disconnected", socket.id);
        });
        userSockets.set(socket.id, socket.user); // Store user info in the map
        // socket.on("message", (data) => {
        //     io.to(data.room).emit("message", data);
        //     console.log(`Message sent to room ${data.room}: ${data.message}`);
        // });

    });
    io.on("disconnect", (socket) => {
        console.log("User disconnected", socket.id);
        userSockets.delete(socket.id); // Remove user info from the map
    });
    
    return io;
}

export function sendMessageToUser(userId, message, chatId) {
    // This function can be used to send a message to a specific user
    const socket = Array.from(io.sockets.sockets.values()).find(s => s.user.id === userId);
    if (socket) {
        socket.emit("message", { message, chatId });
    } else {
        console.log(`User ${userId} is not connected`);
    }
}

