import { useState, useEffect, useCallback } from 'react';

export const useWebSocket = (url) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let ws = null;
        let reconnectTimeout = null;

        const connect = () => {
            try {
                ws = new WebSocket(url);

                ws.onopen = () => {
                    console.log('WebSocket connected');
                    setIsConnected(true);
                    setError(null);
                };

                ws.onclose = () => {
                    console.log('WebSocket disconnected');
                    setIsConnected(false);
                    // Попытка переподключения через 5 секунд
                    reconnectTimeout = setTimeout(connect, 5000);
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setError('WebSocket connection error');
                    setIsConnected(false);
                };

                ws.onmessage = (event) => {
                    console.log('WebSocket message received:', event.data);
                    setLastMessage(event.data);
                };

                setSocket(ws);
            } catch (error) {
                console.error('Error creating WebSocket:', error);
                setError('Failed to create WebSocket connection');
                setIsConnected(false);
            }
        };

        connect();

        return () => {
            if (ws) {
                ws.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, [url]);

    const sendMessage = useCallback(
        (message) => {
            if (socket && isConnected) {
                try {
                    socket.send(message);
                } catch (error) {
                    console.error('Error sending message:', error);
                    setError('Failed to send message');
                }
            } else {
                console.error('Cannot send message: WebSocket is not connected');
                setError('WebSocket is not connected');
            }
        },
        [socket, isConnected]
    );

    return { sendMessage, lastMessage, isConnected, error };
}; 