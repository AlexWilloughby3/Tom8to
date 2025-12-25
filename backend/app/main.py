from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from . import models, schemas, crud
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Focus Tracker API",
    description="FastAPI backend for focus time tracking application",
    version="1.0.0"
)

# Configure CORS - Update origins with your GitHub Pages URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "https://alexwilloughby3.github.io",
        # Production domain(s)
        "http://alex-ware.com",
        "https://alex-ware.com",
        "http://www.alex-ware.com",
        "https://www.alex-ware.com",
        # Subdomain for this deployment
        "http://tomato.alex-ware.com",
        "https://tomato.alex-ware.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== HEALTH CHECK ENDPOINTS =====

@app.get("/")
def read_root():
    """Root endpoint - health check"""
    return {
        "message": "Welcome to the Focus Tracker API",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/api/health")
def health_check():
    """API health chek endpoint"""
    return {"status": "healthy"}


# ===== USER ENDPOINTS =====

@app.post("/api/users/register", response_model=schemas.User, status_code=201)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    db_user = crud.get_user(db, userid=user.userid)
    if db_user:
        raise HTTPException(status_code=400, detail="User ID already exists")
    return crud.create_user(db=db, user=user)


@app.post("/api/users/login", response_model=schemas.User)
def login_user(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user and verify credentials"""
    user = crud.authenticate_user(db, userid=credentials.userid, password=credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


@app.get("/api/users/{userid}", response_model=schemas.User)
def get_user(userid: str, db: Session = Depends(get_db)):
    """Get user information"""
    db_user = crud.get_user(db, userid=userid)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.delete("/api/users/{userid}", status_code=204)
def delete_user(userid: str, db: Session = Depends(get_db)):
    """Delete a user and all their data"""
    success = crud.delete_user(db, userid=userid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return None


# ===== FOCUS SESSION ENDPOINTS =====

@app.post("/api/users/{userid}/focus-sessions", response_model=schemas.FocusSession, status_code=201)
def create_focus_session(
    userid: str,
    focus_session: schemas.FocusSessionCreate,
    db: Session = Depends(get_db)
):
    """
    Create a focus session for a user.
    The timestamp will be set to the current time.
    Use this when the user completes a focus session.
    """
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.create_focus_session(db=db, userid=userid, focus_session=focus_session)


@app.post("/api/users/{userid}/focus-sessions/with-time", response_model=schemas.FocusSession, status_code=201)
def create_focus_session_with_time(
    userid: str,
    focus_session: schemas.FocusSessionCreateWithTime,
    db: Session = Depends(get_db)
):
    """
    Create a focus session with a specific timestamp.
    Use this for manual entry or importing historical data.
    """
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.create_focus_session(
        db=db,
        userid=userid,
        focus_session=focus_session,
        time=focus_session.time
    )


@app.get("/api/users/{userid}/focus-sessions", response_model=List[schemas.FocusSession])
def get_focus_sessions(
    userid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Get focus sessions for a user with optional filters.
    - category: Filter by specific category
    - start_date: Filter sessions after this date
    - end_date: Filter sessions before this date
    """
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_focus_sessions(
        db=db,
        userid=userid,
        skip=skip,
        limit=limit,
        category=category,
        start_date=start_date,
        end_date=end_date
    )


@app.delete("/api/users/{userid}/focus-sessions/{timestamp}", status_code=204)
def delete_focus_session(
    userid: str,
    timestamp: datetime,
    db: Session = Depends(get_db)
):
    """Delete a specific focus session"""
    success = crud.delete_focus_session(db, userid=userid, time=timestamp)
    if not success:
        raise HTTPException(status_code=404, detail="Focus session not found")
    return None


# ===== FOCUS GOAL ENDPOINTS =====

@app.post("/api/users/{userid}/focus-goals", response_model=schemas.FocusGoal, status_code=201)
def create_focus_goal(
    userid: str,
    goal: schemas.FocusGoalCreate,
    db: Session = Depends(get_db)
):
    """Create or update a focus goal for a category"""
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.create_focus_goal(db=db, userid=userid, goal=goal)


@app.get("/api/users/{userid}/focus-goals", response_model=List[schemas.FocusGoal])
def get_focus_goals(userid: str, db: Session = Depends(get_db)):
    """Get all focus goals for a user"""
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_focus_goals(db=db, userid=userid)


@app.get("/api/users/{userid}/focus-goals/{category}", response_model=schemas.FocusGoal)
def get_focus_goal(userid: str, category: str, db: Session = Depends(get_db)):
    """Get a specific focus goal"""
    db_goal = crud.get_focus_goal(db, userid=userid, category=category)
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Focus goal not found")
    return db_goal


@app.delete("/api/users/{userid}/focus-goals/{category}", status_code=204)
def delete_focus_goal(userid: str, category: str, db: Session = Depends(get_db)):
    """Delete a focus goal"""
    success = crud.delete_focus_goal(db, userid=userid, category=category)
    if not success:
        raise HTTPException(status_code=404, detail="Focus goal not found")
    return None


# ===== STATISTICS ENDPOINTS =====

@app.get("/api/users/{userid}/stats", response_model=schemas.UserStats)
def get_user_stats(
    userid: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Get statistics for a user's focus sessions.
    - start_date: Calculate stats from this date
    - end_date: Calculate stats until this date
    """
    # Verify user exists
    user = crud.get_user(db, userid=userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_user_stats(
        db=db,
        userid=userid,
        start_date=start_date,
        end_date=end_date
    )


@app.get("/api/users/{userid}/stats/weekly", response_model=schemas.UserStats)
def get_weekly_stats(userid: str, db: Session = Depends(get_db)):
    """Get statistics for the current week"""
    # Calculate start of current week (Monday)
    today = datetime.utcnow()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    return crud.get_user_stats(
        db=db,
        userid=userid,
        start_date=start_of_week,
        end_date=today
    )
