from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt

from . import models, schemas
from . import email_service


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

def get_user(db: Session, email: str) -> Optional[models.UserInformation]:
    """Get a user by email"""
    return db.query(models.UserInformation).filter(models.UserInformation.email == email).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.UserInformation:
    """Create a new user with hashed password"""
    hashed_password = hash_password(user.password)
    db_user = models.UserInformation(email=user.email, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default categories for new user
    default_categories = ['Work', 'Study', 'Reading', 'Exercise', 'Meditation']
    for cat_name in default_categories:
        cat = models.CategoryInformation(email=user.email, category=cat_name)
        db.add(cat)
    db.commit()

    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.UserInformation]:
    """Authenticate a user"""
    user = get_user(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def delete_user(db: Session, email: str) -> bool:
    """Delete a user and all their data"""
    db_user = get_user(db, email)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False


# ===== FOCUS SESSION OPERATIONS =====

def create_focus_session(
    db: Session,
    email: str,
    focus_session: schemas.FocusSessionCreate,
    time: Optional[datetime] = None
) -> models.FocusInformation:
    """Create a focus session (defaults to current time)"""
    if time is None:
        time = datetime.utcnow()

    # Auto-create category if it doesn't exist
    category_obj = get_category(db, email, focus_session.category)
    if not category_obj:
        # Check if user already has 20 categories
        category_count = db.query(func.count(models.CategoryInformation.category)).filter(
            models.CategoryInformation.email == email
        ).scalar()

        if category_count >= 20:
            raise ValueError("Maximum of 20 categories per user reached")

        category_obj = models.CategoryInformation(
            email=email,
            category=focus_session.category
        )
        db.add(category_obj)
        db.commit()

    db_session = models.FocusInformation(
        email=email,
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
    email: str,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[models.FocusInformation]:
    """Get focus sessions for a user with optional filters"""
    query = db.query(models.FocusInformation).filter(models.FocusInformation.email == email)

    if category:
        query = query.filter(models.FocusInformation.category == category)
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    return query.order_by(models.FocusInformation.time.desc()).offset(skip).limit(limit).all()


def get_focus_session(db: Session, email: str, time: datetime) -> Optional[models.FocusInformation]:
    """Get a specific focus session"""
    return db.query(models.FocusInformation).filter(
        models.FocusInformation.email == email,
        models.FocusInformation.time == time
    ).first()


def delete_focus_session(db: Session, email: str, time: datetime) -> bool:
    """Delete a focus session"""
    db_session = get_focus_session(db, email, time)
    if db_session:
        db.delete(db_session)
        db.commit()
        return True
    return False


# ===== FOCUS GOAL OPERATIONS =====

def create_focus_goal(db: Session, email: str, goal: schemas.FocusGoalCreate) -> models.FocusGoalInformation:
    """Create or update a focus goal for a category"""
    db_goal = get_focus_goal(db, email, goal.category)

    if db_goal:
        # Update existing goal
        db_goal.goal_time_per_week_seconds = goal.goal_time_per_week_seconds
    else:
        # Create new goal
        db_goal = models.FocusGoalInformation(
            email=email,
            category=goal.category,
            goal_time_per_week_seconds=goal.goal_time_per_week_seconds
        )
        db.add(db_goal)

    db.commit()
    db.refresh(db_goal)
    return db_goal


def get_focus_goal(db: Session, email: str, category: str) -> Optional[models.FocusGoalInformation]:
    """Get a specific focus goal"""
    return db.query(models.FocusGoalInformation).filter(
        models.FocusGoalInformation.email == email,
        models.FocusGoalInformation.category == category
    ).first()


def get_focus_goals(db: Session, email: str) -> List[models.FocusGoalInformation]:
    """Get all focus goals for a user"""
    return db.query(models.FocusGoalInformation).filter(
        models.FocusGoalInformation.email == email
    ).all()


def delete_focus_goal(db: Session, email: str, category: str) -> bool:
    """Delete a focus goal"""
    db_goal = get_focus_goal(db, email, category)
    if db_goal:
        db.delete(db_goal)
        db.commit()
        return True
    return False


# ===== STATISTICS OPERATIONS =====

def get_user_stats(
    db: Session,
    email: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> schemas.UserStats:
    """Get statistics for a user"""
    # Get active categories
    active_categories = db.query(models.CategoryInformation).filter(
        models.CategoryInformation.email == email,
        models.CategoryInformation.active == True
    ).all()
    active_category_names = {cat.category for cat in active_categories}

    # Build base query for time logged
    query = db.query(
        models.FocusInformation.category,
        func.sum(models.FocusInformation.focus_time_seconds).label('total_time'),
        func.count(models.FocusInformation.time).label('session_count'),
        func.avg(models.FocusInformation.focus_time_seconds).label('avg_time')
    ).filter(models.FocusInformation.email == email)

    # Apply date filters
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    # Group by category
    category_stats = query.group_by(models.FocusInformation.category).all()

    # Get goals for active categories only
    all_goals = get_focus_goals(db, email)
    goals = {goal.category: goal.goal_time_per_week_seconds
             for goal in all_goals if goal.category in active_category_names}

    # Build time stats dict
    time_stats = {}
    for cat_stat in category_stats:
        category, total_cat_time, session_count, avg_time = cat_stat
        if category in active_category_names:  # Only include active categories
            time_stats[category] = {
                'total_time': total_cat_time or 0,
                'session_count': session_count or 0,
                'avg_time': avg_time or 0
            }

    # Build response - include ALL goals, even if no time logged
    categories = []
    total_time = 0
    total_sessions = 0

    # First, add all categories with goals (even if 0 time)
    for category, goal_time in goals.items():
        stats = time_stats.get(category, {'total_time': 0, 'session_count': 0, 'avg_time': 0})
        total_cat_time = stats['total_time']
        session_count = stats['session_count']
        avg_time = stats['avg_time']

        total_time += total_cat_time
        total_sessions += session_count

        progress = None
        if goal_time and goal_time > 0:
            progress = (total_cat_time / goal_time) * 100

        categories.append(schemas.CategoryStats(
            category=category,
            total_time_seconds=total_cat_time,
            session_count=session_count,
            average_time_seconds=avg_time,
            goal_time_per_week_seconds=goal_time,
            progress_percentage=progress
        ))

    # Then add categories with time but no goal (if any)
    for category, stats in time_stats.items():
        if category not in goals:
            total_time += stats['total_time']
            total_sessions += stats['session_count']

            categories.append(schemas.CategoryStats(
                category=category,
                total_time_seconds=stats['total_time'],
                session_count=stats['session_count'],
                average_time_seconds=stats['avg_time'],
                goal_time_per_week_seconds=None,
                progress_percentage=None
            ))

    return schemas.UserStats(
        email=email,
        total_focus_time_seconds=total_time,
        total_sessions=total_sessions,
        categories=categories
    )


# ===== CATEGORY OPERATIONS =====

def create_category(db: Session, email: str, category: schemas.CategoryCreate) -> models.CategoryInformation:
    """Create a new category for a user (max 20 categories per user)"""
    db_category = get_category(db, email, category.category)

    if db_category:
        # Category already exists, just return it
        return db_category

    # Check if user already has 20 categories
    category_count = db.query(func.count(models.CategoryInformation.category)).filter(
        models.CategoryInformation.email == email
    ).scalar()

    if category_count >= 20:
        raise ValueError("Maximum of 20 categories per user reached")

    # Create new category
    db_category = models.CategoryInformation(
        email=email,
        category=category.category
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_category(db: Session, email: str, category: str) -> Optional[models.CategoryInformation]:
    """Get a specific category"""
    return db.query(models.CategoryInformation).filter(
        models.CategoryInformation.email == email,
        models.CategoryInformation.category == category
    ).first()


def get_categories(db: Session, email: str) -> List[models.CategoryInformation]:
    """Get all categories for a user"""
    return db.query(models.CategoryInformation).filter(
        models.CategoryInformation.email == email
    ).order_by(models.CategoryInformation.category).all()


def update_category(db: Session, email: str, category: str, active: bool) -> Optional[models.CategoryInformation]:
    """Update a category's active status"""
    db_category = get_category(db, email, category)
    if db_category:
        db_category.active = active
        db.commit()
        db.refresh(db_category)
        return db_category
    return None


def delete_category(db: Session, email: str, category: str) -> bool:
    """Delete a category and cascade delete all associated goals and focus sessions"""
    db_category = get_category(db, email, category)
    if db_category:
        # Delete all focus goals for this category
        db.query(models.FocusGoalInformation).filter(
            models.FocusGoalInformation.email == email,
            models.FocusGoalInformation.category == category
        ).delete()

        # Delete all focus sessions for this category
        db.query(models.FocusInformation).filter(
            models.FocusInformation.email == email,
            models.FocusInformation.category == category
        ).delete()

        # Delete the category itself
        db.delete(db_category)
        db.commit()
        return True
    return False


# ===== GRAPH DATA OPERATIONS =====

def get_graph_data(db: Session, email: str, time_range: str, category: Optional[str] = None) -> schemas.GraphData:
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
        models.FocusInformation.email == email,
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


# ===== VERIFICATION CODE OPERATIONS =====

def get_verification_code(db: Session, email: str) -> Optional[models.VerificationCode]:
    """Get verification code for an email"""
    return db.query(models.VerificationCode).filter(models.VerificationCode.email == email).first()


def create_verification_code(db: Session, email: str) -> str:
    """Generate and store verification code, return code for emailing"""
    code = email_service.generate_6_digit_code()
    expires_at = email_service.get_code_expiry()

    # Upsert (replace existing code if present)
    db_code = get_verification_code(db, email)
    if db_code:
        db_code.code = code
        db_code.created_at = datetime.utcnow()
        db_code.expires_at = expires_at
    else:
        db_code = models.VerificationCode(
            email=email,
            code=code,
            created_at=datetime.utcnow(),
            expires_at=expires_at
        )
        db.add(db_code)

    db.commit()
    return code


def verify_code(db: Session, email: str, code: str) -> bool:
    """Verify code is correct and not expired"""
    db_code = get_verification_code(db, email)
    if not db_code:
        return False

    # Check expiry
    if datetime.utcnow() > db_code.expires_at:
        db.delete(db_code)  # Clean up expired code
        db.commit()
        return False

    # Check code match
    if db_code.code != code:
        return False

    # Code verified, delete it (single-use)
    db.delete(db_code)
    db.commit()
    return True


# ===== PASSWORD MANAGEMENT OPERATIONS =====

def change_password(db: Session, email: str, current_password: str, new_password: str) -> bool:
    """Change user password after verifying current password"""
    user = authenticate_user(db, email, current_password)
    if not user:
        return False

    user.password = hash_password(new_password)
    db.commit()
    return True


def create_password_reset_token(db: Session, email: str) -> str:
    """Generate and store password reset token, return token for emailing"""
    import secrets
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour

    db_token = models.PasswordResetToken(
        token=token,
        email=email,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        used=0
    )
    db.add(db_token)
    db.commit()
    return token


def reset_password_with_token(db: Session, token: str, new_password: str) -> bool:
    """Reset password using a valid token"""
    db_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == token
    ).first()

    if not db_token:
        return False

    # Check if token is expired
    if datetime.utcnow() > db_token.expires_at:
        db.delete(db_token)
        db.commit()
        return False

    # Check if token has been used
    if db_token.used == 1:
        return False

    # Get user and update password
    user = get_user(db, db_token.email)
    if not user:
        return False

    user.password = hash_password(new_password)
    db_token.used = 1  # Mark token as used
    db.commit()
    return True


# ===== PENDING REGISTRATION OPERATIONS =====

def create_pending_registration(db: Session, email: str, password: str) -> str:
    """Create pending registration and return verification code"""
    # Hash the password
    hashed_password = hash_password(password)

    # Generate verification code
    code = email_service.generate_6_digit_code()
    expires_at = email_service.get_code_expiry()

    # Delete any existing pending registration for this email
    db.query(models.PendingRegistration).filter(
        models.PendingRegistration.email == email
    ).delete()

    # Create new pending registration
    pending_reg = models.PendingRegistration(
        email=email,
        password=hashed_password,
        code=code,
        created_at=datetime.utcnow(),
        expires_at=expires_at
    )
    db.add(pending_reg)
    db.commit()

    return code


def verify_registration_code(db: Session, email: str, code: str) -> bool:
    """Verify registration code and create user if valid"""
    # Get pending registration
    pending_reg = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.email == email
    ).first()

    if not pending_reg:
        return False

    # Check if expired
    if datetime.utcnow() > pending_reg.expires_at:
        db.delete(pending_reg)
        db.commit()
        return False

    # Check if code matches
    if pending_reg.code != code:
        return False

    # Code is valid - create the user account
    db_user = models.UserInformation(
        email=pending_reg.email,
        password=pending_reg.password  # Already hashed
    )
    db.add(db_user)

    # Create default categories for new user
    default_categories = ['Work', 'Study', 'Reading', 'Exercise', 'Meditation']
    for cat_name in default_categories:
        cat = models.CategoryInformation(email=pending_reg.email, category=cat_name)
        db.add(cat)

    # Delete the pending registration
    db.delete(pending_reg)
    db.commit()

    return True
