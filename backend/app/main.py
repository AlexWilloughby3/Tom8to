from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta

from . import models, schemas, crud, email_service
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

@app.post("/api/users/register", status_code=200)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Initiate user registration by sending verification code to email"""
    # Check if email is already registered
    db_user = crud.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check account limit (maximum 50 accounts)
    user_count = db.query(func.count(models.UserInformation.email)).scalar()
    if user_count >= 50:
        raise HTTPException(status_code=403, detail="Account limit reached. Registration is currently unavailable.")

    # Create pending registration and generate code
    code = crud.create_pending_registration(db, email=user.email, password=user.password)

    # Send verification email
    email_sent = email_service.send_verification_code(user.email, code)
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    return {"message": "Verification code sent to email. Please check your inbox."}


@app.post("/api/users/login", response_model=schemas.User)
def login_user(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user and verify credentials"""
    user = crud.authenticate_user(db, email=credentials.email, password=credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user


@app.get("/api/users/{email}", response_model=schemas.User)
def get_user(email: str, db: Session = Depends(get_db)):
    """Get user information"""
    db_user = crud.get_user(db, email=email)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.delete("/api/users/{email}", status_code=204)
def delete_user(email: str, db: Session = Depends(get_db)):
    """Delete a user and all their data"""
    success = crud.delete_user(db, email=email)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return None


# ===== FOCUS SESSION ENDPOINTS =====

@app.post("/api/users/{email}/focus-sessions", response_model=schemas.FocusSession, status_code=201)
def create_focus_session(
    email: str,
    focus_session: schemas.FocusSessionCreate,
    db: Session = Depends(get_db)
):
    """
    Create a focus session for a user.
    The timestamp will be set to the current time.
    Use this when the user completes a focus session.
    """
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        return crud.create_focus_session(db=db, email=email, focus_session=focus_session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/{email}/focus-sessions/with-time", response_model=schemas.FocusSession, status_code=201)
def create_focus_session_with_time(
    email: str,
    focus_session: schemas.FocusSessionCreateWithTime,
    db: Session = Depends(get_db)
):
    """
    Create a focus session with a specific timestamp.
    Use this for manual entry or importing historical data.
    """
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        return crud.create_focus_session(
            db=db,
            email=email,
            focus_session=focus_session,
            time=focus_session.time
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/users/{email}/focus-sessions", response_model=List[schemas.FocusSession])
def get_focus_sessions(
    email: str,
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
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_focus_sessions(
        db=db,
        email=email,
        skip=skip,
        limit=limit,
        category=category,
        start_date=start_date,
        end_date=end_date
    )


@app.delete("/api/users/{email}/focus-sessions/{timestamp}", status_code=204)
def delete_focus_session(
    email: str,
    timestamp: datetime,
    db: Session = Depends(get_db)
):
    """Delete a specific focus session"""
    success = crud.delete_focus_session(db, email=email, time=timestamp)
    if not success:
        raise HTTPException(status_code=404, detail="Focus session not found")
    return None


# ===== FOCUS GOAL ENDPOINTS =====

@app.post("/api/users/{email}/focus-goals", response_model=schemas.FocusGoal, status_code=201)
def create_focus_goal(
    email: str,
    goal: schemas.FocusGoalCreate,
    db: Session = Depends(get_db)
):
    """Create or update a focus goal for a category"""
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.create_focus_goal(db=db, email=email, goal=goal)


@app.get("/api/users/{email}/focus-goals", response_model=List[schemas.FocusGoal])
def get_focus_goals(email: str, db: Session = Depends(get_db)):
    """Get all focus goals for a user"""
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_focus_goals(db=db, email=email)


@app.get("/api/users/{email}/focus-goals/{category}", response_model=schemas.FocusGoal)
def get_focus_goal(email: str, category: str, db: Session = Depends(get_db)):
    """Get a specific focus goal"""
    db_goal = crud.get_focus_goal(db, email=email, category=category)
    if db_goal is None:
        raise HTTPException(status_code=404, detail="Focus goal not found")
    return db_goal


@app.delete("/api/users/{email}/focus-goals/{category}", status_code=204)
def delete_focus_goal(email: str, category: str, db: Session = Depends(get_db)):
    """Delete a focus goal"""
    success = crud.delete_focus_goal(db, email=email, category=category)
    if not success:
        raise HTTPException(status_code=404, detail="Focus goal not found")
    return None


# ===== STATISTICS ENDPOINTS =====

@app.get("/api/users/{email}/stats", response_model=schemas.UserStats)
def get_user_stats(
    email: str,
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
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_user_stats(
        db=db,
        email=email,
        start_date=start_date,
        end_date=end_date
    )


@app.get("/api/users/{email}/stats/weekly", response_model=schemas.UserStats)
def get_weekly_stats(email: str, db: Session = Depends(get_db)):
    """Get statistics for the current week"""
    # Calculate start of current week (Monday)
    today = datetime.utcnow()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    return crud.get_user_stats(
        db=db,
        email=email,
        start_date=start_of_week,
        end_date=today
    )


# ===== CATEGORY ENDPOINTS =====

@app.post("/api/users/{email}/categories", response_model=schemas.Category, status_code=201)
def create_category(
    email: str,
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new category for a user"""
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        return crud.create_category(db=db, email=email, category=category)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/users/{email}/categories", response_model=List[schemas.Category])
def get_categories(email: str, db: Session = Depends(get_db)):
    """Get all categories for a user"""
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return crud.get_categories(db=db, email=email)


@app.delete("/api/users/{email}/categories/{category}", status_code=204)
def delete_category(email: str, category: str, db: Session = Depends(get_db)):
    """Delete a category"""
    success = crud.delete_category(db, email=email, category=category)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found")
    return None


# ===== GRAPH DATA ENDPOINTS =====

@app.get("/api/users/{email}/graph-data", response_model=schemas.GraphData)
def get_graph_data(
    email: str,
    time_range: str,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get graph data for focus time visualization"""
    # Verify user exists
    user = crud.get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate time_range
    valid_ranges = ['week', 'month', '6month', 'ytd']
    if time_range not in valid_ranges:
        raise HTTPException(status_code=400, detail=f"Invalid time_range. Must be one of: {', '.join(valid_ranges)}")

    return crud.get_graph_data(db=db, email=email, time_range=time_range, category=category)


# ===== AUTHENTICATION & VERIFICATION ENDPOINTS =====

@app.post("/api/users/request-verification-code", status_code=200)
def request_verification_code(request: schemas.VerificationCodeRequest, db: Session = Depends(get_db)):
    """Send verification code to email for passwordless login"""
    # Check if user exists
    user = crud.get_user(db, email=request.email)
    if not user:
        # Don't reveal if email exists (security best practice)
        return {"message": "If email is registered, verification code has been sent"}

    # Generate and send code
    code = crud.create_verification_code(db, email=request.email)
    email_sent = email_service.send_verification_code(request.email, code)

    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send verification code")

    return {"message": "Verification code sent to email"}


@app.post("/api/users/verify-registration", response_model=schemas.User, status_code=201)
def verify_registration(credentials: schemas.RegistrationVerification, db: Session = Depends(get_db)):
    """Verify registration code and complete account creation"""
    # Verify code and create user
    success = crud.verify_registration_code(db, email=credentials.email, code=credentials.code)
    if not success:
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    # Get and return the newly created user
    user = crud.get_user(db, email=credentials.email)
    if not user:
        raise HTTPException(status_code=500, detail="User creation failed")

    return user


@app.post("/api/users/login-with-code", response_model=schemas.User)
def login_with_verification_code(credentials: schemas.VerificationCodeLogin, db: Session = Depends(get_db)):
    """Login using email + verification code (passwordless)"""
    # Verify code
    if not crud.verify_code(db, email=credentials.email, code=credentials.code):
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    # Return user (code verification proves identity)
    user = crud.get_user(db, email=credentials.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@app.post("/api/users/{email}/change-password", status_code=200)
def change_password(email: str, request: schemas.PasswordChangeRequest, db: Session = Depends(get_db)):
    """Change user password"""
    success = crud.change_password(
        db,
        email=email,
        current_password=request.current_password,
        new_password=request.new_password
    )
    if not success:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Send confirmation email (optional)
    email_service.send_password_reset_confirmation(email)

    return {"message": "Password changed successfully"}


@app.post("/api/users/request-password-reset", status_code=200)
def request_password_reset(request: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    """Send password reset link to email"""
    # Check if user exists
    user = crud.get_user(db, email=request.email)
    if not user:
        # Don't reveal if email exists (security best practice)
        return {"message": "If email is registered, password reset link has been sent"}

    # Generate and send reset token
    token = crud.create_password_reset_token(db, email=request.email)
    email_sent = email_service.send_password_reset_link(request.email, token)

    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send password reset email")

    return {"message": "Password reset link sent to email"}


@app.post("/api/users/reset-password", status_code=200)
def reset_password(request: schemas.PasswordReset, db: Session = Depends(get_db)):
    """Reset password using token"""
    success = crud.reset_password_with_token(db, token=request.token, new_password=request.new_password)
    if not success:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    return {"message": "Password reset successfully"}
