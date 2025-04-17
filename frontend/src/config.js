const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost/ws';

export const API_ENDPOINTS = {
    USERS: `${API_BASE_URL}/users`,
    USER_CREATE: `${API_BASE_URL}/users/create`,
    USER_BY_NICKNAME: (nickname) => `${API_BASE_URL}/users/by-nickname/${nickname}`,
    USER_BY_ID: (id) => `${API_BASE_URL}/users/${id}`,
    MESSAGES: (userId) => `${API_BASE_URL}/messages/${userId}`,
    ENCRYPT: `${API_BASE_URL}/encrypt`,
    DECRYPT: `${API_BASE_URL}/decrypt`,
    WS: (userId) => `${WS_BASE_URL}/${userId}`
}; 