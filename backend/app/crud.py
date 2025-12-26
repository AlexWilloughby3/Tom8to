from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt

from . import models, schemas


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    # Convert password to bytes and hash it
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for storage
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash"""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ===== USER OPERATIONS =====

def get_user(db: Session, userid: str) -> Optional[models.UserInformation]:
    """Get a user by userid"""
    return db.query(models.UserInformation).filter(models.UserInformation.userid == userid).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.UserInformation:
    """Create a new user with hashed password"""
    hashed_password = hash_password(user.password)
    db_user = models.UserInformation(userid=user.userid, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default categories for new user
    default_categories = ['Work', 'Study', 'Reading', 'Exercise', 'Meditation']
    for cat_name in default_categories:
        cat = models.CategoryInformation(userid=user.userid, category=cat_name)
        db.add(cat)
    db.commit()

    return db_user


def authenticate_user(db: Session, userid: str, password: str) -> Optional[models.UserInformation]:
    """Authenticate a user"""
    user = get_user(db, userid)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def delete_user(db: Session, userid: str) -> bool:
    """Delete a user and all their data"""
    db_user = get_user(db, userid)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False


# ===== FOCUS SESSION OPERATIONS =====

def create_focus_session(
    db: Session,
    userid: str,
    focus_session: schemas.FocusSessionCreate,
    time: Optional[datetime] = None
) -> models.FocusInformation:
    """Create a focus session (defaults to current time)"""
    if time is None:
        time = datetime.utcnow()

    # Auto-create category if it doesn't exist
    category_obj = get_category(db, userid, focus_session.category)
    if not category_obj:
        category_obj = models.CategoryInformation(
            userid=userid,
            category=focus_session.category
        )
        db.add(category_obj)
        db.commit()

    db_session = models.FocusInformation(
        userid=userid,
        time=time,
        focus_time_seconds=focus_session.focus_time_seconds,
        category=focus_session.category
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def get_focus_sessions(
    db: Session,
    userid: str,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[models.FocusInformation]:
    """Get focus sessions for a user with optional filters"""
    query = db.query(models.FocusInformation).filter(models.FocusInformation.userid == userid)

    if category:
        query = query.filter(models.FocusInformation.category == category)
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    return query.order_by(models.FocusInformation.time.desc()).offset(skip).limit(limit).all()


def get_focus_session(db: Session, userid: str, time: datetime) -> Optional[models.FocusInformation]:
    """Get a specific focus session"""
    return db.query(models.FocusInformation).filter(
        models.FocusInformation.userid == userid,
        models.FocusInformation.time == time
    ).first()


def delete_focus_session(db: Session, userid: str, time: datetime) -> bool:
    """Delete a focus session"""
    db_session = get_focus_session(db, userid, time)
    if db_session:
        db.delete(db_session)
        db.commit()
        return True
    return False


# ===== FOCUS GOAL OPERATIONS =====

def create_focus_goal(db: Session, userid: str, goal: schemas.FocusGoalCreate) -> models.FocusGoalInformation:
    """Create or update a focus goal for a category"""
    db_goal = get_focus_goal(db, userid, goal.category)

    if db_goal:
        # Update existing goal
        db_goal.goal_time_per_week_seconds = goal.goal_time_per_week_seconds
    else:
        # Create new goal
        db_goal = models.FocusGoalInformation(
            userid=userid,
            category=goal.category,
            goal_time_per_week_seconds=goal.goal_time_per_week_seconds
        )
        db.add(db_goal)

    db.commit()
    db.refresh(db_goal)
    return db_goal


def get_focus_goal(db: Session, userid: str, category: str) -> Optional[models.FocusGoalInformation]:
    """Get a specific focus goal"""
    return db.query(models.FocusGoalInformation).filter(
        models.FocusGoalInformation.userid == userid,
        models.FocusGoalInformation.category == category
    ).first()


def get_focus_goals(db: Session, userid: str) -> List[models.FocusGoalInformation]:
    """Get all focus goals for a user"""
    return db.query(models.FocusGoalInformation).filter(
        models.FocusGoalInformation.userid == userid
    ).all()


def delete_focus_goal(db: Session, userid: str, category: str) -> bool:
    """Delete a focus goal"""
    db_goal = get_focus_goal(db, userid, category)
    if db_goal:
        db.delete(db_goal)
        db.commit()
        return True
    return False


# ===== STATISTICS OPERATIONS =====

def get_user_stats(
    db: Session,
    userid: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> schemas.UserStats:
    """Get statistics for a user"""
    # Build base query
    query = db.query(
        models.FocusInformation.category,
        func.sum(models.FocusInformation.focus_time_seconds).label('total_time'),
        func.count(models.FocusInformation.time).label('session_count'),
        func.avg(models.FocusInformation.focus_time_seconds).label('avg_time')
    ).filter(models.FocusInformation.userid == userid)

    # Apply date filters
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    # Group by category
    category_stats = query.group_by(models.FocusInformation.category).all()

    # Get goals
    goals = {goal.category: goal.goal_time_per_week_seconds for goal in get_focus_goals(db, userid)}

    # Build response
    categories = []
    total_time = 0
    total_sessions = 0

    for cat_stat in category_stats:
        category, total_cat_time, session_count, avg_time = cat_stat
        total_time += total_cat_time or 0
        total_sessions += session_count or 0

        goal_time = goals.get(category)
        progress = None
        if goal_time and goal_time > 0:
            progress = (total_cat_time / goal_time) * 100

        categories.append(schemas.CategoryStats(
            category=category,
            total_time_seconds=total_cat_time or 0,
            session_count=session_count or 0,
            average_time_seconds=avg_time or 0,
            goal_time_per_week_seconds=goal_time,
            progress_percentage=progress
        ))

    return schemas.UserStats(
        userid=userid,
        total_focus_time_seconds=total_time,
        total_sessions=total_sessions,
        categories=categories
    )


# ===== CATEGORY OPERATIONS =====

def create_category(db: Session, userid: str, category: schemas.CategoryCreate) -> models.CategoryInformation:
    """Create a new category for a user"""
    db_category = get_category(db, userid, category.category)

    if db_category:
        # Category already exists, just return it
        return db_category

    # Create new category
    db_category = models.CategoryInformation(
        userid=userid,
        category=category.category
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_category(db: Session, userid: str, category: str) -> Optional[models.CategoryInformation]:
    """Get a specific category"""
    return db.query(models.CategoryInformation).filter(
        models.CategoryInformation.userid == userid,
        models.CategoryInformation.category == category
    ).first()


def get_categories(db: Session, userid: str) -> List[models.CategoryInformation]:
    """Get all categories for a user"""
    return db.query(models.CategoryInformation).filter(
        models.CategoryInformation.userid == userid
    ).order_by(models.CategoryInformation.category).all()


def delete_category(db: Session, userid: str, category: str) -> bool:
    """Delete a category and cascade delete all associated goals and focus sessions"""
    db_category = get_category(db, userid, category)
    if db_category:
        # Delete all focus goals for this category
        db.query(models.FocusGoalInformation).filter(
            models.FocusGoalInformation.userid == userid,
            models.FocusGoalInformation.category == category
        ).delete()

        # Delete all focus sessions for this category
        db.query(models.FocusInformation).filter(
            models.FocusInformation.userid == userid,
            models.FocusInformation.category == category
        ).delete()

        # Delete the category itself
        db.delete(db_category)
        db.commit()
        return True
    return False


# ===== GRAPH DATA OPERATIONS =====

def get_graph_data(db: Session, userid: str, time_range: str, category: Optional[str] = None) -> schemas.GraphData:
    """Get focus session data for graphing over a time period"""
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Calculate date ranges
    today = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)

    if time_range == 'week':
        start_date = today - timedelta(days=6)  # Last 7 days
        group_by_week = False
    elif time_range == 'month':
        start_date = today - timedelta(days=29)  # Last 30 days
        group_by_week = False
    elif time_range == '6month':
        start_date = today - timedelta(days=179)  # Last 180 days
        group_by_week = True
    elif time_range == 'ytd':
        start_date = datetime(today.year, 1, 1)  # Start of year
        group_by_week = True
    else:
        raise ValueError(f"Invalid time_range: {time_range}")

    # Query focus sessions
    query = db.query(models.FocusInformation).filter(
        models.FocusInformation.userid == userid,
        models.FocusInformation.time >= start_date,
        models.FocusInformation.time <= today
    )

    # Filter by category if specified
    if category:
        query = query.filter(models.FocusInformation.category == category)

    sessions = query.all()

    # Group by day or week
    data_dict = {}

    if group_by_week:
        # Group by week
        for session in sessions:
            # Get Monday of the week
            week_start = session.time - timedelta(days=session.time.weekday())
            week_key = week_start.strftime('%Y-%m-%d')

            if week_key not in data_dict:
                data_dict[week_key] = 0
            data_dict[week_key] += session.focus_time_seconds
    else:
        # Group by day
        for session in sessions:
            day_key = session.time.strftime('%Y-%m-%d')

            if day_key not in data_dict:
                data_dict[day_key] = 0
            data_dict[day_key] += session.focus_time_seconds

    # Fill in missing dates with 0
    current = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    filled_data = {}

    if group_by_week:
        # Fill weeks
        while current <= today:
            week_start = current - timedelta(days=current.weekday())
            week_key = week_start.strftime('%Y-%m-%d')
            if week_key not in filled_data:
                filled_data[week_key] = data_dict.get(week_key, 0)
            current += timedelta(days=7)
    else:
        # Fill days
        while current <= today:
            day_key = current.strftime('%Y-%m-%d')
            filled_data[day_key] = data_dict.get(day_key, 0)
            current += timedelta(days=1)

    # Convert to list of data points
    data_points = [
        schemas.GraphDataPoint(date=date, focus_time_seconds=seconds)
        for date, seconds in sorted(filled_data.items())
    ]

    return schemas.GraphData(
        data_points=data_points,
        time_range=time_range,
        category=category
    )
