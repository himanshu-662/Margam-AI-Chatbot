#!/bin/bash
# Production startup script for Margam AI Backend

# Set environment variables if not set
export PORT=${PORT:-8000}
export WORKERS=${WORKERS:-4}
export LOG_LEVEL=${LOG_LEVEL:-INFO}
export ENVIRONMENT=${ENVIRONMENT:-production}

# Create logs directory if it doesn't exist
mkdir -p logs

# Run with uvicorn (for single instance) or use gunicorn for production
if [ "$WORKERS" -gt 1 ]; then
    echo "Starting Margam AI Backend with $WORKERS workers..."
    uvicorn server:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers $WORKERS \
        --log-level $LOG_LEVEL \
        --access-log \
        --loop uvloop \
        --timeout-keep-alive 30
else
    echo "Starting Margam AI Backend in development mode..."
    python server.py
fi

