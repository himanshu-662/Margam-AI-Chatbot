FROM python:3.11-slim

WORKDIR /app

# Install system dependencies in one layer and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install build tools for faster installs
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with optimizations
# Using --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (excluding unnecessary files via .dockerignore)
COPY . .

# Create necessary directories
RUN mkdir -p logs chroma_db

# Expose port
EXPOSE 8000

# Health check (using Python's urllib)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)" || exit 1

# Run the application
CMD ["python", "server.py"]
