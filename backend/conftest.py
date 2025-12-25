"""
Pytest configuration and fixtures for backend tests
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app

# Use in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def db_engine():
    """Create a fresh database engine for each test"""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a fresh database session for each test"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with overridden database dependency"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_users():
    """Sample user data for testing (limited to 5 users)"""
    return [
        {"userid": "user1", "password": "password123"},
        {"userid": "user2", "password": "securepass456"},
        {"userid": "user3", "password": "testuser789"},
        {"userid": "user4", "password": "focustime101"},
        {"userid": "user5", "password": "productivity202"},
    ]


@pytest.fixture
def sample_focus_sessions():
    """Sample focus session data for testing"""
    return [
        {"category": "Work", "focus_time_seconds": 1500},  # 25 minutes
        {"category": "Study", "focus_time_seconds": 3000},  # 50 minutes
        {"category": "Work", "focus_time_seconds": 2400},  # 40 minutes
        {"category": "Exercise", "focus_time_seconds": 1800},  # 30 minutes
        {"category": "Reading", "focus_time_seconds": 1200},  # 20 minutes
    ]


@pytest.fixture
def sample_goals():
    """Sample goal data for testing"""
    return [
        {"category": "Work", "goal_time_per_week_seconds": 36000},  # 10 hours
        {"category": "Study", "goal_time_per_week_seconds": 18000},  # 5 hours
        {"category": "Exercise", "goal_time_per_week_seconds": 10800},  # 3 hours
    ]
