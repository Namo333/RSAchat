import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';

const Login = ({ onLogin }) => {
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Проверяем сохраненный никнейм при загрузке
        const savedNickname = localStorage.getItem('userNickname');
        if (savedNickname) {
            handleLogin(savedNickname);
        }
    }, []);

    const handleLogin = async (nicknameToUse) => {
        setIsLoading(true);
        setError('');

        try {
            // Проверяем, существует ли пользователь
            const response = await fetch(API_ENDPOINTS.USER_BY_NICKNAME(nicknameToUse));
            
            if (response.ok) {
                // Пользователь существует, получаем его данные
                const userData = await response.json();
                localStorage.setItem('userNickname', nicknameToUse);
                localStorage.setItem('userId', userData.id);
                onLogin(userData);
            } else {
                // Пользователь не существует, создаем нового
                const createResponse = await fetch(API_ENDPOINTS.USER_CREATE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ nickname: nicknameToUse }),
                });

                if (!createResponse.ok) {
                    const errorData = await createResponse.json();
                    throw new Error(errorData.detail || 'Не удалось создать пользователя');
                }

                const newUser = await createResponse.json();
                localStorage.setItem('userNickname', nicknameToUse);
                localStorage.setItem('userId', newUser.id);
                onLogin(newUser);
            }
        } catch (error) {
            console.error('Ошибка при входе:', error);
            setError(error.message || 'Произошла ошибка при входе в систему');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (nickname.trim()) {
            handleLogin(nickname.trim());
        } else {
            setError('Введите никнейм');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center">Вход в чат</h2>
                
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Никнейм
                        </label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => {
                                setNickname(e.target.value);
                                setError('');
                            }}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Введите ваш никнейм"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`w-full bg-blue-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                        }`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Вход...' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login; 