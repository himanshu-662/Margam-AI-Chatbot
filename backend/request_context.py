"""
Request context management for tracking user sessions and debugging.
"""
import uuid
from contextvars import ContextVar
from typing import Optional
from datetime import datetime

# Context variables for request tracking
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)
user_name_var: ContextVar[Optional[str]] = ContextVar('user_name', default=None)
user_phone_var: ContextVar[Optional[str]] = ContextVar('user_phone', default=None)

def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())[:8]

def generate_session_id(user_phone: str, user_name: str) -> str:
    """
    Generate or retrieve session ID based on user identifier.
    Uses first 8 chars of phone + first 4 chars of name for consistent sessions.
    """
    if user_phone:
        # Use phone as base for session ID (consistent across requests)
        phone_hash = str(hash(user_phone))[:8]
        name_hash = str(hash(user_name))[:4] if user_name else "0000"
        return f"{phone_hash}{name_hash}"
    # Fallback to UUID if no phone
    return str(uuid.uuid4())[:12]

def set_request_context(request_id: str, session_id: str, user_name: str, user_phone: str):
    """Set request context variables."""
    request_id_var.set(request_id)
    session_id_var.set(session_id)
    user_name_var.set(user_name)
    user_phone_var.set(user_phone)

def get_request_id() -> Optional[str]:
    """Get current request ID."""
    return request_id_var.get()

def get_session_id() -> Optional[str]:
    """Get current session ID."""
    return session_id_var.get()

def get_user_name() -> Optional[str]:
    """Get current user name."""
    return user_name_var.get()

def get_user_phone() -> Optional[str]:
    """Get current user phone."""
    return user_phone_var.get()

def get_request_context() -> dict:
    """Get all request context as a dictionary."""
    return {
        "request_id": get_request_id(),
        "session_id": get_session_id(),
        "user_name": get_user_name(),
        "user_phone": get_user_phone()
    }

def format_log_message(message: str, include_context: bool = True) -> str:
    """Format log message with request context."""
    if not include_context:
        return message
    
    context = get_request_context()
    parts = []
    
    if context.get("request_id"):
        parts.append(f"ReqID:{context['request_id']}")
    if context.get("session_id"):
        parts.append(f"Session:{context['session_id']}")
    if context.get("user_name"):
        # Truncate name for logging
        name = context['user_name'][:20]
        parts.append(f"User:{name}")
    if context.get("user_phone"):
        # Mask phone for privacy (show last 4 digits only)
        phone = context['user_phone']
        masked_phone = f"***{phone[-4:]}" if len(phone) >= 4 else "****"
        parts.append(f"Phone:{masked_phone}")
    
    if parts:
        return f"[{', '.join(parts)}] {message}"
    return message

