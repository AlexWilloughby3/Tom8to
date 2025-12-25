#!/bin/bash
# Run backend tests

echo "Installing test dependencies..."
pip install -r requirements.txt
pip install -r requirements-dev.txt

echo ""
echo "Running backend tests..."
pytest test_api.py -v --tb=short

echo ""
echo "Test run complete!"
