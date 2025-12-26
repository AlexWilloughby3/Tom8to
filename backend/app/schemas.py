from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    userid: str = Field(..., min_length=1, max_length=255, description="Unique user identifier")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="User password (will be hashed)")


class UserLogin(BaseModel):
    userid: str
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
    category: str = Field(..., min_length=1, max_length=255, description="Focus category (e.g., Work, Study)")
    focus_time_seconds: int = Field(..., ge=0, description="Focus time in seconds")


class FocusSessionCreate(FocusSessionBase):
    """Create a focus session with current timestamp"""
    pass


class FocusSessionCreateWithTime(FocusSessionBase):
    """Create a focus session with a specific timestamp"""
    time: datetime


class FocusSession(FocusSessionBase):
    userid: str
    time: datetime

    class Config:
        from_attributes = True


# Focus goal schemas
class FocusGoalBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=255, description="Focus category")
    goal_time_per_week_seconds: int = Field(..., ge=0, description="Weekly goal in seconds")


class FocusGoalCreate(FocusGoalBase):
    pass


class FocusGoalUpdate(BaseModel):
    goal_time_per_week_seconds: int = Field(..., ge=0, description="New weekly goal in seconds")


class FocusGoal(FocusGoalBase):
    userid: str

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
    userid: str
    total_focus_time_seconds: int
    total_sessions: int
    categories: List[CategoryStats]


# Category schemas
class CategoryBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=255, description="Category name")


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    userid: str

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
