import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import Login from './components/Login';

function App() {
    const [user, setUser] = useState(null);

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
    };

    const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('userNickname');
        setUser(null);
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
            <Chat userId={user.id} nickname={user.nickname} />
        </div>
    );
}

export default App; 