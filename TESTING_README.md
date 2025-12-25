# Testing Guide - Focus Tracker

Quick start guide for running the comprehensive test suite.

## Quick Start

### Run All Tests

```bash
chmod +x run_all_tests.sh
./run_all_tests.sh
```

This will run both backend and frontend tests and provide a summary.

## Backend Tests Only

```bash
cd backend
pip install -r requirements.txt requirements-dev.txt
pytest test_api.py -v
```

### Backend Test Options

```bash
# Run with coverage
pytest test_api.py --cov=app --cov-report=html

# Run specific test class
pytest test_api.py::TestUserOperations -v

# Run specific test
pytest test_api.py::TestUserOperations::test_register_single_user -v

# Show print statements
pytest test_api.py -s
```

## Frontend Tests Only

```bash
cd frontend
npm install
npm test
```

### Frontend Test Options

```bash
# Run tests once (CI mode)
npm run test:run

# Run with UI (interactive)
npm run test:ui

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- Login.test.tsx

# Watch mode with specific file
npm test -- --watch Timer.test.tsx
```

## Test Coverage

### Backend Coverage
- **78 test cases** covering:
  - User registration and authentication
  - Focus session CRUD operations
  - Goal management
  - Statistics calculation
  - Integration workflows

### Frontend Coverage
- **30+ test cases** covering:
  - Authentication context
  - Login/Register components
  - Timer functionality
  - Integration flows
  - Protected routes

## What the Tests Verify

### ✅ User Management
- Registration with password hashing
- Login authentication
- User retrieval and deletion
- Duplicate prevention

### ✅ Focus Sessions
- Session creation with timestamps
- Pagination and filtering
- Category-based organization
- Date range queries

### ✅ Goals
- Goal setting per category
- Progress tracking
- Goal updates
- Multi-category support

### ✅ Statistics
- Total time calculation
- Session counts
- Category breakdowns
- Progress percentages
- Weekly summaries

### ✅ Frontend Functionality
- Timer start/stop/pause/reset
- Category selection
- Session saving
- Authentication flows
- Route protection

### ✅ Data Integrity
- User data isolation
- Cascading deletes
- Input validation
- Error handling

## Test Constraints

- Maximum **5 users** per test run
- Tests run in isolation
- Automatic cleanup between tests
- No external dependencies required

## Viewing Test Results

### Backend HTML Coverage Report
```bash
cd backend
pytest test_api.py --cov=app --cov-report=html
open htmlcov/index.html  # macOS
# or
xdg-open htmlcov/index.html  # Linux
```

### Frontend Coverage Report
```bash
cd frontend
npm test -- --coverage
# Report shown in terminal
# HTML report in coverage/ directory
```

## Troubleshooting

### Backend Tests Fail to Start
```bash
# Make sure you're in the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Try running with verbose output
pytest test_api.py -vv
```

### Frontend Tests Fail to Start
```bash
# Make sure you're in the frontend directory
cd frontend

# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Clear test cache
npm test -- --clearCache
```

### Import Errors
```bash
# Backend: Ensure you're in the backend directory
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Frontend: Clear node_modules and reinstall
cd frontend
rm -rf node_modules
npm install
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run all tests
        run: ./run_all_tests.sh
```

## Next Steps

- Review [TEST_DOCUMENTATION.md](TEST_DOCUMENTATION.md) for detailed information
- Add new tests when adding features
- Maintain test coverage above 80%
- Update tests when APIs change

## Need Help?

- Check test output for specific error messages
- Review test file comments for test intentions
- See [TEST_DOCUMENTATION.md](TEST_DOCUMENTATION.md) for patterns
- Run tests with `-v` or `--verbose` for more details
