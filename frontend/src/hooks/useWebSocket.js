import { useState, useEffect, useCallback } from 'react';

export const useWebSocket = (url) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
            setIsConnected(true);
        };

        ws.onclose = () => {
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            setLastMessage(event.data);
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [url]);

    const sendMessage = useCallback(
        (message) => {
            if (socket && isConnected) {
                socket.send(message);
            }
        },
        [socket, isConnected]
    );

    return { sendMessage, lastMessage, isConnected };
}; 