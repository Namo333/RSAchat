from fastapi import FastAPI, Depends, HTTPException, WebSocket
from sqlalchemy.orm import Session
from .models import User, Message
from .schemas import User as UserSchema, Message as MessageSchema
from .database import engine, get_db
from .utils.rsa import generate_key_pair, encrypt_message, decrypt_message
from fastapi import WebSocketDisconnect
from pydantic import BaseModel
import json
from datetime import datetime
import time
from .metrics import (
    MESSAGE_COUNTER,
    ENCRYPTION_COUNTER,
    DECRYPTION_COUNTER,
    ACTIVE_USERS,
    MESSAGE_LATENCY,
    WEBSOCKET_CONNECTIONS,
    get_metrics
)

# Create database tables
from .database import Base
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Хранилище активных WebSocket соединений
active_connections = {}

class EncryptRequest(BaseModel):
    text: str
    public_key: str

class DecryptRequest(BaseModel):
    encrypted_text: str
    private_key: str

class UserCreate(BaseModel):
    nickname: str

@app.get("/metrics")
async def metrics():
    return get_metrics()

@app.get("/")
def read_root():
    return {"message": "Welcome to RSA API"}

@app.post("/generate-keys")
async def generate_keys():
    try:
        keys = generate_key_pair()
        return {
            "public_key": keys["public_key"],
            "private_key": keys["private_key"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users", response_model=UserSchema)
def create_user(user: UserSchema, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.nickname == user.nickname).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nickname already registered")
    
    db_user = User(
        nickname=user.nickname,
        public_key=user.public_key,
        private_key=user.private_key
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    ACTIVE_USERS.inc()
    return db_user

@app.get("/users", response_model=list[UserSchema])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@app.get("/users/{user_id}", response_model=UserSchema)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/by-nickname/{nickname}")
async def get_user_by_nickname(nickname: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.nickname == nickname).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/messages", response_model=MessageSchema)
def create_message(message: MessageSchema, sender_id: int, db: Session = Depends(get_db)):
    start_time = time.time()
    db_message = Message(
        content=message.content,
        encrypted_content=message.encrypted_content,
        sender_id=sender_id,
        receiver_id=message.receiver_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    MESSAGE_COUNTER.inc()
    MESSAGE_LATENCY.observe(time.time() - start_time)
    return db_message

@app.get("/messages/{user_id}", response_model=list[MessageSchema])
def get_user_messages(user_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        (Message.sender_id == user_id) | 
        (Message.receiver_id == user_id)
    ).order_by(Message.timestamp.desc()).all()
    return messages

@app.post("/encrypt")
async def encrypt_text(data: EncryptRequest):
    try:
        if not data.public_key:
            raise HTTPException(status_code=400, detail="Public key is required")
        if not data.text:
            raise HTTPException(status_code=400, detail="Text to encrypt is required")
            
        encrypted = encrypt_message(data.text, data.public_key)
        ENCRYPTION_COUNTER.inc()
        return {"encrypted_text": encrypted}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.post("/decrypt")
async def decrypt_text(data: DecryptRequest):
    try:
        if not data.private_key:
            raise HTTPException(status_code=400, detail="Private key is required")
        if not data.encrypted_text:
            raise HTTPException(status_code=400, detail="Encrypted text is required")
            
        decrypted = decrypt_message(data.encrypted_text, data.private_key)
        DECRYPTION_COUNTER.inc()
        return {"decrypted_text": decrypted}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

@app.post("/users/create", response_model=UserSchema)
async def create_user_with_keys(user: UserCreate, db: Session = Depends(get_db)):
    # Проверяем, существует ли пользователь с таким никнеймом
    existing_user = db.query(User).filter(User.nickname == user.nickname).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Nickname already registered")
    
    # Генерируем ключи
    keys = generate_key_pair()
    
    # Создаем нового пользователя
    db_user = User(
        nickname=user.nickname,
        public_key=keys["public_key"],
        private_key=keys["private_key"]
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    ACTIVE_USERS.inc()
    return db_user

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await websocket.accept()
    active_connections[user_id] = websocket
    WEBSOCKET_CONNECTIONS.inc()
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Проверяем наличие необходимых полей
            if not message_data.get("content"):
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Message content cannot be empty"
                }))
                continue
                
            if not message_data.get("encrypted_content"):
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Encrypted content is required"
                }))
                continue
                
            if not message_data.get("receiver_id"):
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Receiver ID is required"
                }))
                continue
            
            # Сохраняем сообщение в базу данных
            start_time = time.time()
            db = next(get_db())
            db_message = Message(
                content=message_data["content"],
                encrypted_content=message_data["encrypted_content"],
                sender_id=user_id,  # Используем ID из URL
                receiver_id=message_data["receiver_id"]
            )
            db.add(db_message)
            db.commit()
            db.refresh(db_message)
            MESSAGE_COUNTER.inc()
            MESSAGE_LATENCY.observe(time.time() - start_time)
            
            # Если есть получатель, отправляем сообщение ему
            receiver_id = message_data["receiver_id"]
            if receiver_id in active_connections:
                await active_connections[receiver_id].send_text(json.dumps({
                    "type": "message",
                    "data": {
                        "id": db_message.id,
                        "content": db_message.content,
                        "encrypted_content": db_message.encrypted_content,
                        "sender_id": db_message.sender_id,
                        "receiver_id": db_message.receiver_id,
                        "timestamp": db_message.timestamp.isoformat()
                    }
                }))
            
            # Отправляем подтверждение отправителю
            await websocket.send_text(json.dumps({
                "type": "message",
                "data": {
                    "id": db_message.id,
                    "content": db_message.content,
                    "encrypted_content": db_message.encrypted_content,
                    "sender_id": db_message.sender_id,
                    "receiver_id": db_message.receiver_id,
                    "timestamp": db_message.timestamp.isoformat()
                }
            }))
    except WebSocketDisconnect:
        if user_id in active_connections:
            del active_connections[user_id]
            WEBSOCKET_CONNECTIONS.dec()
    except Exception as e:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": str(e)
        }))