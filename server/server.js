const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Store rooms data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        videoUrl: '',
        playerState: { isPlaying: false, currentTime: 0 }
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(socket.id, username);
    
    // Send current room state to new user
    socket.emit('room-state', room.playerState, room.videoUrl);
    
    // Notify others
    socket.to(roomId).emit('user-joined', username);
    
    console.log(`User ${username} joined room ${roomId}`);
  });

  // Video control events
  socket.on('play', (currentTime) => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      room.playerState = { isPlaying: true, currentTime };
      socket.to(socket.roomId).emit('play', currentTime);
    }
  });

  socket.on('pause', (currentTime) => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      room.playerState = { isPlaying: false, currentTime };
      socket.to(socket.roomId).emit('pause', currentTime);
    }
  });

  socket.on('seek', (currentTime) => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      room.playerState.currentTime = currentTime;
      socket.to(socket.roomId).emit('seek', currentTime);
    }
  });

  socket.on('change-video', (videoUrl) => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      room.videoUrl = videoUrl;
      room.playerState = { isPlaying: false, currentTime: 0 };
      io.to(socket.roomId).emit('video-changed', videoUrl);
    }
  });

  // Chat events
  socket.on('send-message', (message, username) => {
    if (socket.roomId) {
      io.to(socket.roomId).emit('new-message', {
        username,
        message,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      const username = room.users.get(socket.id);
      room.users.delete(socket.id);
      
      socket.to(socket.roomId).emit('user-left', username);
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(socket.roomId);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});