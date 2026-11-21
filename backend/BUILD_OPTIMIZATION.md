# Docker Build Optimization Guide

## Issue: Build Timeout

The build was timing out due to:
1. Large dependencies (LangChain, ChromaDB, embeddings)
2. Slow pip install process
3. Large files being copied into image

## Solutions Applied

### 1. Optimized Dockerfile
- ✅ Combined apt-get commands
- ✅ Added `--no-install-recommends` to reduce image size
- ✅ Upgraded pip before installing dependencies
- ✅ Created directories in one layer

### 2. Enhanced .dockerignore
- ✅ Excluded `chroma_db/` (runtime data, not needed in image)
- ✅ Excluded `Data/` folder (PDFs are too large)
- ✅ Excluded logs, cache, and temporary files
- ✅ Excluded development files

### 3. Build Strategy

**Option A: Use local Docker build (faster)**
```bash
# Build locally first
docker build -t margam-chatbot:latest .

# Then deploy
fly deploy --local-only
```

**Option B: Use Fly.io remote builder with timeout increase**
```bash
# Deploy with explicit builder
fly deploy --remote-only
```

**Option C: Build in stages (if still timing out)**
1. Pre-build a base image with dependencies
2. Use that as base for final image

## If Build Still Times Out

### 1. Check build logs for slow step:
```bash
fly logs --build
```

### 2. Build locally and push:
```bash
# Build locally
docker build -t margam-chatbot:latest .

# Tag and push to Fly registry
docker tag margam-chatbot:latest registry.fly.io/margam-chatbot:latest
fly auth docker
docker push registry.fly.io/margam-chatbot:latest

# Deploy without building
fly deploy --image registry.fly.io/margam-chatbot:latest
```

### 3. Reduce dependencies (if possible):
- Check if all packages in `requirements.txt` are needed
- Consider lighter alternatives for some packages

### 4. Use multi-stage build:
```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
CMD ["python", "server.py"]
```

## Expected Build Time

- **Optimized build**: 5-10 minutes
- **First build**: May take longer (downloading base images)
- **Subsequent builds**: Faster (cached layers)

## Monitoring Build

```bash
# Watch build progress
fly logs --build

# Check build status
fly status
```

