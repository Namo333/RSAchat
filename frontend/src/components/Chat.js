import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { encryptMessage, decryptMessage } from '../utils/rsa';
import { API_ENDPOINTS } from '../config';

const Chat = ({ userId, nickname, onNewMessage }) => {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [showKeys, setShowKeys] = useState(false);
    const [chatHistory, setChatHistory] = useState({}); // История чатов для каждого пользователя
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);
    const { userId: routeUserId } = useParams();
    const navigate = useNavigate();

    const { sendMessage, lastMessage, isConnected, error: wsError } = useWebSocket(API_ENDPOINTS.WS(userId));

    // Загрузка сохраненного состояния при монтировании
    useEffect(() => {
        const savedState = localStorage.getItem(`chatState_${userId}`);
        if (savedState) {
            const { selectedUser: savedUser, chatHistory: savedHistory } = JSON.parse(savedState);
            setSelectedUser(savedUser);
            setChatHistory(savedHistory);
        }
    }, [userId]);

    // Сохранение состояния при изменении
    useEffect(() => {
        localStorage.setItem(`chatState_${userId}`, JSON.stringify({
            selectedUser,
            chatHistory
        }));
    }, [userId, selectedUser, chatHistory]);

    // Set selected user from route parameter
    useEffect(() => {
        if (routeUserId) {
            setSelectedUser(parseInt(routeUserId));
        }
    }, [routeUserId]);

    const fetchUsersAndKeys = async () => {
        try {
            const usersResponse = await fetch(API_ENDPOINTS.USERS);
            const usersData = await usersResponse.json();
            
            const currentUserResponse = await fetch(API_ENDPOINTS.USER_BY_ID(userId));
            const currentUserData = await currentUserResponse.json();
            
            const otherUsers = usersData.filter(user => user.id !== userId);
            
            const usersWithKeys = await Promise.all(
                otherUsers.map(async (user) => {
                    try {
                        const userResponse = await fetch(API_ENDPOINTS.USER_BY_ID(user.id));
                        const userData = await userResponse.json();
                        return {
                            ...user,
                            public_key: userData.public_key
                        };
                    } catch (error) {
                        console.error(`Ошибка загрузки данных пользователя ${user.id}:`, error);
                        return {
                            ...user,
                            public_key: null
                        };
                    }
                })
            );
            
            setUsers(usersWithKeys);
            setPublicKey(currentUserData.public_key);
            setPrivateKey(currentUserData.private_key);
        } catch (error) {
            console.error('Ошибка загрузки пользователей и ключей:', error);
            setError('Не удалось загрузить данные пользователей');
        }
    };

    useEffect(() => {
        fetchUsersAndKeys();
    }, [userId]);

    useEffect(() => {
        // Загружаем историю сообщений при монтировании или смене выбранного пользователя
        const loadMessageHistory = async () => {
            try {
                const response = await fetch(API_ENDPOINTS.MESSAGES(userId));
                if (response.ok) {
                    const messages = await response.json();
                    // Фильтруем сообщения для текущего чата (между текущим пользователем и выбранным)
                    const filteredMessages = messages
                        .filter(m => 
                            (m.sender_id === userId && m.receiver_id === selectedUser) ||
                            (m.sender_id === selectedUser && m.receiver_id === userId)
                        )
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    setMessages(filteredMessages);
                    
                    // Обновляем историю чатов
                    const newChatHistory = {};
                    messages.forEach(message => {
                        const chatId = message.sender_id === userId ? message.receiver_id : message.sender_id;
                        const sender = users.find(u => u.id === message.sender_id);
                        
                        if (!newChatHistory[chatId] || new Date(message.timestamp) > new Date(newChatHistory[chatId].lastTimestamp)) {
                            newChatHistory[chatId] = {
                                lastEncrypted: message.encrypted_content,
                                lastDecrypted: message.content,
                                lastSender: sender ? sender.nickname : 'Неизвестный отправитель',
                                lastTimestamp: message.timestamp
                            };
                        }
                    });
                    
                    setChatHistory(newChatHistory);
                }
            } catch (error) {
                console.error('Ошибка при загрузке истории сообщений:', error);
            }
        };

        if (selectedUser) {
            loadMessageHistory();
        } else {
            setMessages([]); // Очищаем сообщения, если никто не выбран
        }
    }, [userId, users, selectedUser]);

    useEffect(() => {
        if (lastMessage) {
            const messageData = JSON.parse(lastMessage);
            if (messageData.type === 'message') {
                const newMessage = messageData.data;
                
                // Добавляем сообщение в чат, если оно относится к текущему диалогу
                if ((newMessage.sender_id === parseInt(userId) && newMessage.receiver_id === selectedUser) ||
                    (newMessage.sender_id === selectedUser && newMessage.receiver_id === parseInt(userId))) {
                    
                    setMessages(prev => {
                        // Проверяем, нет ли уже такого сообщения
                        const isDuplicate = prev.some(msg => 
                            msg.id === newMessage.id || 
                            (msg.sender_id === newMessage.sender_id && 
                             msg.receiver_id === newMessage.receiver_id && 
                             msg.content === newMessage.content && 
                             msg.timestamp === newMessage.timestamp)
                        );
                        
                        if (isDuplicate) {
                            return prev;
                        }
                        
                        return [...prev, newMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    });
                }
                
                // Показываем уведомление только если сообщение адресовано текущему пользователю
                // и не от текущего выбранного пользователя
                if (newMessage.receiver_id === parseInt(userId) && newMessage.sender_id !== selectedUser) {
                    const sender = users.find(u => u.id === newMessage.sender_id);
                    if (sender) {
                        // Проверяем, не было ли уже такого сообщения в истории
                        const isNewMessage = !messages.some(msg => msg.id === newMessage.id);

                        if (isNewMessage) {
                            onNewMessage({
                                ...newMessage,
                                sender_nickname: sender.nickname
                            });
                        }
                    }
                }
                
                // Обновляем историю чата
                setChatHistory(prev => {
                    const chatId = newMessage.sender_id === parseInt(userId) ? newMessage.receiver_id : newMessage.sender_id;
                    const sender = users.find(u => u.id === newMessage.sender_id);
                    return {
                        ...prev,
                        [chatId]: {
                            ...prev[chatId],
                            lastEncrypted: newMessage.encrypted_content,
                            lastDecrypted: newMessage.content,
                            lastSender: sender ? sender.nickname : 'Неизвестный отправитель',
                            lastTimestamp: newMessage.timestamp
                        }
                    };
                });
            }
        }
    }, [lastMessage, userId, users, selectedUser, onNewMessage, messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) {
            setError('Сообщение не может быть пустым');
            return;
        }

        setError('');

        try {
            if (!selectedUser) {
                setError('Пожалуйста, выберите получателя');
                return;
            }

            const receiver = users.find(u => u.id === selectedUser);
            if (!receiver) {
                setError('Получатель не найден');
                return;
            }

            if (!receiver.public_key) {
                setError('У получателя нет публичного ключа. Сообщение не может быть зашифровано.');
                return;
            }

            const encryptedContent = await encryptMessage(newMessage, receiver.public_key);
            
            // Обновляем историю чата для текущего пользователя
            setChatHistory(prev => ({
                ...prev,
                [selectedUser]: {
                    ...prev[selectedUser],
                    lastEncrypted: encryptedContent,
                    lastDecrypted: newMessage
                }
            }));

            const messageData = {
                content: newMessage,
                encrypted_content: encryptedContent,
                receiver_id: selectedUser,
                sender_id: userId
            };

            sendMessage(JSON.stringify(messageData));
            setNewMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            setError('Произошла ошибка при отправке сообщения');
        }
    };

    const handleDecryptMessage = async (message) => {
        try {
            if (!privateKey) {
                setError('У вас нет приватного ключа для расшифровки');
                return 'Не удалось расшифровать сообщение';
            }

            const decrypted = await decryptMessage(message.encrypted_content, privateKey);
            
            // Обновляем историю чата для текущего пользователя
            setChatHistory(prev => ({
                ...prev,
                [message.sender_id]: {
                    ...prev[message.sender_id],
                    lastEncrypted: message.encrypted_content,
                    lastDecrypted: decrypted
                }
            }));

            return decrypted;
        } catch (error) {
            console.error('Ошибка при расшифровке сообщения:', error);
            setError('Не удалось расшифровать сообщение');
            return 'Не удалось расшифровать сообщение';
        }
    };

    const handleRefreshUsers = () => {
        fetchUsersAndKeys();
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user.id);
        navigate(`/chat/${user.id}`);
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-100">
            <div className="w-full md:w-1/4 bg-white p-4 border-r flex flex-col">
                <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2">Ваша информация</h2>
                    <p className="text-sm text-gray-600">Никнейм: {nickname}</p>
                    <p className="text-sm text-gray-600">ID: {userId}</p>
                    <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        Статус: {isConnected ? 'Подключён' : 'Отключён'}
                    </p>
                    {wsError && (
                        <p className="text-sm text-red-600 mt-2">
                            Ошибка WebSocket: {wsError}
                        </p>
                    )}
                </div>

                <div className="mb-4">
                    <button
                        onClick={() => setShowKeys(!showKeys)}
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                        {showKeys ? 'Скрыть ключи' : 'Показать ключи'}
                    </button>
                    {showKeys && (
                        <div className="mt-2 p-2 bg-gray-100 rounded">
                            <p className="text-xs font-bold">Публичный ключ:</p>
                            <p className="text-xs break-all">{publicKey}</p>
                            <p className="text-xs font-bold mt-2">Приватный ключ:</p>
                            <p className="text-xs break-all">{privateKey}</p>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold">Пользователи</h2>
                        <button
                            onClick={handleRefreshUsers}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                            🔄
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {users.map(user => (
                            <button
                                key={user.id}
                                className={`w-full p-2 rounded ${selectedUser === user.id ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => {
                                    handleUserSelect(user);
                                    setError('');
                                }}
                            >
                                <div>{user.nickname}</div>
                                <div className="text-xs">
                                    {user.public_key ? '🔒 Доступен ключ' : '⚠️ Нет ключа'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-2">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex-1 p-4 overflow-y-auto">
                    {messages
                        .filter(m => m.sender_id === selectedUser || m.receiver_id === selectedUser)
                        .map(message => (
                        <div
                            key={message.id}
                            className={`mb-4 ${
                                message.sender_id === userId ? 'text-right' : 'text-left'
                            }`}
                        >
                            <div
                                className={`inline-block p-2 rounded-lg ${
                                    message.sender_id === userId
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200'
                                }`}
                            >
                                <div className="text-sm font-bold">
                                    {message.sender_id === userId ? 'Вы' : users.find(u => u.id === message.sender_id)?.nickname}
                                </div>
                                <div>{message.content}</div>
                                {message.encrypted_content && (
                                    <div className="text-xs mt-1 opacity-75">
                                        Зашифровано: {message.encrypted_content.substring(0, 50)}...
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white border-t">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold mb-2">Последнее шифрование/дешифрование</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {selectedUser && chatHistory[selectedUser] && (
                                <>
                                    <div className="text-xs text-gray-500 mb-2">
                                        От: {chatHistory[selectedUser].lastSender}
                                        {chatHistory[selectedUser].lastTimestamp && (
                                            <span className="ml-2">
                                                {new Date(chatHistory[selectedUser].lastTimestamp).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold">Зашифровано:</p>
                                        <p className="text-xs break-all bg-gray-100 p-2 rounded">
                                            {chatHistory[selectedUser].lastEncrypted || 'Нет зашифрованных сообщений'}
                                        </p>
                                    </div>
                                </>
                            )}
                            {!selectedUser && (
                                <div className="text-xs text-gray-500">
                                    Выберите пользователя для просмотра истории сообщений
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                        {error && (
                            <div className="text-red-500 text-sm mb-2">{error}</div>
                        )}
                        
                        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    setError('');
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                className="flex-1 p-2 border rounded"
                                placeholder="Введите сообщение..."
                            />
                            <button
                                onClick={handleSendMessage}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                disabled={!selectedUser}
                            >
                                Отправить
                            </button>
                        </div>
                        
                        {selectedUser && (
                            <div className="text-sm text-gray-600">
                                Отправка сообщения пользователю: {users.find(u => u.id === selectedUser)?.nickname}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;