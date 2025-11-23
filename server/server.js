import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('client'));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Routes for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dashboard.html'));
});

// Mock data storage
let users = [];
let rooms = [
  {
    _id: '1',
    name: 'Киновечер с друзьями',
    description: 'Смотрим новые фильмы',
    users: ['user1', 'user2'],
    owner: { username: 'Admin' },
    createdAt: new Date(),
    isPublic: true
  },
  {
    _id: '2', 
    name: 'Аниме марафон',
    description: 'Смотрим лучшие аниме',
    users: ['user3'],
    owner: { username: 'User' },
    createdAt: new Date(),
    isPublic: true
  }
];

// === AUTH API ROUTES ===
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('Registration attempt:', { username, email });
    
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Все поля обязательны для заполнения' 
      });
    }
    
    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'Пользователь с таким email уже существует' 
      });
    }
    
    // Create new user
    const user = {
      id: 'user-' + Date.now(),
      username,
      email,
      password, // In real app, hash this!
      createdAt: new Date()
    };
    
    users.push(user);
    
    console.log('User registered successfully:', user.id);
    
    res.json({
      success: true,
      message: 'Регистрация успешна',
      token: 'user-token-' + user.id,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt:', { email });
    
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'Неверный email или пароль' 
      });
    }
    
    console.log('User logged in successfully:', user.id);
    
    res.json({
      success: true,
      message: 'Вход успешен',
      token: 'user-token-' + user.id,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Не авторизован' 
      });
    }
    
    const userId = token.replace('user-token-', '');
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Пользователь не найден' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// === ROOMS API ROUTES ===
app.get('/api/rooms', (req, res) => {
  try {
    const publicRooms = rooms.filter(room => room.isPublic);
    res.json(publicRooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Ошибка загрузки комнат' });
  }
});

app.get('/api/rooms/active', (req, res) => {
  try {
    const activeRooms = rooms.filter(room => room.isPublic && room.users.length > 0);
    res.json(activeRooms);
  } catch (error) {
    console.error('Get active rooms error:', error);
    res.status(500).json({ error: 'Ошибка загрузки активных комнат' });
  }
});

app.post('/api/rooms/create', (req, res) => {
  try {
    const { name, description, isPublic = true } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const userId = token.replace('user-token-', '');
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Название комнаты обязательно' });
    }
    
    const newRoom = {
      _id: 'room-' + Date.now(),
      name,
      description: description || '',
      users: [userId],
      owner: { username: user.username },
      createdAt: new Date(),
      isPublic
    };
    
    rooms.push(newRoom);
    
    console.log('Room created:', newRoom._id);
    
    res.json({
      success: true,
      room: newRoom
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Ошибка создания комнаты' });
  }
});

app.get('/api/rooms/my', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const userId = token.replace('user-token-', '');
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    const myRooms = rooms.filter(room => room.owner.username === user.username);
    
    res.json(myRooms);
  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({ error: 'Ошибка загрузки ваших комнат' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('play-video', (data) => {
    socket.to(data.roomId).emit('video-play', data);
  });

  socket.on('pause-video', (data) => {
    socket.to(data.roomId).emit('video-pause', data);
  });

  socket.on('seek-video', (data) => {
    socket.to(data.roomId).emit('video-seek', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Auth endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/auth/me`);
  console.log(`🏠 Visit: http://localhost:${PORT}`);
});
