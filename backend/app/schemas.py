from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User email address")


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="User password (will be hashed, min 8 characters)")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    """User response model (without password)"""

    class Config:
        from_attributes = True


class UserWithSessions(User):
    """User with their focus sessions and goals"""
    focus_sessions: List["FocusSession"] = []
    focus_goals: List["FocusGoal"] = []
    categories: List["Category"] = []


# Focus session schemas
class FocusSessionBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=50, description="Focus category (e.g., Work, Study)")
    focus_time_seconds: int = Field(..., ge=0, description="Focus time in seconds")


class FocusSessionCreate(FocusSessionBase):
    """Create a focus session with current timestamp"""
    pass


class FocusSessionCreateWithTime(FocusSessionBase):
    """Create a focus session with a specific timestamp"""
    time: datetime


class FocusSession(FocusSessionBase):
    email: str
    time: datetime

    class Config:
        from_attributes = True


# Focus goal schemas
class FocusGoalBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=50, description="Focus category")
    goal_time_per_week_seconds: int = Field(..., ge=0, le=604800, description="Weekly goal in seconds (max 168 hours)")


class FocusGoalCreate(FocusGoalBase):
    pass


class FocusGoalUpdate(BaseModel):
    goal_time_per_week_seconds: int = Field(..., ge=0, le=604800, description="New weekly goal in seconds (max 168 hours)")


class FocusGoal(FocusGoalBase):
    email: str

    class Config:
        from_attributes = True


# Statistics and summary schemas
class CategoryStats(BaseModel):
    category: str
    total_time_seconds: int
    session_count: int
    average_time_seconds: float
    goal_time_per_week_seconds: Optional[int] = None
    progress_percentage: Optional[float] = None


class UserStats(BaseModel):
    email: str
    total_focus_time_seconds: int
    total_sessions: int
    categories: List[CategoryStats]


# Category schemas
class CategoryBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=50, description="Category name")


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    email: str

    class Config:
        from_attributes = True


# Graph data schemas
class GraphDataPoint(BaseModel):
    date: str
    focus_time_seconds: int


class GraphData(BaseModel):
    data_points: List[GraphDataPoint]
    time_range: str
    category: Optional[str] = None


# Verification code and password schemas
class VerificationCodeRequest(BaseModel):
    email: EmailStr


class VerificationCodeLogin(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, description="New password (min 6 characters)")


class RegistrationVerification(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
