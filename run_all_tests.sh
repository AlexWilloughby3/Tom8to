#!/bin/bash

# Master test runner for Focus Tracker application
# Runs both backend and frontend tests

set -e  # Exit on any error

echo "========================================="
echo "Focus Tracker - Comprehensive Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
BACKEND_PASSED=0
FRONTEND_PASSED=0

echo -e "${YELLOW}Running Backend Tests...${NC}"
echo "========================================="
cd backend

# Check if virtual environment should be used
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Install dependencies
echo "Installing backend dependencies..."
pip install -q -r requirements.txt
pip install -q -r requirements-dev.txt

# Run backend tests
echo ""
echo "Executing backend tests..."
if pytest test_api.py -v --tb=short; then
    BACKEND_PASSED=1
    echo -e "${GREEN}✓ Backend tests passed!${NC}"
else
    echo -e "${RED}✗ Backend tests failed!${NC}"
fi

cd ..

echo ""
echo ""
echo -e "${YELLOW}Running Frontend Tests...${NC}"
echo "========================================="
cd frontend

# Install dependencies
echo "Installing frontend dependencies..."
npm install --silent

# Run frontend tests
echo ""
echo "Executing frontend tests..."
if npm run test:run; then
    FRONTEND_PASSED=1
    echo -e "${GREEN}✓ Frontend tests passed!${NC}"
else
    echo -e "${RED}✗ Frontend tests failed!${NC}"
fi

cd ..

# Summary
echo ""
echo ""
echo "========================================="
echo "Test Results Summary"
echo "========================================="

if [ $BACKEND_PASSED -eq 1 ]; then
    echo -e "Backend:  ${GREEN}✓ PASSED${NC}"
else
    echo -e "Backend:  ${RED}✗ FAILED${NC}"
fi

if [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "Frontend: ${GREEN}✓ PASSED${NC}"
else
    echo -e "Frontend: ${RED}✗ FAILED${NC}"
fi

echo "========================================="

# Exit with error if any tests failed
if [ $BACKEND_PASSED -eq 1 ] && [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
