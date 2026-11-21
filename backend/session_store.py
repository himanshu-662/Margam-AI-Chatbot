"""
Margam AI - Omnichannel Session Continuity Engine (Web + WhatsApp)
Compliant with Margam PRD Phase 3
"""

import os
import json
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "data", "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

def normalize_phone(phone: str) -> str:
    """Normalize phone number to digits only (e.g. +91 98480-22338 -> 919848022338)."""
    if not phone:
        return "anonymous"
    digits = re.sub(r"\D", "", phone)
    # If 10 digits (Indian standard), prepend 91 for international WhatsApp format
    if len(digits) == 10:
        digits = "91" + digits
    return digits

def get_session_file_path(phone: str) -> str:
    """Get absolute path to session JSON file."""
    norm_phone = normalize_phone(phone)
    return os.path.join(SESSIONS_DIR, f"{norm_phone}.json")

def get_or_create_session(phone: str, name: str = "", channel: str = "web") -> Dict[str, Any]:
    """Retrieve existing omnichannel session or initialize a fresh one."""
    norm_phone = normalize_phone(phone)
    file_path = get_session_file_path(norm_phone)
    
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                session = json.load(f)
                # Update name if previously anonymous
                if name and (session.get("name") in ["", "Student", "there", "anonymous"]):
                    session["name"] = name
                return session
        except Exception as e:
            logger.error(f"Error reading session file {file_path}: {e}")

    # Create new omnichannel session
    now = datetime.now()
    session = {
        "phone": norm_phone,
        "name": name if name else "Student",
        "primary_channel": channel,
        "created_at": now.isoformat(),
        "last_active": now.isoformat(),
        "messages": [],
        "user_profile": {},
        "lead_score": 0,
        "lead_category": "COLD",
        "has_booked": False,
        "nudge_scheduled_at": (now + timedelta(hours=24)).isoformat(),
        "nudge_sent": False
    }
    save_session(session)
    return session

def save_session(session: Dict[str, Any]) -> bool:
    """Save session object to disk."""
    norm_phone = session.get("phone", "anonymous")
    file_path = get_session_file_path(norm_phone)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(session, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Error saving session {norm_phone}: {e}")
        return False

def append_session_message(phone: str, role: str, content: str, channel: str = "web") -> Dict[str, Any]:
    """Append a message to the student's omnichannel history and update active timestamp."""
    session = get_or_create_session(phone, channel=channel)
    now = datetime.now()
    
    msg_entry = {
        "role": role,
        "content": content,
        "channel": channel,
        "timestamp": now.isoformat()
    }
    session["messages"].append(msg_entry)
    # Keep up to 30 most recent messages for context
    if len(session["messages"]) > 30:
        session["messages"] = session["messages"][-30:]
        
    session["last_active"] = now.isoformat()
    # Update re-engagement nudge schedule for 24h after this interaction
    session["nudge_scheduled_at"] = (now + timedelta(hours=24)).isoformat()
    save_session(session)
    return session

def update_session_profile(phone: str, profile_update: Dict[str, Any], lead_score: Optional[int] = None, lead_category: Optional[str] = None):
    """Merge profile attributes and update lead scoring."""
    session = get_or_create_session(phone)
    if profile_update:
        session["user_profile"].update({k: v for k, v in profile_update.items() if v})
    if lead_score is not None:
        session["lead_score"] = lead_score
    if lead_category:
        session["lead_category"] = lead_category
    save_session(session)
    return session

def mark_session_as_booked(phone: str):
    """Mark that student has booked a consultation to suppress future nudges."""
    session = get_or_create_session(phone)
    session["has_booked"] = True
    save_session(session)
    return session

def list_all_sessions() -> List[Dict[str, Any]]:
    """List all active omnichannel student sessions."""
    sessions = []
    if not os.path.exists(SESSIONS_DIR):
        return []
    for fname in os.listdir(SESSIONS_DIR):
        if fname.endswith(".json"):
            try:
                with open(os.path.join(SESSIONS_DIR, fname), "r", encoding="utf-8") as f:
                    sessions.append(json.load(f))
            except Exception:
                continue
    # Sort descending by last_active
    sessions.sort(key=lambda s: s.get("last_active", ""), reverse=True)
    return sessions

