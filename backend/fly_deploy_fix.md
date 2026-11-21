# Fly.io Deployment Fix Guide

## Issues Encountered

1. **Connection failures**: "failed to connect to machine: gave up after 15 attempts"
2. **Load balancing failures**: "could not find a good candidate within 40 attempts"

## Root Causes

1. **Memory too low**: 512MB is insufficient for ChromaDB + embeddings + LangChain
2. **Health check too aggressive**: 5s grace period is too short for app startup
3. **Startup time**: App needs more time to load ChromaDB and initialize

## Fixes Applied

### 1. Updated `fly.toml`:
- ✅ Increased memory: `512MB → 1024MB`
- ✅ Increased grace period: `5s → 30s`
- ✅ Increased health check timeout: `2s → 5s`
- ✅ Set region to `bom` (Mumbai) - matches your deployment region

### 2. Updated `Dockerfile`:
- ✅ Increased start period: `30s → 60s` (more time for initial startup)
- ✅ Added timeout to health check: `timeout=5`

## Deployment Steps

1. **Update fly.toml** (already done):
   ```bash
   cd backend
   # Edit fly.toml with new settings
   ```

2. **Redeploy with new configuration**:
   ```bash
   fly deploy
   ```

3. **If still failing, scale up resources**:
   ```bash
   fly scale memory 1024
   fly scale count 1
   ```

4. **Monitor deployment**:
   ```bash
   fly logs
   fly status
   ```

## Alternative: If 1024MB Still Fails

If you're still getting errors, try:

1. **Increase to 2048MB** (may require paid plan):
   ```bash
   fly scale memory 2048
   ```

2. **Check logs for specific errors**:
   ```bash
   fly logs --region bom
   ```

3. **Verify health endpoint works locally**:
   ```bash
   python server.py
   curl http://localhost:8000/health
   ```

## Expected Startup Time

- Initial startup: 30-60 seconds (loading ChromaDB, embeddings)
- Health check should pass after: ~60 seconds
- First request may be slow: 10-15 seconds (cold start)

## Monitoring

```bash
# Check app status
fly status

# View real-time logs
fly logs

# Check specific region
fly status --region bom

# View metrics
fly metrics
```

