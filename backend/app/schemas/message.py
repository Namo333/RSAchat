from pydantic import BaseModel
from datetime import datetime

class MessageBase(BaseModel):
    content: str
    encrypted_content: str
    receiver_id: int

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    sender_id: int | None = None
    timestamp: datetime

    class Config:
        from_attributes = True 