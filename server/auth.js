const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class AuthService {
  // Регистрация
  static async register(username, email, password) {
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      throw new Error('Пользователь с таким email или логином уже существует');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    
    return this.generateToken(user);
  }
  
  // Авторизация
  static async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Неверный пароль');
    }
    
    return this.generateToken(user);
  }
  
  // Генерация токена
  static generateToken(user) {
    return jwt.sign(
      { userId: user._id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
  }
  
  // Верификация токена
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

module.exports = AuthService;
