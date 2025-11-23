// client/client.js
const API_URL = window.location.origin;
let socket = null;
let currentRoom = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Проверка авторизации для защищенных страниц
    if (window.location.pathname === '/dashboard') {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return;
        }
        loadUserData();
    }

    // Инициализация видео плеера
    initializeVideoPlayer();
    
    // Инициализация комнат
    initializeRooms();
}

// Инициализация видео плеера
function initializeVideoPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const seekBar = document.getElementById('seekBar');
    
    if (!videoPlayer) return;

    // События видео
    videoPlayer.addEventListener('play', () => {
        if (socket && currentRoom) {
            socket.emit('play-video', {
                roomId: currentRoom,
                timestamp: videoPlayer.currentTime
            });
        }
    });

    videoPlayer.addEventListener('pause', () => {
        if (socket && currentRoom) {
            socket.emit('pause-video', {
                roomId: currentRoom,
                timestamp: videoPlayer.currentTime
            });
        }
    });

    videoPlayer.addEventListener('seeked', () => {
        if (socket && currentRoom) {
            socket.emit('seek-video', {
                roomId: currentRoom,
                timestamp: videoPlayer.currentTime
            });
        }
    });

    // Кнопки управления
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            videoPlayer.play();
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            videoPlayer.pause();
        });
    }

    if (seekBar) {
        videoPlayer.addEventListener('timeupdate', () => {
            seekBar.value = videoPlayer.currentTime;
        });

        seekBar.addEventListener('input', () => {
            videoPlayer.currentTime = seekBar.value;
        });
    }
}

// Инициализация комнат
function initializeRooms() {
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const roomInput = document.getElementById('roomInput');

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createRoom);
    }

    if (joinRoomBtn && roomInput) {
        joinRoomBtn.addEventListener('click', () => {
            const roomId = roomInput.value.trim();
            if (roomId) {
                joinRoom(roomId);
            }
        });
    }
}

// Создание комнаты
function createRoom() {
    const roomId = generateRoomId();
    joinRoom(roomId);
    showMessage(`Комната создана: ${roomId}`);
}

// Присоединение к комнате
function joinRoom(roomId) {
    if (socket) {
        socket.disconnect();
    }

    // Подключение к Socket.io
    socket = io(API_URL);
    currentRoom = roomId;

    socket.emit('join-room', roomId);

    socket.on('user-joined', (userId) => {
        showMessage(`Пользователь присоединился: ${userId}`);
    });

    socket.on('video-play', (data) => {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer && Math.abs(videoPlayer.currentTime - data.timestamp) > 2) {
            videoPlayer.currentTime = data.timestamp;
            videoPlayer.play();
        }
    });

    socket.on('video-pause', (data) => {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer) {
            videoPlayer.currentTime = data.timestamp;
            videoPlayer.pause();
        }
    });

    socket.on('video-seek', (data) => {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer && Math.abs(videoPlayer.currentTime - data.timestamp) > 2) {
            videoPlayer.currentTime = data.timestamp;
        }
    });

    updateRoomUI(roomId);
}

// Обновление интерфейса комнаты
function updateRoomUI(roomId) {
    const roomInfo = document.getElementById('roomInfo');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    
    if (roomInfo) roomInfo.style.display = 'block';
    if (roomIdDisplay) roomIdDisplay.textContent = roomId;
    
    // Показать кнопку для приглашения
    const inviteBtn = document.getElementById('inviteBtn');
    if (inviteBtn) {
        inviteBtn.style.display = 'block';
        inviteBtn.onclick = () => {
            navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
            showMessage('Ссылка скопирована в буфер обмена');
        };
    }
}

// Загрузка данных пользователя
async function loadUserData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            const usernameDisplay = document.getElementById('usernameDisplay');
            if (usernameDisplay) {
                usernameDisplay.textContent = userData.username;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// Выход
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}

// Вспомогательные функции
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showMessage(message, isError = false) {
    // Создаем или находим элемент для сообщений
    let messageDiv = document.getElementById('message');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'message';
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            display: none;
        `;
        document.body.appendChild(messageDiv);
    }

    messageDiv.textContent = message;
    messageDiv.style.backgroundColor = isError ? '#e74c3c' : '#2ecc71';
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Глобальные функции
window.logout = logout;
