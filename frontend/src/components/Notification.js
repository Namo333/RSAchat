import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Notification = ({ message, onClose, index }) => {
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    // Закрываем уведомление перед навигацией
    setIsVisible(false);
    onClose();
    
    // Используем setTimeout для гарантии, что уведомление закроется перед навигацией
    setTimeout(() => {
      navigate(`/chat/${message.sender_id}`);
    }, 100);
  };

  if (!isVisible) return null;

  // Рассчитываем позицию уведомления с учетом индекса
  const bottomPosition = 20 + (index * 80); // 80px - высота уведомления + отступ

  return (
    <div 
      className="fixed right-4 bg-white p-4 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-200 z-50"
      style={{ bottom: `${bottomPosition}px` }}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <div>
          <p className="font-semibold">Новое сообщение от {message.sender_nickname}</p>
          <p className="text-gray-600 text-sm truncate max-w-xs">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Notification; 