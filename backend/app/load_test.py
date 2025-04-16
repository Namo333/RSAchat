import asyncio
import aiohttp
import json
import random
import string
import time
import websockets
import uuid
from datetime import datetime

# Конфигурация
API_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"
NUM_USERS = 10
NUM_MESSAGES_PER_USER = 20
MESSAGE_INTERVAL = 0.5  # секунды между сообщениями
TEST_DURATION = 300  # длительность теста в секундах

# Счетчик для генерации ID сообщений
message_id_counter = 1

# Генерация случайного никнейма
def generate_nickname():
    return f"test_user_{uuid.uuid4().hex[:8]}"

# Создание пользователя
async def create_user(session, nickname):
    url = f"{API_URL}/users/create"
    data = {"nickname": nickname}
    async with session.post(url, json=data) as response:
        if response.status == 200:
            return await response.json()
        else:
            print(f"Ошибка создания пользователя {nickname}: {await response.text()}")
            return None

# Отправка сообщения
async def send_message(session, sender_id, receiver_id, content):
    global message_id_counter
    
    # Получаем публичный ключ получателя
    url = f"{API_URL}/users/{receiver_id}"
    async with session.get(url) as response:
        if response.status != 200:
            print(f"Ошибка получения пользователя {receiver_id}: {await response.text()}")
            return
        
        receiver = await response.json()
        public_key = receiver["public_key"]
    
    # Шифруем сообщение
    url = f"{API_URL}/encrypt"
    data = {"text": content, "public_key": public_key}
    async with session.post(url, json=data) as response:
        if response.status != 200:
            print(f"Ошибка шифрования: {await response.text()}")
            return
        
        encrypted = await response.json()
        encrypted_content = encrypted["encrypted_text"]
    
    # Отправляем сообщение
    url = f"{API_URL}/messages"
    current_time = datetime.utcnow().isoformat()
    
    data = {
        "id": message_id_counter,
        "content": content,
        "encrypted_content": encrypted_content,
        "receiver_id": receiver_id,
        "timestamp": current_time
    }
    
    message_id_counter += 1
    
    async with session.post(url, json=data, params={"sender_id": sender_id}) as response:
        if response.status != 200:
            print(f"Ошибка отправки сообщения: {await response.text()}")
        else:
            print(f"Сообщение отправлено от {sender_id} к {receiver_id}")

# WebSocket клиент для получения сообщений
async def websocket_client(user_id):
    uri = f"{WS_URL}/{user_id}"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"WebSocket соединение установлено для пользователя {user_id}")
            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)
                    if data["type"] == "message":
                        print(f"Пользователь {user_id} получил сообщение от {data['data']['sender_id']}")
                except websockets.exceptions.ConnectionClosed:
                    break
    except Exception as e:
        print(f"Ошибка WebSocket для пользователя {user_id}: {e}")

# Основная функция тестирования
async def run_load_test():
    print(f"Начало тестирования нагрузки: {NUM_USERS} пользователей, {NUM_MESSAGES_PER_USER} сообщений на пользователя")
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        # Создаем пользователей
        users = []
        for i in range(NUM_USERS):
            nickname = generate_nickname()
            user = await create_user(session, nickname)
            if user:
                users.append(user)
                print(f"Создан пользователь: {user['nickname']} (ID: {user['id']})")
        
        if not users:
            print("Не удалось создать пользователей. Тест прерван.")
            return
        
        # Запускаем WebSocket клиенты
        websocket_tasks = [asyncio.create_task(websocket_client(user["id"])) for user in users]
        
        # Отправляем сообщения
        message_tasks = []
        for user in users:
            for _ in range(NUM_MESSAGES_PER_USER):
                # Выбираем случайного получателя (кроме отправителя)
                receiver = random.choice([u for u in users if u["id"] != user["id"]])
                content = f"Тестовое сообщение {uuid.uuid4().hex[:8]}"
                message_tasks.append(
                    asyncio.create_task(send_message(session, user["id"], receiver["id"], content))
                )
                await asyncio.sleep(MESSAGE_INTERVAL)
        
        # Ждем завершения отправки сообщений
        await asyncio.gather(*message_tasks)
        
        # Ждем до окончания теста
        elapsed = time.time() - start_time
        if elapsed < TEST_DURATION:
            await asyncio.sleep(TEST_DURATION - elapsed)
        
        # Отменяем WebSocket задачи
        for task in websocket_tasks:
            task.cancel()
        
        try:
            await asyncio.gather(*websocket_tasks)
        except asyncio.CancelledError:
            pass
    
    print(f"Тест завершен. Прошло {time.time() - start_time:.2f} секунд.")

# Запуск теста
if __name__ == "__main__":
    asyncio.run(run_load_test()) 