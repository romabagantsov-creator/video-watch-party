const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../client')));

// Конфигурация
const JWT_SECRET = process.env.JWT_SECRET || 'video-party-secret-key-2024';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/videoparty';

// Подключение к MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Схемы MongoDB
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: true },
  password: { type: String, default: '' },
  currentVideo: { type: String, default: '' },
  users: [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Message = mongoose.model('Message', messageSchema);

// Store active rooms for real-time (временное хранилище)
const activeRooms = new Map();

// Middleware для аутентификации
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Неверный токен' });
  }
};

// API Routes

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // Проверка существующего пользователя
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Пользователь с таким email или логином уже существует' 
      });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Генерация токена
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Ответ
    res.json({
      message: 'Пользователь успешно зарегистрирован',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Авторизация
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Поиск пользователя
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Пользователь с таким email не найден' });
    }

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Неверный пароль' });
    }

    // Генерация токена
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Ответ
    res.json({
      message: 'Успешный вход',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// Получение профиля пользователя
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      createdAt: req.user.createdAt
    }
  });
});

// API для комнат

// Создание комнаты
app.post('/api/rooms/create', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPublic = true, password = '' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название комнаты обязательно' });
    }

    const room = new Room({
      name,
      description,
      owner: req.user._id,
      isPublic,
      password,
      users: [{ user: req.user._id }]
    });

    await room.save();

    // Добавляем в активные комнаты
    activeRooms.set(room._id.toString(), {
      roomId: room._id.toString(),
      users: new Map(),
      videoUrl: '',
      playerState: { isPlaying: false, currentTime: 0 }
    });

    res.json({
      message: 'Комната успешно создана',
      room: {
        id: room._id,
        name: room.name,
        description: room.description,
        isPublic: room.isPublic,
        createdAt: room.createdAt
      }
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Ошибка при создании комнаты' });
  }
});

// Получение моих комнат
app.get('/api/rooms/my', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user._id })
      .populate('users.user', 'username')
      .sort({ createdAt: -1 });

    res.json(rooms.map(room => ({
      _id: room._id,
      name: room.name,
      description: room.description,
      isPublic: room.isPublic,
      users: room.users,
      createdAt: room.createdAt
    })));

  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({ error: 'Ошибка при получении комнат' });
  }
});

// Получение активных публичных комнат
app.get('/api/rooms/active', async (req, res) => {
  try {
    const rooms = await Room.find({ isPublic: true })
      .populate('owner', 'username')
      .populate('users.user', 'username')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(rooms.map(room => ({
      _id: room._id,
      name: room.name,
      description: room.description,
      owner: room.owner,
      users: room.users,
      userCount: room.users.length,
      createdAt: room.createdAt
    })));

  } catch (error) {
    console.error('Get active rooms error:', error);
    res.status(500).json({ error: 'Ошибка при получении комнат' });
  }
});

// Получение всех комнат (для главной страницы)
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({ isPublic: true })
      .populate('owner', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(rooms.map(room => ({
      _id: room._id,
      name: room.name,
      description: room.description,
      owner: room.owner,
      users: room.users,
      userCount: room.users.length,
      createdAt: room.createdAt
    })));

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Ошибка при получении комнат' });
  }
});

// Получение информации о конкретной комнате
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('owner', 'username')
      .populate('users.user', 'username');

    if (!room) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    res.json({
      _id: room._id,
      name: room.name,
      description: room.description,
      owner: room.owner,
      users: room.users,
      isPublic: room.isPublic,
      currentVideo: room.currentVideo,
      createdAt: room.createdAt
    });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Ошибка при получении комнаты' });
  }
});

// Socket.io для реального времени
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Присоединение к комнате
  socket.on('join-room', async (roomId, username, userId) => {
    try {
      socket.join(roomId);
      socket.roomId = roomId;
      
      // Получаем информацию о комнате из базы
      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      // Добавляем пользователя в комнату в базе
      const userExists = room.users.some(u => u.user.toString() === userId);
      if (!userExists && userId) {
        room.users.push({ user: userId });
        await room.save();
      }

      // Инициализируем комнату в активных, если её нет
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, {
          roomId: roomId,
          users: new Map(),
          videoUrl: room.currentVideo || '',
          playerState: { isPlaying: false, currentTime: 0 }
        });
      }

      const activeRoom = activeRooms.get(roomId);
      activeRoom.users.set(socket.id, { username, userId });
      
      // Отправляем текущее состояние комнаты новому пользователю
      socket.emit('room-state', activeRoom.playerState, activeRoom.videoUrl);
      
      // Уведомляем других участников
      socket.to(roomId).emit('user-joined', username);
      
      // Обновляем список пользователей
      updateUserList(roomId);
      
      console.log(`User ${username} joined room ${roomId}`);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', 'Ошибка присоединения к комнате');
    }
  });

  // События управления видео
  socket.on('play', (currentTime) => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      const room = activeRooms.get(socket.roomId);
      room.playerState = { isPlaying: true, currentTime };
      socket.to(socket.roomId).emit('play', currentTime);
    }
  });

  socket.on('pause', (currentTime) => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      const room = activeRooms.get(socket.roomId);
      room.playerState = { isPlaying: false, currentTime };
      socket.to(socket.roomId).emit('pause', currentTime);
    }
  });

  socket.on('seek', (currentTime) => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      const room = activeRooms.get(socket.roomId);
      room.playerState.currentTime = currentTime;
      socket.to(socket.roomId).emit('seek', currentTime);
    }
  });

  socket.on('change-video', async (videoUrl) => {
    if (socket.roomId) {
      const activeRoom = activeRooms.get(socket.roomId);
      if (activeRoom) {
        activeRoom.videoUrl = videoUrl;
        activeRoom.playerState = { isPlaying: false, currentTime: 0 };
        
        // Сохраняем в базу
        await Room.findByIdAndUpdate(socket.roomId, { currentVideo: videoUrl });
        
        io.to(socket.roomId).emit('video-changed', videoUrl);
      }
    }
  });

  // События чата
  socket.on('send-message', async (message, username, userId) => {
    if (socket.roomId) {
      try {
        // Сохраняем сообщение в базу
        const chatMessage = new Message({
          room: socket.roomId,
          user: userId,
          text: message
        });
        await chatMessage.save();

        // Отправляем всем участникам
        io.to(socket.roomId).emit('new-message', {
          username,
          message,
          userId,
          timestamp: new Date().toLocaleTimeString()
        });

      } catch (error) {
        console.error('Save message error:', error);
      }
    }
  });

  // Отключение
  socket.on('disconnect', async () => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      const room = activeRooms.get(socket.roomId);
      const userInfo = room.users.get(socket.id);
      
      if (userInfo) {
        room.users.delete(socket.id);
        socket.to(socket.roomId).emit('user-left', userInfo.username);
        updateUserList(socket.roomId);
        
        // Если комната пустая, удаляем её из активных через некоторое время
        if (room.users.size === 0) {
          setTimeout(() => {
            if (activeRooms.get(socket.roomId)?.users.size === 0) {
              activeRooms.delete(socket.roomId);
            }
          }, 300000); // 5 минут
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });

  // Функция обновления списка пользователей
  function updateUserList(roomId) {
    const room = activeRooms.get(roomId);
    if (room) {
      const users = Array.from(room.users.values()).map(u => u.username);
      io.to(roomId).emit('user-list-update', users);
    }
  }
});

// Запасной маршрут для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 MongoDB: ${MONGODB_URI}`);
});
