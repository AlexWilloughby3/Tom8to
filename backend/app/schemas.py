from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
from datetime import datetime
from enum import Enum


# Goal type enum
class GoalType(str, Enum):
    TIME_BASED = "TIME_BASED"
    DAILY_CHECKBOX = "DAILY_CHECKBOX"
    WEEKLY_CHECKBOX = "WEEKLY_CHECKBOX"


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
    show_on_leaderboard: bool = True

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Update user settings"""
    show_on_leaderboard: bool = Field(..., description="Whether to show user on leaderboard")


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
    goal_type: GoalType = Field(..., description="Goal type: TIME_BASED, DAILY_CHECKBOX, or WEEKLY_CHECKBOX")
    goal_time_per_week_seconds: Optional[int] = Field(None, ge=0, le=604800, description="Weekly goal in seconds (max 168 hours, only for TIME_BASED)")
    description: Optional[str] = Field(None, max_length=255, description="Description for checkbox goals")


class FocusGoalCreate(FocusGoalBase):
    pass


class FocusGoalUpdate(BaseModel):
    goal_time_per_week_seconds: Optional[int] = Field(None, ge=0, le=604800, description="New weekly goal in seconds (max 168 hours)")
    description: Optional[str] = Field(None, max_length=255, description="New description")


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
    daily_checkbox_goals: List[Dict[str, Any]] = []
    weekly_checkbox_goals: List[Dict[str, Any]] = []


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
    active: bool = True

    class Config:
        from_attributes = True


class CategoryUpdate(BaseModel):
    active: bool = Field(..., description="Whether the category is active")


class CategoryRename(BaseModel):
    """Request to rename a category"""
    new_category: str = Field(..., min_length=1, max_length=50, description="New category name")


class CategoryRenameResponse(BaseModel):
    """Response indicating whether merge is required"""
    requires_merge: bool = Field(..., description="True if target category exists and merge is needed")
    target_exists: bool = Field(..., description="True if target category already exists")
    message: str = Field(..., description="Description of what will happen")


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


# Data export/import schemas
class ExportedCategory(BaseModel):
    category: str
    active: bool

class ExportedGoal(BaseModel):
    category: str
    goal_time_per_week_seconds: int

class ExportedSession(BaseModel):
    time: str  # ISO format datetime string
    focus_time_seconds: int
    category: str

class UserDataExport(BaseModel):
    version: str = "1.0"
    export_date: str  # ISO format datetime string
    categories: List[ExportedCategory]
    goals: List[ExportedGoal]
    sessions: List[ExportedSession]

class UserDataImport(BaseModel):
    version: str
    categories: List[ExportedCategory]
    goals: List[ExportedGoal]
    sessions: List[ExportedSession]

class ImportResult(BaseModel):
    categories_imported: int
    goals_imported: int
    sessions_imported: int
    message: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, description="New password (min 6 characters)")


class RegistrationVerification(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


# Checkbox completion schemas
class CheckboxCompletionBase(BaseModel):
    category: str
    goal_type: GoalType
    completion_date: datetime
    completed: bool


class CheckboxCompletionCreate(BaseModel):
    category: str
    goal_type: GoalType


class CheckboxCompletion(CheckboxCompletionBase):
    email: str
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Leaderboard schemas
class LeaderboardEntry(BaseModel):
    email: str
    focus_hours_this_week: float
    focus_hours_all_time: float
    goals_completed_this_week: int
    total_goals_this_week: int
    goals_completed_all_time: int
    daily_goals_completed_this_week: int = 0
    total_daily_goals_this_week: int = 0
    weekly_goals_completed_this_week: int = 0
    total_weekly_goals_this_week: int = 0
