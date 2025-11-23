// client/auth.js
const API_URL = window.location.origin;

// Элементы формы
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

// Функция для показа уведомлений
function showMessage(message, isError = false) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = isError ? 'red' : 'green';
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

// Регистрация
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value
        };

        if (formData.password !== formData.confirmPassword) {
            showMessage('Пароли не совпадают', true);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Регистрация успешна! Перенаправление...');
                localStorage.setItem('token', data.token);
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                showMessage(data.message || 'Ошибка регистрации', true);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showMessage('Ошибка соединения с сервером', true);
        }
    });
}

// Логин
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        };

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Вход успешен! Перенаправление...');
                localStorage.setItem('token', data.token);
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                showMessage(data.message || 'Ошибка входа', true);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showMessage('Ошибка соединения с сервером', true);
        }
    });
}

// Проверка авторизации
export function checkAuth() {
    return localStorage.getItem('token');
}

// Выход
export function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}
