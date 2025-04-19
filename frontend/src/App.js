import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Chat from './components/Chat';
import Login from './components/Login';
import Notification from './components/Notification';

function App() {
    const [user, setUser] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        // Проверяем сохраненные данные пользователя при загрузке
        const savedUserId = localStorage.getItem('userId');
        const savedNickname = localStorage.getItem('userNickname');
        
        if (savedUserId && savedNickname) {
            setUser({
                id: savedUserId,
                nickname: savedNickname
            });
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        navigate('/chat');
    };

    const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('userNickname');
        setUser(null);
        navigate('/');
    };

    const handleNewMessage = (message) => {
        // Проверяем, нет ли уже такого уведомления
        const isDuplicate = notifications.some(notif => 
            notif.id === message.id || 
            (notif.sender_id === message.sender_id && 
             notif.receiver_id === message.receiver_id && 
             notif.content === message.content && 
             notif.timestamp === message.timestamp)
        );

        if (!isDuplicate) {
            setNotifications(prev => [...prev, message]);
        }
    };

    const handleNotificationClose = (message) => {
        setNotifications(prev => prev.filter(notif => notif.id !== message.id));
    };

    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div>
            <div className="bg-blue-500 p-4 flex justify-between items-center">
                <h1 className="text-white text-xl font-bold">RSA Чат</h1>
                <div className="flex items-center space-x-4">
                    <span className="text-white">Пользователь: {user.nickname}</span>
                    <button
                        onClick={handleLogout}
                        className="bg-white text-blue-500 px-4 py-2 rounded hover:bg-gray-100"
                    >
                        Выйти
                    </button>
                </div>
            </div>
            <Routes>
                <Route 
                    path="/chat" 
                    element={
                        <Chat 
                            userId={user.id} 
                            nickname={user.nickname} 
                            onNewMessage={handleNewMessage}
                        />
                    } 
                />
                <Route 
                    path="/chat/:userId" 
                    element={
                        <Chat 
                            userId={user.id} 
                            nickname={user.nickname} 
                            onNewMessage={handleNewMessage}
                        />
                    } 
                />
            </Routes>
            {notifications.map((notification, index) => (
                <Notification
                    key={notification.id}
                    message={notification}
                    onClose={() => handleNotificationClose(notification)}
                    index={notifications.length - 1 - index}
                />
            ))}
        </div>
    );
}

export default App; 