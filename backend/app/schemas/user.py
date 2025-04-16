from pydantic import BaseModel

class UserBase(BaseModel):
    nickname: str

class UserCreate(UserBase):
    public_key: str | None = None
    private_key: str | None = None

class User(UserBase):
    id: int
    public_key: str | None = None
    private_key: str | None = None

    class Config:
        from_attributes = True 