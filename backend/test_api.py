"""
Comprehensive API tests for the Focus Tracker backend

Tests user registration, authentication, focus sessions, goals, and statistics.
Keeps user count to maximum 5 users as requested.
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient


class TestHealthCheck:
    """Test health check endpoints"""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns correct information"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["message"] == "Welcome to the Focus Tracker API"
        assert "version" in data

    def test_health_endpoint(self, client: TestClient):
        """Test health check endpoint"""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestUserOperations:
    """Test user registration, login, and management"""

    def test_register_single_user(self, client: TestClient):
        """Test registering a new user"""
        response = client.post(
            "/api/users/register",
            json={"userid": "testuser1", "password": "password123"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["userid"] == "testuser1"
        assert "password" not in data  # Password should not be returned

    def test_register_multiple_users(self, client: TestClient, sample_users):
        """Test registering multiple users (max 5)"""
        for user in sample_users:
            response = client.post("/api/users/register", json=user)
            assert response.status_code == 201
            assert response.json()["userid"] == user["userid"]

    def test_register_duplicate_user(self, client: TestClient):
        """Test that registering a duplicate user fails"""
        user_data = {"userid": "duplicate", "password": "password123"}

        # Register first time - should succeed
        response = client.post("/api/users/register", json=user_data)
        assert response.status_code == 201

        # Register again - should fail
        response = client.post("/api/users/register", json=user_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_login_valid_credentials(self, client: TestClient):
        """Test logging in with valid credentials"""
        # Register user
        client.post(
            "/api/users/register",
            json={"userid": "logintest", "password": "mypassword"}
        )

        # Login
        response = client.post(
            "/api/users/login",
            json={"userid": "logintest", "password": "mypassword"}
        )
        assert response.status_code == 200
        assert response.json()["userid"] == "logintest"

    def test_login_invalid_password(self, client: TestClient):
        """Test logging in with wrong password"""
        # Register user
        client.post(
            "/api/users/register",
            json={"userid": "logintest2", "password": "correctpass"}
        )

        # Try to login with wrong password
        response = client.post(
            "/api/users/login",
            json={"userid": "logintest2", "password": "wrongpass"}
        )
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient):
        """Test logging in with non-existent user"""
        response = client.post(
            "/api/users/login",
            json={"userid": "nonexistent", "password": "anypassword"}
        )
        assert response.status_code == 401

    def test_get_user_info(self, client: TestClient):
        """Test getting user information"""
        # Register user
        client.post(
            "/api/users/register",
            json={"userid": "gettest", "password": "password123"}
        )

        # Get user info
        response = client.get("/api/users/gettest")
        assert response.status_code == 200
        assert response.json()["userid"] == "gettest"

    def test_get_nonexistent_user(self, client: TestClient):
        """Test getting info for non-existent user"""
        response = client.get("/api/users/nonexistent")
        assert response.status_code == 404

    def test_delete_user(self, client: TestClient):
        """Test deleting a user"""
        # Register user
        client.post(
            "/api/users/register",
            json={"userid": "deletetest", "password": "password123"}
        )

        # Delete user
        response = client.delete("/api/users/deletetest")
        assert response.status_code == 204

        # Verify user is deleted
        response = client.get("/api/users/deletetest")
        assert response.status_code == 404

    def test_delete_nonexistent_user(self, client: TestClient):
        """Test deleting a non-existent user"""
        response = client.delete("/api/users/nonexistent")
        assert response.status_code == 404


class TestFocusSessionOperations:
    """Test focus session creation, retrieval, and deletion"""

    @pytest.fixture(autouse=True)
    def setup_user(self, client: TestClient):
        """Create a test user for all focus session tests"""
        client.post(
            "/api/users/register",
            json={"userid": "focususer", "password": "password123"}
        )

    def test_create_focus_session(self, client: TestClient):
        """Test creating a focus session"""
        session_data = {
            "category": "Work",
            "focus_time_seconds": 1500
        }
        response = client.post(
            "/api/users/focususer/focus-sessions",
            json=session_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "Work"
        assert data["focus_time_seconds"] == 1500
        assert data["userid"] == "focususer"
        assert "time" in data

    def test_create_multiple_sessions(self, client: TestClient, sample_focus_sessions):
        """Test creating multiple focus sessions"""
        for session in sample_focus_sessions:
            response = client.post(
                "/api/users/focususer/focus-sessions",
                json=session
            )
            assert response.status_code == 201
            assert response.json()["category"] == session["category"]

    def test_create_session_with_specific_time(self, client: TestClient):
        """Test creating a focus session with a specific timestamp"""
        specific_time = (datetime.utcnow() - timedelta(days=1)).isoformat()
        session_data = {
            "category": "Study",
            "focus_time_seconds": 3000,
            "time": specific_time
        }
        response = client.post(
            "/api/users/focususer/focus-sessions/with-time",
            json=session_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "Study"

    def test_create_session_for_nonexistent_user(self, client: TestClient):
        """Test creating a session for a user that doesn't exist"""
        session_data = {
            "category": "Work",
            "focus_time_seconds": 1500
        }
        response = client.post(
            "/api/users/nonexistent/focus-sessions",
            json=session_data
        )
        assert response.status_code == 404

    def test_get_all_focus_sessions(self, client: TestClient, sample_focus_sessions):
        """Test getting all focus sessions for a user"""
        # Create multiple sessions
        for session in sample_focus_sessions:
            client.post("/api/users/focususer/focus-sessions", json=session)

        # Get all sessions
        response = client.get("/api/users/focususer/focus-sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == len(sample_focus_sessions)
        assert isinstance(data, list)

    def test_get_sessions_with_pagination(self, client: TestClient, sample_focus_sessions):
        """Test pagination of focus sessions"""
        # Create multiple sessions
        for session in sample_focus_sessions:
            client.post("/api/users/focususer/focus-sessions", json=session)

        # Get with limit
        response = client.get("/api/users/focususer/focus-sessions?limit=2")
        assert response.status_code == 200
        assert len(response.json()) == 2

        # Get with skip
        response = client.get("/api/users/focususer/focus-sessions?skip=2&limit=2")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_filter_sessions_by_category(self, client: TestClient, sample_focus_sessions):
        """Test filtering sessions by category"""
        # Create multiple sessions
        for session in sample_focus_sessions:
            client.post("/api/users/focususer/focus-sessions", json=session)

        # Filter by Work category
        response = client.get("/api/users/focususer/focus-sessions?category=Work")
        assert response.status_code == 200
        data = response.json()
        assert all(session["category"] == "Work" for session in data)
        assert len(data) == 2  # We have 2 Work sessions in sample data

    def test_filter_sessions_by_date_range(self, client: TestClient):
        """Test filtering sessions by date range"""
        # Create sessions with specific timestamps
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)

        sessions = [
            {"category": "Work", "focus_time_seconds": 1500, "time": week_ago.isoformat()},
            {"category": "Study", "focus_time_seconds": 2000, "time": yesterday.isoformat()},
            {"category": "Work", "focus_time_seconds": 1800, "time": now.isoformat()},
        ]

        for session in sessions:
            client.post("/api/users/focususer/focus-sessions/with-time", json=session)

        # Filter by date range
        start_date = (now - timedelta(days=2)).isoformat()
        response = client.get(
            f"/api/users/focususer/focus-sessions?start_date={start_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2  # Should get sessions from yesterday and today

    def test_delete_focus_session(self, client: TestClient):
        """Test deleting a focus session"""
        # Create a session
        session_data = {"category": "Work", "focus_time_seconds": 1500}
        create_response = client.post(
            "/api/users/focususer/focus-sessions",
            json=session_data
        )
        timestamp = create_response.json()["time"]

        # Delete the session
        response = client.delete(f"/api/users/focususer/focus-sessions/{timestamp}")
        assert response.status_code == 204

    def test_delete_nonexistent_session(self, client: TestClient):
        """Test deleting a non-existent session"""
        fake_timestamp = datetime.utcnow().isoformat()
        response = client.delete(f"/api/users/focususer/focus-sessions/{fake_timestamp}")
        assert response.status_code == 404


class TestFocusGoalOperations:
    """Test focus goal creation, retrieval, update, and deletion"""

    @pytest.fixture(autouse=True)
    def setup_user(self, client: TestClient):
        """Create a test user for all goal tests"""
        client.post(
            "/api/users/register",
            json={"userid": "goaluser", "password": "password123"}
        )

    def test_create_focus_goal(self, client: TestClient):
        """Test creating a focus goal"""
        goal_data = {
            "category": "Work",
            "goal_time_per_week_seconds": 36000  # 10 hours
        }
        response = client.post(
            "/api/users/goaluser/focus-goals",
            json=goal_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "Work"
        assert data["goal_time_per_week_seconds"] == 36000
        assert data["userid"] == "goaluser"

    def test_create_multiple_goals(self, client: TestClient, sample_goals):
        """Test creating multiple goals for different categories"""
        for goal in sample_goals:
            response = client.post(
                "/api/users/goaluser/focus-goals",
                json=goal
            )
            assert response.status_code == 201

    def test_update_existing_goal(self, client: TestClient):
        """Test updating an existing goal"""
        category = "Work"

        # Create initial goal
        initial_goal = {"category": category, "goal_time_per_week_seconds": 36000}
        client.post("/api/users/goaluser/focus-goals", json=initial_goal)

        # Update the goal
        updated_goal = {"category": category, "goal_time_per_week_seconds": 50400}  # 14 hours
        response = client.post("/api/users/goaluser/focus-goals", json=updated_goal)
        assert response.status_code == 201
        assert response.json()["goal_time_per_week_seconds"] == 50400

    def test_get_all_goals(self, client: TestClient, sample_goals):
        """Test getting all goals for a user"""
        # Create multiple goals
        for goal in sample_goals:
            client.post("/api/users/goaluser/focus-goals", json=goal)

        # Get all goals
        response = client.get("/api/users/goaluser/focus-goals")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == len(sample_goals)

    def test_get_specific_goal(self, client: TestClient):
        """Test getting a specific goal by category"""
        # Create a goal
        goal_data = {"category": "Study", "goal_time_per_week_seconds": 18000}
        client.post("/api/users/goaluser/focus-goals", json=goal_data)

        # Get the goal
        response = client.get("/api/users/goaluser/focus-goals/Study")
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Study"
        assert data["goal_time_per_week_seconds"] == 18000

    def test_get_nonexistent_goal(self, client: TestClient):
        """Test getting a goal that doesn't exist"""
        response = client.get("/api/users/goaluser/focus-goals/NonexistentCategory")
        assert response.status_code == 404

    def test_delete_goal(self, client: TestClient):
        """Test deleting a goal"""
        # Create a goal
        goal_data = {"category": "Exercise", "goal_time_per_week_seconds": 10800}
        client.post("/api/users/goaluser/focus-goals", json=goal_data)

        # Delete the goal
        response = client.delete("/api/users/goaluser/focus-goals/Exercise")
        assert response.status_code == 204

        # Verify it's deleted
        response = client.get("/api/users/goaluser/focus-goals/Exercise")
        assert response.status_code == 404

    def test_delete_nonexistent_goal(self, client: TestClient):
        """Test deleting a non-existent goal"""
        response = client.delete("/api/users/goaluser/focus-goals/NonexistentCategory")
        assert response.status_code == 404


class TestStatisticsOperations:
    """Test statistics calculation and retrieval"""

    @pytest.fixture(autouse=True)
    def setup_user_with_data(self, client: TestClient):
        """Create a test user with sessions and goals"""
        # Register user
        client.post(
            "/api/users/register",
            json={"userid": "statsuser", "password": "password123"}
        )

        # Create focus sessions
        sessions = [
            {"category": "Work", "focus_time_seconds": 3600},  # 1 hour
            {"category": "Work", "focus_time_seconds": 5400},  # 1.5 hours
            {"category": "Study", "focus_time_seconds": 7200},  # 2 hours
            {"category": "Exercise", "focus_time_seconds": 1800},  # 30 minutes
        ]
        for session in sessions:
            client.post("/api/users/statsuser/focus-sessions", json=session)

        # Create goals
        goals = [
            {"category": "Work", "goal_time_per_week_seconds": 36000},  # 10 hours
            {"category": "Study", "goal_time_per_week_seconds": 18000},  # 5 hours
        ]
        for goal in goals:
            client.post("/api/users/statsuser/focus-goals", json=goal)

    def test_get_user_stats(self, client: TestClient):
        """Test getting overall user statistics"""
        response = client.get("/api/users/statsuser/stats")
        assert response.status_code == 200
        data = response.json()

        # Check overall stats
        assert data["userid"] == "statsuser"
        assert data["total_focus_time_seconds"] == 18000  # Total: 5 hours
        assert data["total_sessions"] == 4

        # Check category stats
        assert len(data["categories"]) == 3

        # Find Work category stats
        work_stats = next(cat for cat in data["categories"] if cat["category"] == "Work")
        assert work_stats["total_time_seconds"] == 9000  # 2.5 hours
        assert work_stats["session_count"] == 2
        assert work_stats["goal_time_per_week_seconds"] == 36000
        assert work_stats["progress_percentage"] == 25.0  # 9000/36000 * 100

    def test_get_weekly_stats(self, client: TestClient):
        """Test getting weekly statistics"""
        response = client.get("/api/users/statsuser/stats/weekly")
        assert response.status_code == 200
        data = response.json()
        assert data["userid"] == "statsuser"
        assert "total_focus_time_seconds" in data
        assert "categories" in data

    def test_stats_with_date_filter(self, client: TestClient):
        """Test getting statistics with date filtering"""
        start_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
        response = client.get(
            f"/api/users/statsuser/stats?start_date={start_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_focus_time_seconds" in data

    def test_stats_for_user_with_no_data(self, client: TestClient):
        """Test stats for a user with no sessions"""
        # Create a new user with no sessions
        client.post(
            "/api/users/register",
            json={"userid": "emptyuser", "password": "password123"}
        )

        response = client.get("/api/users/emptyuser/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_focus_time_seconds"] == 0
        assert data["total_sessions"] == 0
        assert len(data["categories"]) == 0

    def test_stats_for_nonexistent_user(self, client: TestClient):
        """Test stats endpoint for non-existent user"""
        response = client.get("/api/users/nonexistent/stats")
        assert response.status_code == 404


class TestIntegrationScenarios:
    """Test complete user workflows and integration scenarios"""

    def test_complete_user_workflow(self, client: TestClient):
        """Test a complete user workflow from registration to stats"""
        # 1. Register
        register_response = client.post(
            "/api/users/register",
            json={"userid": "completeuser", "password": "password123"}
        )
        assert register_response.status_code == 201

        # 2. Login
        login_response = client.post(
            "/api/users/login",
            json={"userid": "completeuser", "password": "password123"}
        )
        assert login_response.status_code == 200

        # 3. Set goals
        goal_response = client.post(
            "/api/users/completeuser/focus-goals",
            json={"category": "Work", "goal_time_per_week_seconds": 36000}
        )
        assert goal_response.status_code == 201

        # 4. Create focus sessions
        for i in range(3):
            session_response = client.post(
                "/api/users/completeuser/focus-sessions",
                json={"category": "Work", "focus_time_seconds": 1500 * (i + 1)}
            )
            assert session_response.status_code == 201

        # 5. Check stats
        stats_response = client.get("/api/users/completeuser/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_sessions"] == 3
        assert stats["total_focus_time_seconds"] == 9000  # 1500 + 3000 + 4500

        # 6. Check progress
        work_stats = next(cat for cat in stats["categories"] if cat["category"] == "Work")
        assert work_stats["progress_percentage"] == 25.0  # 9000/36000 * 100

    def test_multi_user_isolation(self, client: TestClient, sample_users):
        """Test that users' data is properly isolated"""
        # Create multiple users with their own sessions
        for i, user in enumerate(sample_users[:3]):  # Use only 3 users
            # Register
            client.post("/api/users/register", json=user)

            # Create sessions
            client.post(
                f"/api/users/{user['userid']}/focus-sessions",
                json={"category": "Work", "focus_time_seconds": 1000 * (i + 1)}
            )

        # Verify each user has only their own data
        for i, user in enumerate(sample_users[:3]):
            response = client.get(f"/api/users/{user['userid']}/focus-sessions")
            sessions = response.json()
            assert len(sessions) == 1
            assert sessions[0]["focus_time_seconds"] == 1000 * (i + 1)

    def test_cascading_delete(self, client: TestClient):
        """Test that deleting a user also deletes their sessions and goals"""
        userid = "cascadetest"

        # Create user
        client.post(
            "/api/users/register",
            json={"userid": userid, "password": "password123"}
        )

        # Create sessions and goals
        client.post(
            f"/api/users/{userid}/focus-sessions",
            json={"category": "Work", "focus_time_seconds": 1500}
        )
        client.post(
            f"/api/users/{userid}/focus-goals",
            json={"category": "Work", "goal_time_per_week_seconds": 36000}
        )

        # Delete user
        delete_response = client.delete(f"/api/users/{userid}")
        assert delete_response.status_code == 204

        # Verify user and their data are gone
        user_response = client.get(f"/api/users/{userid}")
        assert user_response.status_code == 404

        sessions_response = client.get(f"/api/users/{userid}/focus-sessions")
        assert sessions_response.status_code == 404

        goals_response = client.get(f"/api/users/{userid}/focus-goals")
        assert goals_response.status_code == 404
