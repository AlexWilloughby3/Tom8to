from datetime import datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

import bcrypt
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import email_service, models, schemas, timezone_utils


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    # Convert password to bytes and hash it
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for storage
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash"""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ===== USER OPERATIONS =====


def get_user(db: Session, email: str) -> Optional[models.UserInformation]:
    """Get a user by email"""
    return (
        db.query(models.UserInformation)
        .filter(models.UserInformation.email == email)
        .first()
    )


def create_user(db: Session, user: schemas.UserCreate) -> models.UserInformation:
    """Create a new user with hashed password"""
    hashed_password = hash_password(user.password)
    db_user = models.UserInformation(email=user.email, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default categories for new user
    default_categories = ["Work", "Study", "Reading", "Exercise", "Meditation"]
    for cat_name in default_categories:
        cat = models.CategoryInformation(email=user.email, category=cat_name)
        db.add(cat)
    db.commit()

    return db_user


def authenticate_user(
    db: Session, email: str, password: str
) -> Optional[models.UserInformation]:
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


def update_user(
    db: Session, email: str, user_update: schemas.UserUpdate
) -> Optional[models.UserInformation]:
    """Update user settings"""
    db_user = get_user(db, email)
    if db_user:
        db_user.show_on_leaderboard = user_update.show_on_leaderboard
        db.commit()
        db.refresh(db_user)
        return db_user
    return None


# ===== FOCUS SESSION OPERATIONS =====


def create_focus_session(
    db: Session,
    email: str,
    focus_session: schemas.FocusSessionCreate,
    time: Optional[datetime] = None,
) -> models.FocusInformation:
    """Create a focus session (defaults to current time in Eastern timezone)

    If the session crosses midnight in Eastern time, it will be split into
    multiple sessions, one for each day.
    """
    if time is None:
        time = timezone_utils.get_eastern_now()

    # Auto-create category if it doesn't exist
    category_obj = get_category(db, email, focus_session.category)
    if not category_obj:
        # Check if user already has 20 categories
        category_count = (
            db.query(func.count(models.CategoryInformation.category))
            .filter(models.CategoryInformation.email == email)
            .scalar()
        )

        if category_count >= 20:
            raise ValueError("Maximum of 20 categories per user reached")

        category_obj = models.CategoryInformation(
            email=email, category=focus_session.category
        )
        db.add(category_obj)
        db.commit()

    # Calculate start time (time parameter is the END time)
    # Ensure end_time is in Eastern timezone for calculations
    if time.tzinfo is None:
        end_time = time.replace(tzinfo=timezone_utils.EASTERN)
    else:
        end_time = time.astimezone(timezone_utils.EASTERN)

    start_time = end_time - timedelta(seconds=focus_session.focus_time_seconds)

    # Split session at midnight boundaries in Eastern time
    sessions_to_create = timezone_utils.split_session_at_midnight(
        start_time, focus_session.focus_time_seconds
    )

    # Create all split sessions
    created_sessions = []
    for session_start, session_duration in sessions_to_create:
        # Session end time is start + duration
        session_end = session_start + timedelta(seconds=session_duration)

        # Convert to UTC for storage (database stores timezone-naive as UTC)
        session_end_utc = timezone_utils.eastern_to_utc(session_end)
        # Remove timezone info for database storage (store as naive UTC)
        session_end_naive = session_end_utc.replace(tzinfo=None)

        db_session = models.FocusInformation(
            email=email,
            time=session_end_naive,  # Store as naive UTC
            focus_time_seconds=session_duration,
            category=focus_session.category,
        )
        db.add(db_session)
        created_sessions.append(db_session)

    db.commit()

    # Refresh all created sessions and return the last one (closest to original end time)
    for session in created_sessions:
        db.refresh(session)

    return created_sessions[-1] if created_sessions else None


def get_focus_sessions(
    db: Session,
    email: str,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[models.FocusInformation]:
    """Get focus sessions for a user with optional filters"""
    query = db.query(models.FocusInformation).filter(
        models.FocusInformation.email == email
    )

    if category:
        query = query.filter(models.FocusInformation.category == category)
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    return (
        query.order_by(models.FocusInformation.time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_focus_session(
    db: Session, email: str, time: datetime
) -> Optional[models.FocusInformation]:
    """Get a specific focus session"""
    return (
        db.query(models.FocusInformation)
        .filter(
            models.FocusInformation.email == email, models.FocusInformation.time == time
        )
        .first()
    )


def delete_focus_session(db: Session, email: str, time: datetime) -> bool:
    """Delete a focus session"""
    db_session = get_focus_session(db, email, time)
    if db_session:
        db.delete(db_session)
        db.commit()
        return True
    return False


# ===== FOCUS GOAL OPERATIONS =====


def create_focus_goal(
    db: Session, email: str, goal: schemas.FocusGoalCreate
) -> models.FocusGoalInformation:
    """Create or update a focus goal for a category"""
    # Validation: TIME_BASED goals must have goal_time_per_week_seconds
    if goal.goal_type == "TIME_BASED" and not goal.goal_time_per_week_seconds:
        raise ValueError("TIME_BASED goals must specify goal_time_per_week_seconds")

    # Validation: Checkbox goals should have description
    if goal.goal_type in ["DAILY_CHECKBOX", "WEEKLY_CHECKBOX"] and not goal.description:
        raise ValueError("Checkbox goals should have a description")

    db_goal = get_focus_goal(db, email, goal.category, goal.goal_type)

    if db_goal:
        # Update existing goal
        if goal.goal_time_per_week_seconds is not None:
            db_goal.goal_time_per_week_seconds = goal.goal_time_per_week_seconds
        if goal.description is not None:
            db_goal.description = goal.description
    else:
        # Create new goal
        db_goal = models.FocusGoalInformation(
            email=email,
            category=goal.category,
            goal_type=goal.goal_type,
            goal_time_per_week_seconds=goal.goal_time_per_week_seconds,
            description=goal.description,
        )
        db.add(db_goal)

    db.commit()
    db.refresh(db_goal)
    return db_goal


def get_focus_goal(
    db: Session, email: str, category: str, goal_type: str
) -> Optional[models.FocusGoalInformation]:
    """Get a specific focus goal"""
    return (
        db.query(models.FocusGoalInformation)
        .filter(
            models.FocusGoalInformation.email == email,
            models.FocusGoalInformation.category == category,
            models.FocusGoalInformation.goal_type == goal_type,
        )
        .first()
    )


def get_focus_goals(db: Session, email: str) -> List[models.FocusGoalInformation]:
    """Get all focus goals for a user"""
    return (
        db.query(models.FocusGoalInformation)
        .filter(models.FocusGoalInformation.email == email)
        .all()
    )


def delete_focus_goal(db: Session, email: str, category: str, goal_type: str) -> bool:
    """Delete a focus goal"""
    db_goal = get_focus_goal(db, email, category, goal_type)
    if db_goal:
        # Also delete all associated checkbox completions if it's a checkbox goal
        if goal_type in ["DAILY_CHECKBOX", "WEEKLY_CHECKBOX"]:
            db.query(models.CheckboxGoalCompletion).filter(
                models.CheckboxGoalCompletion.email == email,
                models.CheckboxGoalCompletion.category == category,
                models.CheckboxGoalCompletion.goal_type == goal_type,
            ).delete()

        db.delete(db_goal)
        db.commit()
        return True
    return False


# ===== CHECKBOX GOAL COMPLETION OPERATIONS =====


def toggle_checkbox_completion(
    db: Session,
    email: str,
    category: str,
    goal_type: str,
    completion_date: Optional[datetime] = None,
) -> models.CheckboxGoalCompletion:
    """Toggle checkbox completion for today (daily) or this week (weekly)"""
    from datetime import timedelta

    from . import timezone_utils

    # Validate goal exists
    goal = get_focus_goal(db, email, category, goal_type)
    if not goal:
        raise ValueError(f"No {goal_type} goal found for category {category}")

    # Calculate completion_date based on goal_type
    if completion_date is None:
        now_eastern = timezone_utils.get_eastern_now()

        if goal_type == "DAILY_CHECKBOX":
            # Midnight of today in ET
            completion_date = timezone_utils.get_eastern_midnight(now_eastern)
        elif goal_type == "WEEKLY_CHECKBOX":
            # Sunday midnight of this week in ET
            week_start = timezone_utils.get_eastern_week_start(now_eastern)
            # Adjust to Sunday (week_start returns Monday, so go back 1 day)
            completion_date = week_start - timedelta(days=1)
        else:
            raise ValueError(f"Invalid goal_type for checkbox: {goal_type}")

    # Convert to UTC for storage
    completion_date_utc = timezone_utils.eastern_to_utc(completion_date).replace(
        tzinfo=None
    )

    # Check if completion already exists
    db_completion = (
        db.query(models.CheckboxGoalCompletion)
        .filter(
            models.CheckboxGoalCompletion.email == email,
            models.CheckboxGoalCompletion.category == category,
            models.CheckboxGoalCompletion.goal_type == goal_type,
            models.CheckboxGoalCompletion.completion_date == completion_date_utc,
        )
        .first()
    )

    if db_completion:
        # Toggle existing
        db_completion.completed = not db_completion.completed
        db_completion.completed_at = (
            timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
                tzinfo=None
            )
            if db_completion.completed
            else None
        )
    else:
        # Create new (mark as completed)
        db_completion = models.CheckboxGoalCompletion(
            email=email,
            category=category,
            goal_type=goal_type,
            completion_date=completion_date_utc,
            completed=True,
            completed_at=timezone_utils.eastern_to_utc(
                timezone_utils.get_eastern_now()
            ).replace(tzinfo=None),
        )
        db.add(db_completion)

    db.commit()
    db.refresh(db_completion)
    return db_completion


def get_checkbox_completions(
    db: Session,
    email: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    goal_type: Optional[str] = None,
) -> List[models.CheckboxGoalCompletion]:
    """Get checkbox completions with optional filters"""
    query = db.query(models.CheckboxGoalCompletion).filter(
        models.CheckboxGoalCompletion.email == email
    )

    if start_date:
        query = query.filter(
            models.CheckboxGoalCompletion.completion_date >= start_date
        )
    if end_date:
        query = query.filter(models.CheckboxGoalCompletion.completion_date <= end_date)
    if category:
        query = query.filter(models.CheckboxGoalCompletion.category == category)
    if goal_type:
        query = query.filter(models.CheckboxGoalCompletion.goal_type == goal_type)

    return query.order_by(models.CheckboxGoalCompletion.completion_date.desc()).all()


def get_checkbox_completion(
    db: Session, email: str, category: str, goal_type: str, completion_date: datetime
) -> Optional[models.CheckboxGoalCompletion]:
    """Get a specific checkbox completion"""
    return (
        db.query(models.CheckboxGoalCompletion)
        .filter(
            models.CheckboxGoalCompletion.email == email,
            models.CheckboxGoalCompletion.category == category,
            models.CheckboxGoalCompletion.goal_type == goal_type,
            models.CheckboxGoalCompletion.completion_date == completion_date,
        )
        .first()
    )


# ===== STATISTICS OPERATIONS =====


def get_user_stats(
    db: Session,
    email: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> schemas.UserStats:
    """Get statistics for a user"""
    # Get active categories
    active_categories = (
        db.query(models.CategoryInformation)
        .filter(
            models.CategoryInformation.email == email,
            models.CategoryInformation.active == True,
        )
        .all()
    )
    active_category_names = {cat.category for cat in active_categories}

    # Build base query for time logged
    query = db.query(
        models.FocusInformation.category,
        func.sum(models.FocusInformation.focus_time_seconds).label("total_time"),
        func.count(models.FocusInformation.time).label("session_count"),
        func.avg(models.FocusInformation.focus_time_seconds).label("avg_time"),
    ).filter(models.FocusInformation.email == email)

    # Apply date filters
    if start_date:
        query = query.filter(models.FocusInformation.time >= start_date)
    if end_date:
        query = query.filter(models.FocusInformation.time <= end_date)

    # Group by category
    category_stats = query.group_by(models.FocusInformation.category).all()

    # Get goals for active categories only
    from datetime import timedelta

    from . import timezone_utils

    all_goals = get_focus_goals(db, email)
    time_goals = {}
    checkbox_goals_by_category = {}

    for goal in all_goals:
        if goal.category not in active_category_names:
            continue

        if goal.goal_type == "TIME_BASED":
            time_goals[goal.category] = goal.goal_time_per_week_seconds
        else:
            if goal.category not in checkbox_goals_by_category:
                checkbox_goals_by_category[goal.category] = {"daily": [], "weekly": []}
            if goal.goal_type == "DAILY_CHECKBOX":
                checkbox_goals_by_category[goal.category]["daily"].append(goal)
            elif goal.goal_type == "WEEKLY_CHECKBOX":
                checkbox_goals_by_category[goal.category]["weekly"].append(goal)

    # Build time stats dict
    time_stats = {}
    for cat_stat in category_stats:
        category, total_cat_time, session_count, avg_time = cat_stat
        if category in active_category_names:  # Only include active categories
            time_stats[category] = {
                "total_time": total_cat_time or 0,
                "session_count": session_count or 0,
                "avg_time": avg_time or 0,
            }

    # Get checkbox completions for the date range
    now_eastern = timezone_utils.get_eastern_now()
    week_start_eastern = timezone_utils.get_eastern_week_start(now_eastern)
    week_start_utc = timezone_utils.eastern_to_utc(week_start_eastern).replace(
        tzinfo=None
    )

    # For daily goals, get last 7 days
    today_midnight_eastern = timezone_utils.get_eastern_midnight(now_eastern)
    seven_days_ago = today_midnight_eastern - timedelta(days=6)
    seven_days_ago_utc = timezone_utils.eastern_to_utc(seven_days_ago).replace(
        tzinfo=None
    )

    # Build response - include ALL categories with goals or time
    categories = []
    total_time = 0
    total_sessions = 0

    # Get all categories that have either time logged, time goals, or checkbox goals
    all_categories = (
        set(time_goals.keys())
        | set(time_stats.keys())
        | set(checkbox_goals_by_category.keys())
    )

    for category in all_categories:
        stats = time_stats.get(
            category, {"total_time": 0, "session_count": 0, "avg_time": 0}
        )
        total_cat_time = stats["total_time"]
        session_count = stats["session_count"]
        avg_time = stats["avg_time"]
        goal_time = time_goals.get(category)

        total_time += total_cat_time
        total_sessions += session_count

        progress = None
        if goal_time and goal_time > 0:
            progress = (total_cat_time / goal_time) * 100

        # Get checkbox goals data for this category
        daily_checkbox_data = []
        weekly_checkbox_data = []

        if category in checkbox_goals_by_category:
            # Process daily goals
            for daily_goal in checkbox_goals_by_category[category]["daily"]:
                completions = (
                    db.query(models.CheckboxGoalCompletion)
                    .filter(
                        models.CheckboxGoalCompletion.email == email,
                        models.CheckboxGoalCompletion.category == category,
                        models.CheckboxGoalCompletion.goal_type == "DAILY_CHECKBOX",
                        models.CheckboxGoalCompletion.completion_date
                        >= seven_days_ago_utc,
                    )
                    .all()
                )

                daily_checkbox_data.append(
                    {
                        "description": daily_goal.description,
                        "completions": [
                            {
                                "date": timezone_utils.utc_to_eastern(c.completion_date)
                                .date()
                                .isoformat(),
                                "completed": c.completed,
                            }
                            for c in completions
                        ],
                    }
                )

            # Process weekly goals
            for weekly_goal in checkbox_goals_by_category[category]["weekly"]:
                # Adjust week_start_utc to Sunday (it currently returns Monday)
                sunday_midnight = week_start_utc - timedelta(days=1)
                completion = (
                    db.query(models.CheckboxGoalCompletion)
                    .filter(
                        models.CheckboxGoalCompletion.email == email,
                        models.CheckboxGoalCompletion.category == category,
                        models.CheckboxGoalCompletion.goal_type == "WEEKLY_CHECKBOX",
                        models.CheckboxGoalCompletion.completion_date
                        == sunday_midnight,
                    )
                    .first()
                )

                weekly_checkbox_data.append(
                    {
                        "description": weekly_goal.description,
                        "completed": completion.completed if completion else False,
                    }
                )

        categories.append(
            schemas.CategoryStats(
                category=category,
                total_time_seconds=total_cat_time,
                session_count=session_count,
                average_time_seconds=avg_time,
                goal_time_per_week_seconds=goal_time,
                progress_percentage=progress,
                daily_checkbox_goals=daily_checkbox_data,
                weekly_checkbox_goals=weekly_checkbox_data,
            )
        )

    return schemas.UserStats(
        email=email,
        total_focus_time_seconds=total_time,
        total_sessions=total_sessions,
        categories=categories,
    )


# ===== CATEGORY OPERATIONS =====


def create_category(
    db: Session, email: str, category: schemas.CategoryCreate
) -> models.CategoryInformation:
    """Create a new category for a user (max 20 categories per user)"""
    db_category = get_category(db, email, category.category)

    if db_category:
        # Category already exists, just return it
        return db_category

    # Check if user already has 20 categories
    category_count = (
        db.query(func.count(models.CategoryInformation.category))
        .filter(models.CategoryInformation.email == email)
        .scalar()
    )

    if category_count >= 20:
        raise ValueError("Maximum of 20 categories per user reached")

    # Create new category
    db_category = models.CategoryInformation(email=email, category=category.category)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_category(
    db: Session, email: str, category: str
) -> Optional[models.CategoryInformation]:
    """Get a specific category"""
    return (
        db.query(models.CategoryInformation)
        .filter(
            models.CategoryInformation.email == email,
            models.CategoryInformation.category == category,
        )
        .first()
    )


def get_categories(db: Session, email: str) -> List[models.CategoryInformation]:
    """Get all categories for a user"""
    return (
        db.query(models.CategoryInformation)
        .filter(models.CategoryInformation.email == email)
        .order_by(models.CategoryInformation.category)
        .all()
    )


def update_category(
    db: Session, email: str, category: str, active: bool
) -> Optional[models.CategoryInformation]:
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
            models.FocusGoalInformation.category == category,
        ).delete()

        # Delete all focus sessions for this category
        db.query(models.FocusInformation).filter(
            models.FocusInformation.email == email,
            models.FocusInformation.category == category,
        ).delete()

        # Delete the category itself
        db.delete(db_category)
        db.commit()
        return True
    return False


def rename_category(
    db: Session,
    email: str,
    old_category: str,
    new_category: str,
    confirm_merge: bool = False,
) -> dict:
    """
    Rename a category or merge it into an existing category.

    Returns a dict with:
    - requires_merge: bool - True if target exists and merge needed
    - target_exists: bool - True if target category exists
    - message: str - Description of action
    - success: bool - True if rename/merge completed (only if confirm_merge=True)

    Args:
        db: Database session
        email: User email
        old_category: Current category name
        new_category: New category name
        confirm_merge: If True and target exists, perform merge. If False, return merge info.

    Raises:
        ValueError: If validation fails or category doesn't exist
    """
    # Validation
    if not new_category.strip():
        raise ValueError("New category name cannot be empty")

    if len(new_category) > 50:
        raise ValueError("Category name cannot exceed 50 characters")

    if old_category == new_category:
        raise ValueError("New category name must be different from current name")

    # Check if source category exists
    source_category = get_category(db, email, old_category)
    if not source_category:
        raise ValueError(f"Category '{old_category}' not found")

    # Check if target category exists
    target_category = get_category(db, email, new_category)

    # Case 1: Target doesn't exist - simple rename
    if not target_category:
        if not confirm_merge:
            # Just return info, no action yet
            return {
                "requires_merge": False,
                "target_exists": False,
                "message": f"Category will be renamed from '{old_category}' to '{new_category}'",
                "success": False,
            }

        # Perform simple rename using transaction
        try:
            # Update all FocusInformation records
            db.query(models.FocusInformation).filter(
                models.FocusInformation.email == email,
                models.FocusInformation.category == old_category,
            ).update({"category": new_category}, synchronize_session=False)

            # Handle FocusGoalInformation if exists (category is part of PK, so need to delete and recreate)
            goal = get_focus_goal(db, email, old_category)
            if goal:
                old_goal_value = goal.goal_time_per_week_seconds
                db.delete(goal)
                db.flush()  # Ensure deletion before insert

                new_goal = models.FocusGoalInformation(
                    email=email,
                    category=new_category,
                    goal_time_per_week_seconds=old_goal_value,
                )
                db.add(new_goal)

            # Update CategoryInformation (category is part of PK, so need to delete and recreate)
            old_active = source_category.active
            db.delete(source_category)
            db.flush()

            new_category_obj = models.CategoryInformation(
                email=email, category=new_category, active=old_active
            )
            db.add(new_category_obj)

            db.commit()

            return {
                "requires_merge": False,
                "target_exists": False,
                "message": f"Category renamed from '{old_category}' to '{new_category}'",
                "success": True,
            }

        except Exception as e:
            db.rollback()
            raise ValueError(f"Failed to rename category: {str(e)}")

    # Case 2: Target exists - merge required
    if not confirm_merge:
        # Return merge confirmation request
        return {
            "requires_merge": True,
            "target_exists": True,
            "message": f"Category '{new_category}' already exists. All focus sessions from '{old_category}' will be moved to '{new_category}'. The goal for '{old_category}' will be discarded, keeping '{new_category}' goal.",
            "success": False,
        }

    # Perform merge with transaction
    try:
        # Step 1: Move all focus sessions from old to new category
        db.query(models.FocusInformation).filter(
            models.FocusInformation.email == email,
            models.FocusInformation.category == old_category,
        ).update({"category": new_category}, synchronize_session=False)

        # Step 2: Delete old category's goal (keep target's goal as per requirements)
        old_goal = get_focus_goal(db, email, old_category)
        if old_goal:
            db.delete(old_goal)

        # Step 3: Delete old category from CategoryInformation
        db.delete(source_category)

        db.commit()

        return {
            "requires_merge": True,
            "target_exists": True,
            "message": f"Successfully merged '{old_category}' into '{new_category}'",
            "success": True,
        }

    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to merge categories: {str(e)}")


# ===== GRAPH DATA OPERATIONS =====


def get_graph_data(
    db: Session,
    email: str,
    time_range: str,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> schemas.GraphData:
    """Get focus session data for graphing over a time period

    Args:
        db: Database session
        email: User email
        time_range: 'week', 'month', '6month', 'ytd', or 'custom'
        category: Optional category filter
        start_date: Optional start date for custom range (YYYY-MM-DD format in Eastern Time)
        end_date: Optional end date for custom range (YYYY-MM-DD format in Eastern Time)
    """
    from datetime import datetime, timedelta

    from sqlalchemy import func

    # Calculate date ranges in Eastern Time
    today_eastern = timezone_utils.get_eastern_now().replace(
        hour=23, minute=59, second=59, microsecond=999999
    )

    if time_range == "custom":
        if not start_date or not end_date:
            raise ValueError(
                "start_date and end_date are required for custom time range"
            )

        # Parse dates as Eastern Time (YYYY-MM-DD format)
        try:
            start_parts = start_date.split("-")
            end_parts = end_date.split("-")
            start_date_eastern = datetime(
                int(start_parts[0]),
                int(start_parts[1]),
                int(start_parts[2]),
                0,
                0,
                0,
                0,
                tzinfo=timezone_utils.EASTERN,
            )
            end_date_eastern = datetime(
                int(end_parts[0]),
                int(end_parts[1]),
                int(end_parts[2]),
                23,
                59,
                59,
                999999,
                tzinfo=timezone_utils.EASTERN,
            )
        except (ValueError, IndexError):
            raise ValueError("Invalid date format. Use YYYY-MM-DD")

        # Determine if we should group by week based on date range
        days_diff = (end_date_eastern - start_date_eastern).days
        group_by_week = days_diff > 60  # Group by week if more than 60 days

    elif time_range == "week":
        start_date_eastern = today_eastern - timedelta(days=6)  # Last 7 days
        end_date_eastern = today_eastern
        group_by_week = False
    elif time_range == "month":
        start_date_eastern = today_eastern - timedelta(days=29)  # Last 30 days
        end_date_eastern = today_eastern
        group_by_week = False
    elif time_range == "6month":
        start_date_eastern = today_eastern - timedelta(days=179)  # Last 180 days
        end_date_eastern = today_eastern
        group_by_week = True
    elif time_range == "ytd":
        start_date_eastern = datetime(
            today_eastern.year, 1, 1, 0, 0, 0, 0, tzinfo=timezone_utils.EASTERN
        )  # Start of year at midnight
        end_date_eastern = today_eastern
        # Group by week only if more than 60 days have passed
        days_since_year_start = (end_date_eastern - start_date_eastern).days
        group_by_week = days_since_year_start > 60
    else:
        raise ValueError(f"Invalid time_range: {time_range}")

    # Convert to UTC for database query (database stores as naive UTC)
    start_date_utc = timezone_utils.eastern_to_utc(start_date_eastern).replace(
        tzinfo=None
    )
    end_date_utc = timezone_utils.eastern_to_utc(end_date_eastern).replace(tzinfo=None)

    # Query focus sessions
    query = db.query(models.FocusInformation).filter(
        models.FocusInformation.email == email,
        models.FocusInformation.time >= start_date_utc,
        models.FocusInformation.time <= end_date_utc,
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
            # Convert to Eastern time and get Monday of the week
            # Database stores as naive UTC, so we need to add UTC timezone then convert to Eastern
            if session.time.tzinfo:
                eastern_time = timezone_utils.utc_to_eastern(session.time)
            else:
                # Treat naive datetime as UTC, add timezone, then convert to Eastern
                utc_time = session.time.replace(tzinfo=ZoneInfo("UTC"))
                eastern_time = utc_time.astimezone(timezone_utils.EASTERN)
            week_start = timezone_utils.get_eastern_week_start(eastern_time)
            week_key = week_start.strftime("%Y-%m-%d")

            if week_key not in data_dict:
                data_dict[week_key] = 0
            data_dict[week_key] += session.focus_time_seconds
    else:
        # Group by day
        for session in sessions:
            # Convert to Eastern time for consistent day boundaries
            # Database stores as naive UTC, so we need to add UTC timezone then convert to Eastern
            if session.time.tzinfo:
                eastern_time = timezone_utils.utc_to_eastern(session.time)
            else:
                # Treat naive datetime as UTC, add timezone, then convert to Eastern
                utc_time = session.time.replace(tzinfo=ZoneInfo("UTC"))
                eastern_time = utc_time.astimezone(timezone_utils.EASTERN)
            day_key = eastern_time.strftime("%Y-%m-%d")

            if day_key not in data_dict:
                data_dict[day_key] = 0
            data_dict[day_key] += session.focus_time_seconds

    # Fill in missing dates with 0
    current = start_date_eastern.replace(hour=0, minute=0, second=0, microsecond=0)
    filled_data = {}

    if group_by_week:
        # Fill weeks - start from the Monday of the week containing start_date_eastern
        first_week_start = timezone_utils.get_eastern_week_start(current)
        current = first_week_start

        while current <= end_date_eastern:
            week_key = current.strftime("%Y-%m-%d")
            filled_data[week_key] = data_dict.get(week_key, 0)
            current += timedelta(days=7)
    else:
        # Fill days
        while current <= end_date_eastern:
            day_key = current.strftime("%Y-%m-%d")
            filled_data[day_key] = data_dict.get(day_key, 0)
            current += timedelta(days=1)

    # Convert to list of data points
    data_points = [
        schemas.GraphDataPoint(date=date, focus_time_seconds=seconds)
        for date, seconds in sorted(filled_data.items())
    ]

    return schemas.GraphData(
        data_points=data_points, time_range=time_range, category=category
    )


# ===== VERIFICATION CODE OPERATIONS =====


def get_verification_code(db: Session, email: str) -> Optional[models.VerificationCode]:
    """Get verification code for an email"""
    return (
        db.query(models.VerificationCode)
        .filter(models.VerificationCode.email == email)
        .first()
    )


def create_verification_code(db: Session, email: str) -> str:
    """Generate and store verification code, return code for emailing"""
    code = email_service.generate_6_digit_code()
    expires_at = email_service.get_code_expiry()

    # Upsert (replace existing code if present)
    now_utc = timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
        tzinfo=None
    )

    db_code = get_verification_code(db, email)
    if db_code:
        db_code.code = code
        db_code.created_at = now_utc
        db_code.expires_at = expires_at
    else:
        db_code = models.VerificationCode(
            email=email, code=code, created_at=now_utc, expires_at=expires_at
        )
        db.add(db_code)

    db.commit()
    return code


def verify_code(db: Session, email: str, code: str) -> bool:
    """Verify code is correct and not expired"""
    db_code = get_verification_code(db, email)
    if not db_code:
        return False

    # Check expiry (compare naive UTC times)
    now_utc = timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
        tzinfo=None
    )
    if now_utc > db_code.expires_at:
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


def change_password(
    db: Session, email: str, current_password: str, new_password: str
) -> bool:
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
    now_eastern = timezone_utils.get_eastern_now()
    now_utc = timezone_utils.eastern_to_utc(now_eastern).replace(tzinfo=None)
    expires_at = now_utc + timedelta(hours=1)  # Token expires in 1 hour

    db_token = models.PasswordResetToken(
        token=token, email=email, created_at=now_utc, expires_at=expires_at, used=0
    )
    db.add(db_token)
    db.commit()
    return token


def reset_password_with_token(db: Session, token: str, new_password: str) -> bool:
    """Reset password using a valid token"""
    db_token = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token == token)
        .first()
    )

    if not db_token:
        return False

    # Check if token is expired (compare naive UTC times)
    now_utc = timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
        tzinfo=None
    )
    if now_utc > db_token.expires_at:
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

    # Convert to naive UTC for storage
    now_utc = timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
        tzinfo=None
    )

    # Create new pending registration
    pending_reg = models.PendingRegistration(
        email=email,
        password=hashed_password,
        code=code,
        created_at=now_utc,
        expires_at=expires_at,
    )
    db.add(pending_reg)
    db.commit()

    return code


def verify_registration_code(db: Session, email: str, code: str) -> bool:
    """Verify registration code and create user if valid"""
    # Get pending registration
    pending_reg = (
        db.query(models.PendingRegistration)
        .filter(models.PendingRegistration.email == email)
        .first()
    )

    if not pending_reg:
        return False

    # Check if expired (compare naive UTC times)
    now_utc = timezone_utils.eastern_to_utc(timezone_utils.get_eastern_now()).replace(
        tzinfo=None
    )
    if now_utc > pending_reg.expires_at:
        db.delete(pending_reg)
        db.commit()
        return False

    # Check if code matches
    if pending_reg.code != code:
        return False

    # Code is valid - create the user account
    db_user = models.UserInformation(
        email=pending_reg.email,
        password=pending_reg.password,  # Already hashed
    )
    db.add(db_user)

    # Create default categories for new user
    default_categories = ["Work", "Study", "Reading", "Exercise", "Meditation"]
    for cat_name in default_categories:
        cat = models.CategoryInformation(email=pending_reg.email, category=cat_name)
        db.add(cat)

    # Delete the pending registration
    db.delete(pending_reg)
    db.commit()

    return True


# ===== LEADERBOARD OPERATIONS =====


def get_leaderboard_data(db: Session) -> List[schemas.LeaderboardEntry]:
    """Get leaderboard data for all users who have opted in"""
    # Get all users who have opted in to leaderboard
    users = (
        db.query(models.UserInformation)
        .filter(models.UserInformation.show_on_leaderboard == True)
        .all()
    )

    leaderboard = []

    # Calculate start of current week (Monday) in Eastern Time, then convert to UTC for database comparison
    week_start_eastern = timezone_utils.get_eastern_week_start()
    week_start_utc = timezone_utils.eastern_to_utc(week_start_eastern).replace(
        tzinfo=None
    )

    for user in users:
        email = user.email

        # Get focus hours this week
        week_sessions = (
            db.query(func.sum(models.FocusInformation.focus_time_seconds))
            .filter(
                models.FocusInformation.email == email,
                models.FocusInformation.time >= week_start_utc,
            )
            .scalar()
            or 0
        )

        focus_hours_this_week = week_sessions / 3600.0

        # Get focus hours all time
        all_time_sessions = (
            db.query(func.sum(models.FocusInformation.focus_time_seconds))
            .filter(models.FocusInformation.email == email)
            .scalar()
            or 0
        )

        focus_hours_all_time = all_time_sessions / 3600.0

        # Get goals this week
        active_categories = (
            db.query(models.CategoryInformation)
            .filter(
                models.CategoryInformation.email == email,
                models.CategoryInformation.active == True,
            )
            .all()
        )
        active_category_names = {cat.category for cat in active_categories}

        # Get all goals for active categories
        goals = (
            db.query(models.FocusGoalInformation)
            .filter(models.FocusGoalInformation.email == email)
            .all()
        )

        goals_this_week = [g for g in goals if g.category in active_category_names]
        total_goals_this_week = len(goals_this_week)

        # Calculate goals completed this week (TIME_BASED only)
        goals_completed_this_week = 0
        time_goals_this_week = [
            g for g in goals_this_week if g.goal_type == "TIME_BASED"
        ]
        total_goals_this_week = len(
            time_goals_this_week
        )  # Update to count only TIME_BASED

        for goal in time_goals_this_week:
            time_logged = (
                db.query(func.sum(models.FocusInformation.focus_time_seconds))
                .filter(
                    models.FocusInformation.email == email,
                    models.FocusInformation.category == goal.category,
                    models.FocusInformation.time >= week_start_utc,
                )
                .scalar()
                or 0
            )

            if (
                goal.goal_time_per_week_seconds
                and time_logged >= goal.goal_time_per_week_seconds
            ):
                goals_completed_this_week += 1

        # Calculate checkbox goal completions this week
        from datetime import timedelta

        daily_checkbox_goals = [
            g for g in goals_this_week if g.goal_type == "DAILY_CHECKBOX"
        ]
        weekly_checkbox_goals = [
            g for g in goals_this_week if g.goal_type == "WEEKLY_CHECKBOX"
        ]

        total_daily_goals = len(daily_checkbox_goals)
        total_weekly_goals = len(weekly_checkbox_goals)

        # Count daily completions this week (7 days × number of daily goals)
        daily_goals_completed = 0
        week_start_eastern = timezone_utils.utc_to_eastern(week_start_utc)

        for goal in daily_checkbox_goals:
            # Check each of the last 7 days
            for i in range(7):
                day_midnight = week_start_eastern + timedelta(days=i)
                day_midnight_utc = timezone_utils.eastern_to_utc(day_midnight).replace(
                    tzinfo=None
                )

                completion = (
                    db.query(models.CheckboxGoalCompletion)
                    .filter(
                        models.CheckboxGoalCompletion.email == email,
                        models.CheckboxGoalCompletion.category == goal.category,
                        models.CheckboxGoalCompletion.goal_type == "DAILY_CHECKBOX",
                        models.CheckboxGoalCompletion.completion_date
                        == day_midnight_utc,
                        models.CheckboxGoalCompletion.completed == True,
                    )
                    .first()
                )
                if completion:
                    daily_goals_completed += 1

        # Count weekly completions this week
        weekly_goals_completed = 0
        # Adjust to Sunday midnight (week_start_utc is Monday)
        sunday_midnight_utc = week_start_utc - timedelta(days=1)

        for goal in weekly_checkbox_goals:
            completion = (
                db.query(models.CheckboxGoalCompletion)
                .filter(
                    models.CheckboxGoalCompletion.email == email,
                    models.CheckboxGoalCompletion.category == goal.category,
                    models.CheckboxGoalCompletion.goal_type == "WEEKLY_CHECKBOX",
                    models.CheckboxGoalCompletion.completion_date
                    == sunday_midnight_utc,
                    models.CheckboxGoalCompletion.completed == True,
                )
                .first()
            )
            if completion:
                weekly_goals_completed += 1

        # Calculate goals completed all time (simplified - based on last completed week)
        # We'll count how many goals were completed in their best week
        goals_completed_all_time = 0

        # Get all historical goals (not just active ones)
        all_time_goals = (
            db.query(models.FocusGoalInformation)
            .filter(models.FocusGoalInformation.email == email)
            .all()
        )

        # For each goal, check if it was ever completed
        for goal in all_time_goals:
            if goal.goal_type == "TIME_BASED":
                # Get all sessions for this category
                sessions = (
                    db.query(models.FocusInformation)
                    .filter(
                        models.FocusInformation.email == email,
                        models.FocusInformation.category == goal.category,
                    )
                    .all()
                )

                # Group by week and check if goal was met in any week
                weekly_totals = {}
                for session in sessions:
                    # Convert session time to Eastern and get week start
                    eastern_time = (
                        timezone_utils.utc_to_eastern(session.time)
                        if session.time.tzinfo
                        else session.time.replace(tzinfo=timezone_utils.EASTERN)
                    )
                    week_start_date = timezone_utils.get_eastern_week_start(
                        eastern_time
                    )
                    week_key = week_start_date.date()
                    if week_key not in weekly_totals:
                        weekly_totals[week_key] = 0
                    weekly_totals[week_key] += session.focus_time_seconds

                # Check if goal was met in any week
                if goal.goal_time_per_week_seconds:
                    for week_total in weekly_totals.values():
                        if week_total >= goal.goal_time_per_week_seconds:
                            goals_completed_all_time += 1
                            break  # Count this goal once

            elif goal.goal_type == "DAILY_CHECKBOX":
                # Check if this daily goal was ever completed on any day
                completion = (
                    db.query(models.CheckboxGoalCompletion)
                    .filter(
                        models.CheckboxGoalCompletion.email == email,
                        models.CheckboxGoalCompletion.category == goal.category,
                        models.CheckboxGoalCompletion.goal_type == "DAILY_CHECKBOX",
                        models.CheckboxGoalCompletion.completed == True,
                    )
                    .first()
                )
                if completion:
                    goals_completed_all_time += 1

            elif goal.goal_type == "WEEKLY_CHECKBOX":
                # Check if this weekly goal was ever completed on any week
                completion = (
                    db.query(models.CheckboxGoalCompletion)
                    .filter(
                        models.CheckboxGoalCompletion.email == email,
                        models.CheckboxGoalCompletion.category == goal.category,
                        models.CheckboxGoalCompletion.goal_type == "WEEKLY_CHECKBOX",
                        models.CheckboxGoalCompletion.completed == True,
                    )
                    .first()
                )
                if completion:
                    goals_completed_all_time += 1

        leaderboard.append(
            schemas.LeaderboardEntry(
                email=email,
                focus_hours_this_week=round(focus_hours_this_week, 2),
                focus_hours_all_time=round(focus_hours_all_time, 2),
                goals_completed_this_week=goals_completed_this_week,
                total_goals_this_week=total_goals_this_week,
                goals_completed_all_time=goals_completed_all_time,
                daily_goals_completed_this_week=daily_goals_completed,
                total_daily_goals_this_week=total_daily_goals * 7,  # 7 days worth
                weekly_goals_completed_this_week=weekly_goals_completed,
                total_weekly_goals_this_week=total_weekly_goals,
            )
        )

    # Sort by focus hours this week (descending)
    leaderboard.sort(key=lambda x: x.focus_hours_this_week, reverse=True)

    return leaderboard


# ===== DATA EXPORT/IMPORT OPERATIONS =====


def export_user_data(db: Session, email: str) -> schemas.UserDataExport:
    """Export all user data (categories, goals, sessions) as JSON"""
    # Get all categories
    categories = (
        db.query(models.CategoryInformation)
        .filter(models.CategoryInformation.email == email)
        .all()
    )

    exported_categories = [
        schemas.ExportedCategory(category=cat.category, active=cat.active)
        for cat in categories
    ]

    # Get all goals
    goals = (
        db.query(models.FocusGoalInformation)
        .filter(models.FocusGoalInformation.email == email)
        .all()
    )

    exported_goals = [
        schemas.ExportedGoal(
            category=goal.category,
            goal_time_per_week_seconds=goal.goal_time_per_week_seconds,
        )
        for goal in goals
    ]

    # Get all focus sessions
    sessions = (
        db.query(models.FocusInformation)
        .filter(models.FocusInformation.email == email)
        .order_by(models.FocusInformation.time)
        .all()
    )

    exported_sessions = [
        schemas.ExportedSession(
            time=session.time.isoformat() if session.time else "",
            focus_time_seconds=session.focus_time_seconds,
            category=session.category,
        )
        for session in sessions
    ]

    # Get current time in Eastern Time for export timestamp
    export_time = timezone_utils.get_eastern_now()

    return schemas.UserDataExport(
        version="1.0",
        export_date=export_time.isoformat(),
        categories=exported_categories,
        goals=exported_goals,
        sessions=exported_sessions,
    )


def import_user_data(
    db: Session, email: str, import_data: schemas.UserDataImport
) -> schemas.ImportResult:
    """Import user data, replacing existing data where conflicts occur"""
    categories_imported = 0
    goals_imported = 0
    sessions_imported = 0

    try:
        # Import categories (update if exists, create if not)
        for cat_data in import_data.categories:
            existing_cat = get_category(db, email, cat_data.category)
            if existing_cat:
                # Update existing category
                existing_cat.active = cat_data.active
                categories_imported += 1
            else:
                # Create new category
                new_cat = models.CategoryInformation(
                    email=email, category=cat_data.category, active=cat_data.active
                )
                db.add(new_cat)
                categories_imported += 1

        db.flush()  # Flush to ensure categories exist before adding goals

        # Import goals (replace existing goals)
        for goal_data in import_data.goals:
            existing_goal = get_focus_goal(db, email, goal_data.category)
            if existing_goal:
                # Update existing goal
                existing_goal.goal_time_per_week_seconds = (
                    goal_data.goal_time_per_week_seconds
                )
                goals_imported += 1
            else:
                # Create new goal (only if category exists)
                cat_exists = get_category(db, email, goal_data.category)
                if cat_exists:
                    new_goal = models.FocusGoalInformation(
                        email=email,
                        category=goal_data.category,
                        goal_time_per_week_seconds=goal_data.goal_time_per_week_seconds,
                    )
                    db.add(new_goal)
                    goals_imported += 1

        db.flush()

        # Import sessions (add all sessions, no replacement)
        for session_data in import_data.sessions:
            # Parse ISO format datetime string
            try:
                session_time = datetime.fromisoformat(
                    session_data.time.replace("Z", "+00:00")
                )
                # Remove timezone info for storage (store as naive UTC)
                if session_time.tzinfo:
                    session_time = session_time.replace(tzinfo=None)
            except (ValueError, AttributeError):
                # Skip sessions with invalid timestamps
                continue

            # Ensure category exists before adding session
            cat_exists = get_category(db, email, session_data.category)
            if not cat_exists:
                # Auto-create category if it doesn't exist
                new_cat = models.CategoryInformation(
                    email=email, category=session_data.category, active=True
                )
                db.add(new_cat)
                db.flush()

            new_session = models.FocusInformation(
                email=email,
                time=session_time,
                focus_time_seconds=session_data.focus_time_seconds,
                category=session_data.category,
            )
            db.add(new_session)
            sessions_imported += 1

        db.commit()

        return schemas.ImportResult(
            categories_imported=categories_imported,
            goals_imported=goals_imported,
            sessions_imported=sessions_imported,
            message=f"Successfully imported {categories_imported} categories, {goals_imported} goals, and {sessions_imported} sessions",
        )

    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to import data: {str(e)}")
