"""
Margam AI - Automated 24h Re-engagement Nudges Engine
PRD Phase 3: Proactive Follow-up & Conversion Recovery
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from session_store import list_all_sessions, save_session, append_session_message
from whatsapp_gateway import send_whatsapp_message, WHATSAPP_COUNSELOR_PHONE

logger = logging.getLogger(__name__)

def find_pending_nudges(min_hours_inactive: float = 20.0, force_all: bool = False) -> List[Dict[str, Any]]:
    """
    Identify student sessions eligible for a proactive re-engagement nudge:
    - Has engaged with the bot
    - Has not yet booked a consultation (has_booked == False)
    - Has not already received a nudge (nudge_sent == False)
    - Last interaction was >= min_hours_inactive ago (default 20-24h)
    """
    sessions = list_all_sessions()
    pending = []
    now = datetime.now()

    for s in sessions:
        if s.get("has_booked"):
            continue
        if s.get("nudge_sent") and not force_all:
            continue
        if not s.get("messages"):
            continue

        last_active_str = s.get("last_active")
        if not last_active_str:
            continue

        try:
            last_active = datetime.fromisoformat(last_active_str)
            hours_elapsed = (now - last_active).total_seconds() / 3600.0

            if force_all or hours_elapsed >= min_hours_inactive:
                pending.append({
                    "phone": s.get("phone"),
                    "name": s.get("name", "Student"),
                    "hours_inactive": round(hours_elapsed, 1),
                    "profile": s.get("user_profile", {}),
                    "lead_score": s.get("lead_score", 0),
                    "lead_category": s.get("lead_category", "COLD"),
                    "session_ref": s
                })
        except Exception as e:
            logger.warning(f"Error parsing session date for {s.get('phone')}: {e}")

    return pending

def generate_nudge_text(student_info: Dict[str, Any]) -> str:
    """
    Craft a warm, personalized 24h WhatsApp re-engagement nudge following PRD Tone rules.
    """
    name = student_info.get("name", "there")
    name_str = f" {name}" if name and name not in ["there", "Student", "anonymous"] else ""
    profile = student_info.get("profile", {})
    country = profile.get("target_country", "your target country")
    degree = profile.get("degree_level", "Master's")
    intake = profile.get("target_intake", "upcoming intake")

    nudge_templates = [
        (
            f"Hey{name_str}! Hope your week is going great. Just thinking about your plans for {country} ({intake}) — "
            f"admission deadlines for public universities approach earlier than most students realize. "
            f"Would you like our senior counsellors to evaluate your transcript and backlog eligibility for free?\n\n"
            f"Reply *YES* or tap below to set up a quick 30-min call:\n"
            f"👉 https://wa.me/919347997790?text=Hi%20Margam%20Team!%20I'd%20like%20to%20review%20my%20profile"
        ),
        (
            f"Hey{name_str}! Checking in on your study abroad journey. Choosing between universities in {country} "
            f"often comes down to course module matches and blocked account prep. "
            f"Our team at Margam can put together a personalized roadmap for your {degree} — 100% free.\n\n"
            f"Would tomorrow evening work for a 20-min WhatsApp catchup? Reply *YES* to confirm!"
        )
    ]

    import random
    return random.choice(nudge_templates)

async def trigger_reengagement_nudges(force_all: bool = False, min_hours: float = 20.0) -> Dict[str, Any]:
    """
    Process and dispatch re-engagement nudges for all eligible student sessions.
    """
    pending = find_pending_nudges(min_hours_inactive=min_hours, force_all=force_all)
    results = []

    for item in pending:
        phone = item["phone"]
        session = item["session_ref"]
        nudge_message = generate_nudge_text(item)

        # Dispatch via WhatsApp Gateway
        success = await send_whatsapp_message(phone, nudge_message)

        if success:
            # Update session state
            session["nudge_sent"] = True
            session["nudge_sent_at"] = datetime.now().isoformat()
            append_session_message(phone, role="assistant", content=nudge_message, channel="nudge")
            save_session(session)

            results.append({
                "phone": phone,
                "name": item["name"],
                "lead_category": item["lead_category"],
                "nudge_sent_at": session["nudge_sent_at"]
            })
            logger.info(f"Nudge sent to {phone} ({item['name']})")

    return {
        "status": "completed",
        "nudges_dispatched": len(results),
        "details": results
    }

