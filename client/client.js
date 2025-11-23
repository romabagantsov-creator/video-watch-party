// client/client.js
const API_URL = window.location.origin;
let socket = null;
let currentRoom = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Обновление информации о пользователе в навигации
    updateUserNavigation();
    
    // Инициализация конкретных страниц
    if (window.location.pathname === '/dashboard') {
        initializeDashboard();
    } else if (window.location.pathname === '/') {
        initializeHomepage();
    }
    
    // Инициализация видео плеера (если есть на странице)
    initializeVideoPlayer();
    
    // Инициализация комнат (если есть на странице)
    initializeRooms();
}

// Обновление навигации
function updateUserNavigation() {
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userName = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (user && usernameDisplay) {
        usernameDisplay.textContent = user.username;
    }
    
    if (user && userName) {
        userName.textContent = user.username;
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        });
    }
}

// Инициализация главной страницы
function initializeHomepage() {
    loadRooms();
}

// Инициализация дашборда
function initializeDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    loadMyRooms();
    loadActiveRooms();
    loadStats();
    initializeRoomCreation();
    loadUserData();
}

// Загрузка комнат для главной страницы
async function loadRooms() {
    try {
        const response = await fetch(`${API_URL}/api/rooms`);
        const rooms = await response.json();
        
        const roomsList = document.getElementById('roomsList');
        if (!roomsList) return;
        
        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div style="text-align: center; grid-column: 1 / -1; color: #888; padding: 2rem;">
                    Пока нет активных комнат. 
                    <a href="/register" style="color: #4ecdc4;">Создайте первую!</a>
                </div>
            `;
            return;
        }
        
        roomsList.innerHTML = rooms.map(room => `
            <div class="room-card">
                <div class="room-header">
                    <h3>${room.name}</h3>
                    <div class="room-users">👥 ${room.users.length}</div>
                </div>
                <p style="color: #ccc; margin-bottom: 1rem;">${room.description || 'Присоединяйтесь к просмотру!'}</p>
                <a href="/room.html?room=${room._id}" class="btn btn-primary" style="display: block; text-align: center;">
                    Присоединиться
                </a>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки комнат:', error);
    }
}

// Загрузка моих комнат
async function loadMyRooms() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/rooms/my`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        const myRoomsList = document.getElementById('myRoomsList');
        const roomsCount = document.getElementById('roomsCount');
        
        if (!myRoomsList) return;
        
        if (!data || data.length === 0) {
            myRoomsList.innerHTML = `
                <div class="empty-state">
                    <div>🎬</div>
                    <p>У вас пока нет комнат</p>
                    <p class="text-muted">Создайте первую комнату выше</p>
                </div>
            `;
            if (roomsCount) roomsCount.textContent = '0';
            return;
        }
        
        myRoomsList.innerHTML = data.map(room => `
            <div class="room-item">
                <div class="room-info">
                    <h4>${room.name}</h4>
                    <p class="text-muted">${room.description || 'Без описания'}</p>
                    <div class="room-meta">
                        <span>👥 ${room.users.length} участников</span>
                        <span>${new Date(room.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="room-actions">
                    <a href="/room.html?room=${room._id}" class="btn btn-primary btn-small">
                        Открыть
                    </a>
                </div>
            </div>
        `).join('');
        
        if (roomsCount) roomsCount.textContent = data.length;
        
    } catch (error) {
        console.error('Ошибка загрузки комнат:', error);
    }
}

// Загрузка активных комнат
async function loadActiveRooms() {
    try {
        const response = await fetch(`${API_URL}/api/rooms/active`);
        const rooms = await response.json();
        
        const activeRoomsList = document.getElementById('activeRoomsList');
        if (!activeRoomsList) return;
        
        if (rooms.length === 0) {
            activeRoomsList.innerHTML = `
                <div class="empty-state">
                    <div>😴</div>
                    <p>Нет активных комнат</p>
                    <p class="text-muted">Будьте первым, кто создаст комнату!</p>
                </div>
            `;
            return;
        }
        
        activeRoomsList.innerHTML = rooms.map(room => `
            <div class="room-item">
                <div class="room-info">
                    <h4>${room.name}</h4>
                    <p class="text-muted">${room.description || 'Присоединяйтесь к просмотру!'}</p>
                    <div class="room-meta">
                        <span>👥 ${room.users.length} участников</span>
                        <span>Создал: ${room.owner?.username || 'Неизвестно'}</span>
                    </div>
                </div>
                <div class="room-actions">
                    <a href="/room.html?room=${room._id}" class="btn btn-primary btn-small">
                        Присоединиться
                    </a>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки активных комнат:', error);
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

        const data = await response.json();
        
        if (response.ok && data.success) {
            const usernameDisplay = document.getElementById('usernameDisplay');
            const userName = document.getElementById('userName');
            
            if (usernameDisplay) {
                usernameDisplay.textContent = data.user.username;
            }
            if (userName) {
                userName.textContent = data.user.username;
            }
            
            // Сохраняем актуальные данные пользователя
            localStorage.setItem('user', JSON.stringify(data.user));
        } else {
            console.error('Ошибка загрузки пользователя:', data.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// Инициализация создания комнаты
function initializeRoomCreation() {
    const createRoomForm = document.getElementById('createRoomForm');
    if (!createRoomForm) return;
    
    createRoomForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const roomName = document.getElementById('roomName').value;
        const roomDescription = document.getElementById('roomDescription').value;
        const isPublic = document.getElementById('isPublic').checked;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/rooms/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: roomName,
                    description: roomDescription,
                    isPublic: isPublic
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showMessage('Комната создана успешно!');
                createRoomForm.reset();
                loadMyRooms();
                loadActiveRooms();
            } else {
                showMessage(data.error || 'Ошибка создания комнаты', true);
            }
        } catch (error) {
            showMessage('Ошибка соединения', true);
        }
    });
}

// Загрузка статистики
async function loadStats() {
    // Заглушка для статистики
    const totalUsers = document.getElementById('totalUsers');
    const watchTime = document.getElementById('watchTime');
    
    if (totalUsers) totalUsers.textContent = '12';
    if (watchTime) watchTime.textContent = '5ч';
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
            seekBar.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        });

        seekBar.addEventListener('input', () => {
            videoPlayer.currentTime = (seekBar.value / 100) * videoPlayer.duration;
        });
    }
}

// Инициализация комнат (для страницы с видео)
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
window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
};
