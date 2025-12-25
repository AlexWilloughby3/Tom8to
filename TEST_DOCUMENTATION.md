# Focus Tracker - Test Suite Documentation

This document describes the comprehensive testing suite for the Focus Tracker application.

## Overview

The test suite covers both backend (FastAPI) and frontend (React) components, ensuring full application functionality with a focus on user workflows, data integrity, and edge cases.

## Test Philosophy

- **User limit**: All tests keep user count to maximum 5 users as requested
- **Real-world scenarios**: Tests simulate actual user workflows
- **Edge cases**: Tests cover error conditions, validation failures, and boundary conditions
- **Isolation**: Each test runs independently with fresh database/state

## Backend Tests (pytest)

### Location
`/backend/test_api.py`

### Test Categories

#### 1. Health Check Tests (`TestHealthCheck`)
- Root endpoint functionality
- API health status

#### 2. User Operations Tests (`TestUserOperations`)
- User registration (single and multiple users)
- Duplicate user prevention
- Login with valid/invalid credentials
- User retrieval
- User deletion
- Cascade deletion of user data

#### 3. Focus Session Tests (`TestFocusSessionOperations`)
- Creating focus sessions with auto timestamps
- Creating sessions with specific timestamps
- Multiple session creation
- Session pagination
- Filtering by category
- Filtering by date range
- Session deletion

#### 4. Focus Goal Tests (`TestFocusGoalOperations`)
- Goal creation
- Multiple goals per user
- Goal updates (upsert behavior)
- Goal retrieval (all and specific)
- Goal deletion

#### 5. Statistics Tests (`TestStatisticsOperations`)
- Overall user statistics
- Weekly statistics
- Statistics with date filters
- Progress calculations (session time vs goals)
- Empty data handling

#### 6. Integration Tests (`TestIntegrationScenarios`)
- Complete user workflow (register → login → set goals → track time → view stats)
- Multi-user data isolation
- Cascading deletes

### Running Backend Tests

```bash
cd backend

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run all tests
pytest test_api.py -v

# Run specific test class
pytest test_api.py::TestUserOperations -v

# Run with coverage
pytest test_api.py --cov=app --cov-report=html
```

### Test Database

- Uses in-memory SQLite database
- Fresh database for each test
- Automatic cleanup after tests

## Frontend Tests (Vitest + React Testing Library)

### Location
`/frontend/src/test/`

### Test Files

#### 1. AuthContext.test.tsx
Tests the authentication context provider:
- Context provision
- User login
- User logout
- LocalStorage persistence
- State restoration from localStorage

#### 2. Login.test.tsx
Tests the login component:
- Form rendering
- Successful login flow
- Failed login error handling
- Loading state management
- Input validation
- Navigation to register page

#### 3. Timer.test.tsx
Tests the focus timer component:
- Timer start/stop/pause/reset
- Time tracking accuracy
- Category selection
- Custom category creation
- Session saving
- Error handling (0-second sessions, missing categories)
- UI state management (button states, disabled inputs)

#### 4. integration.test.tsx
End-to-end user flows:
- Registration flow
- Login flow
- Protected route navigation
- Multi-page workflows

### Running Frontend Tests

```bash
cd frontend

# Install dependencies
npm install

# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with UI
npm run test:ui

# Run with coverage
npm test -- --coverage
```

### Test Environment

- Uses `happy-dom` for DOM simulation
- Mocks API services
- Isolated localStorage for each test
- Automatic cleanup after each test

## Test Coverage Goals

### Backend
- **Controllers (main.py)**: 100% of endpoints
- **CRUD operations (crud.py)**: 100% of functions
- **Business logic**: All calculation paths
- **Error handling**: All error conditions

### Frontend
- **Components**: All user interactions
- **Context**: All state changes
- **API integration**: All service calls (mocked)
- **Routing**: Protected and public routes

## Test Data Constraints

As requested, all tests maintain a maximum of **5 test users**:
- Sample users fixture provides 5 users
- Integration tests use subset of users
- Tests clean up data between runs

## Sample Test Data

### Users
```javascript
[
  { userid: "user1", password: "password123" },
  { userid: "user2", password: "securepass456" },
  { userid: "user3", password: "testuser789" },
  { userid: "user4", password: "focustime101" },
  { userid: "user5", password: "productivity202" }
]
```

### Focus Sessions
- Work: 1500 seconds (25 minutes)
- Study: 3000 seconds (50 minutes)
- Exercise: 1800 seconds (30 minutes)
- Reading: 1200 seconds (20 minutes)

### Goals
- Work: 36000 seconds/week (10 hours)
- Study: 18000 seconds/week (5 hours)
- Exercise: 10800 seconds/week (3 hours)

## Continuous Integration

### GitHub Actions (Future Enhancement)
```yaml
# Suggested workflow
- Run backend tests on push
- Run frontend tests on push
- Generate coverage reports
- Fail on test failures
```

## Common Test Patterns

### Backend Test Pattern
```python
def test_example(client: TestClient):
    # Arrange: Set up test data
    user_data = {"userid": "test", "password": "pass123"}

    # Act: Perform action
    response = client.post("/api/users/register", json=user_data)

    # Assert: Verify results
    assert response.status_code == 201
    assert response.json()["userid"] == "test"
```

### Frontend Test Pattern
```typescript
it('should do something', async () => {
  // Arrange: Render component
  const user = userEvent.setup();
  render(<Component />);

  // Act: Simulate user interaction
  await user.click(screen.getByRole('button'));

  // Assert: Check results
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

## Debugging Tests

### Backend
```bash
# Run with verbose output
pytest test_api.py -vv

# Run with print statements
pytest test_api.py -s

# Run specific test
pytest test_api.py::TestUserOperations::test_register_single_user -v
```

### Frontend
```bash
# Run with debug output
npm test -- --reporter=verbose

# Run specific test file
npm test -- Login.test.tsx

# Run in UI mode for interactive debugging
npm run test:ui
```

## Adding New Tests

### Backend
1. Add test method to appropriate test class in `test_api.py`
2. Use existing fixtures (client, sample_users, etc.)
3. Follow AAA pattern (Arrange, Act, Assert)
4. Ensure cleanup happens automatically

### Frontend
1. Create new test file in `src/test/`
2. Import necessary testing utilities
3. Mock external dependencies
4. Use `beforeEach` for setup
5. Test user interactions, not implementation

## Known Limitations

- Frontend tests mock API calls (no real backend)
- Backend tests use SQLite instead of PostgreSQL
- Timer tests use fake timers (instant time advancement)
- No E2E tests with real browser (consider Playwright/Cypress for future)

## Success Criteria

Tests pass if:
- ✅ All backend endpoints work correctly
- ✅ All frontend components render and interact properly
- ✅ Authentication flow works end-to-end
- ✅ Data persistence works correctly
- ✅ Edge cases are handled gracefully
- ✅ User limit (≤5 users) is maintained

## Maintenance

- Update tests when adding new features
- Keep test data realistic
- Maintain test independence
- Review and update mocks when APIs change
- Keep test documentation current
