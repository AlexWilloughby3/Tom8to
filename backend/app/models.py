from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base


class UserInformation(Base):
    """Table 1: User information"""
    __tablename__ = "user_information"

    userid = Column(String(255), primary_key=True, index=True)
    password = Column(String(255), nullable=False)

    # Relationships
    focus_sessions = relationship("FocusInformation", back_populates="user", cascade="all, delete-orphan")
    focus_goals = relationship("FocusGoalInformation", back_populates="user", cascade="all, delete-orphan")


class FocusInformation(Base):
    """Table 2: Focus information"""
    __tablename__ = "focus_information"

    userid = Column(String(255), ForeignKey("user_information.userid"), primary_key=True, nullable=False)
    time = Column(DateTime, primary_key=True, nullable=False)
    focus_time_seconds = Column(Integer, nullable=False)
    category = Column(String(255), nullable=False)

    # Relationship to user
    user = relationship("UserInformation", back_populates="focus_sessions")


class FocusGoalInformation(Base):
    """Table 3: Focus goal information"""
    __tablename__ = "focus_goal_information"

    userid = Column(String(255), ForeignKey("user_information.userid"), primary_key=True, nullable=False)
    category = Column(String(255), primary_key=True, nullable=False)
    goal_time_per_week_seconds = Column(Integer, nullable=False)

    # Relationship to user
    user = relationship("UserInformation", back_populates="focus_goals")
