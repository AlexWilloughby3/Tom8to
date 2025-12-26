from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class UserInformation(Base):
    """Table 1: User information"""
    __tablename__ = "user_information"

    email = Column(String(255), primary_key=True, index=True)
    password = Column(String(255), nullable=False)

    # Relationships
    focus_sessions = relationship("FocusInformation", back_populates="user", cascade="all, delete-orphan")
    focus_goals = relationship("FocusGoalInformation", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("CategoryInformation", back_populates="user", cascade="all, delete-orphan")


class FocusInformation(Base):
    """Table 2: Focus information"""
    __tablename__ = "focus_information"

    email = Column(String(255), ForeignKey("user_information.email"), primary_key=True, nullable=False)
    time = Column(DateTime, primary_key=True, nullable=False)
    focus_time_seconds = Column(Integer, nullable=False)
    category = Column(String(255), nullable=False)

    # Relationship to user
    user = relationship("UserInformation", back_populates="focus_sessions")


class FocusGoalInformation(Base):
    """Table 3: Focus goal information"""
    __tablename__ = "focus_goal_information"

    email = Column(String(255), ForeignKey("user_information.email"), primary_key=True, nullable=False)
    category = Column(String(255), primary_key=True, nullable=False)
    goal_time_per_week_seconds = Column(Integer, nullable=False)

    # Relationship to user
    user = relationship("UserInformation", back_populates="focus_goals")


class CategoryInformation(Base):
    """Table 4: Category information"""
    __tablename__ = "category_information"

    email = Column(String(255), ForeignKey("user_information.email"), primary_key=True, nullable=False)
    category = Column(String(255), primary_key=True, nullable=False)

    # Relationship to user
    user = relationship("UserInformation", back_populates="categories")


class VerificationCode(Base):
    """Table 5: Verification codes for passwordless login"""
    __tablename__ = "verification_codes"

    email = Column(String(255), primary_key=True, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


class PasswordResetToken(Base):
    """Table 6: Password reset tokens"""
    __tablename__ = "password_reset_tokens"

    token = Column(String(255), primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, nullable=False, default=0)  # 0 = unused, 1 = used


class PendingRegistration(Base):
    """Table 7: Pending registrations awaiting email verification"""
    __tablename__ = "pending_registrations"

    email = Column(String(255), primary_key=True, index=True)
    password = Column(String(255), nullable=False)  # Hashed password
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
