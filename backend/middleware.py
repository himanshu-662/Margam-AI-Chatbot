"""
Production middleware for Margam AI Backend.
"""
import time
import asyncio
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
import logging
from request_context import generate_request_id, set_request_context, format_log_message

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware to prevent abuse.
    Uses sliding window algorithm.
    """
    def __init__(self, app, calls_per_minute: int = 60, calls_per_hour: int = 300):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.calls_per_hour = calls_per_hour
        self.minute_window = defaultdict(list)
        self.hour_window = defaultdict(list)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Get client identifier (IP address or user identifier)
        client_id = self._get_client_id(request)
        current_time = time.time()
        
        # Clean up old entries periodically
        if int(current_time) % self.cleanup_interval == 0:
            self._cleanup_old_entries(current_time)
        
        # Check minute limit
        minute_requests = self.minute_window[client_id]
        minute_requests = [t for t in minute_requests if current_time - t < 60]
        self.minute_window[client_id] = minute_requests
        
        if len(minute_requests) >= self.calls_per_minute:
            logger.warning(f"Rate limit exceeded (minute) for client: {client_id}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.calls_per_minute} requests per minute allowed"
                }
            )
        
        # Check hour limit
        hour_requests = self.hour_window[client_id]
        hour_requests = [t for t in hour_requests if current_time - t < 3600]
        self.hour_window[client_id] = hour_requests
        
        if len(hour_requests) >= self.calls_per_hour:
            logger.warning(f"Rate limit exceeded (hour) for client: {client_id}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.calls_per_hour} requests per hour allowed"
                }
            )
        
        # Record request
        minute_requests.append(current_time)
        hour_requests.append(current_time)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit-Minute"] = str(self.calls_per_minute)
        response.headers["X-RateLimit-Remaining-Minute"] = str(self.calls_per_minute - len(minute_requests))
        response.headers["X-RateLimit-Limit-Hour"] = str(self.calls_per_hour)
        response.headers["X-RateLimit-Remaining-Hour"] = str(self.calls_per_hour - len(hour_requests))
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier from request."""
        # Try to get from X-Forwarded-For header (for load balancers)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        # Fallback to direct client IP
        if request.client:
            return request.client.host
        return "unknown"
    
    def _cleanup_old_entries(self, current_time: float):
        """Clean up old entries from rate limit windows."""
        cutoff_minute = current_time - 60
        cutoff_hour = current_time - 3600
        
        # Clean minute window
        for client_id in list(self.minute_window.keys()):
            self.minute_window[client_id] = [
                t for t in self.minute_window[client_id] if t > cutoff_minute
            ]
            if not self.minute_window[client_id]:
                del self.minute_window[client_id]
        
        # Clean hour window
        for client_id in list(self.hour_window.keys()):
            self.hour_window[client_id] = [
                t for t in self.hour_window[client_id] if t > cutoff_hour
            ]
            if not self.hour_window[client_id]:
                del self.hour_window[client_id]


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for monitoring and debugging with request context."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Generate request ID for this request
        request_id = generate_request_id()
        
        # Initialize context with minimal info (will be updated in endpoint if available)
        set_request_context(request_id, "", "", "")
        
        # Get client info
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        # Log request
        logger.info(f"Request: {request.method} {request.url.path} - Client: {client_ip} - RequestID: {request_id}")
        
        # Process request
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Get context for logging
            from request_context import get_request_context
            context = get_request_context()
            
            # Log response with context
            context_str = ""
            if context.get("session_id"):
                context_str = f" - Session: {context['session_id']}"
            if context.get("user_name"):
                context_str += f" - User: {context['user_name'][:20]}"
            
            logger.info(
                f"Response: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s{context_str}"
            )
            
            response.headers["X-Process-Time"] = str(process_time)
            response.headers["X-Request-ID"] = request_id
            if context.get("session_id"):
                response.headers["X-Session-ID"] = context["session_id"]
            return response
        except Exception as e:
            process_time = time.time() - start_time
            from request_context import get_request_context
            context = get_request_context()
            
            context_str = ""
            if context.get("session_id"):
                context_str = f" - Session: {context['session_id']}"
            if context.get("user_name"):
                context_str += f" - User: {context['user_name'][:20]}"
            
            logger.error(
                f"Error: {request.method} {request.url.path} - "
                f"Error: {str(e)} - "
                f"Time: {process_time:.3f}s{context_str}",
                exc_info=True
            )
            raise

