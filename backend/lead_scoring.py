"""
Margam AI - Lead Qualification, Scoring & Counselor Handover Dossier Engine
Compliant with Margam PRD Phase 2 (Monetization & Conversion Core)
"""

import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

import tempfile

logger = logging.getLogger(__name__)

IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
if IS_SERVERLESS:
    LEADS_DIR = os.path.join(tempfile.gettempdir(), "margam_leads")
    LEADS_JSON = os.path.join(tempfile.gettempdir(), "leads.json")
else:
    LEADS_DIR = os.path.join(os.path.dirname(__file__), "data", "leads")
    LEADS_JSON = os.path.join(os.path.dirname(__file__), "data", "leads.json")

try:
    os.makedirs(LEADS_DIR, exist_ok=True)
except Exception:
    pass

def calculate_lead_score(
    user_profile: Dict[str, Any],
    chat_history: List[Dict[str, str]],
    current_question: str = ""
) -> Dict[str, Any]:
    """
    Compute PRD-compliant lead qualification score (0-100) and assign category:
    - HOT (70-100): High intent, upcoming intake, budget/loan ready, test prepared.
    - WARM (40-69): Good intent, researching destinations or requirements.
    - COLD (0-39): Early exploratory or non-committal inquiries.
    """
    score = 0
    reasons = []
    
    # 1. Target Intake Proximity (Max 30 pts)
    intake = str(user_profile.get("target_intake", "")).lower()
    history_text = " ".join([m.get("content", "") for m in chat_history]).lower() + " " + current_question.lower()
    
    if any(k in intake or k in history_text for k in ["fall 2026", "winter 2026", "spring 2027", "summer 2027", "2026 intake"]):
        score += 30
        reasons.append("Target intake is within next 6-9 months (Fall 2026 / Spring 2027)")
    elif any(k in intake or k in history_text for k in ["2027", "fall 2027", "next year", "upcoming intake"]):
        score += 20
        reasons.append("Target intake identified for 2027")
    elif intake:
        score += 15
        reasons.append(f"Intake mentioned: {user_profile.get('target_intake')}")
        
    # 2. Budget & Financial Readiness (Max 25 pts)
    budget = str(user_profile.get("budget_range", "")).lower()
    if any(k in budget or k in history_text for k in [
        "blocked account", "sperrkonto", "loan", "education loan", "self funded",
        "tuition fee", "lakhs", "eur", "gbp", "inr", "free tuition", "zero tuition", "budget"
    ]):
        score += 25
        reasons.append("Financial readiness / budget discussed (loan or blocked account aware)")
    elif budget:
        score += 15
        reasons.append(f"Budget indicated: {user_profile.get('budget_range')}")

    # 3. Test Scores & Academic Preparation (Max 20 pts)
    test_scores = str(user_profile.get("test_scores", "")).lower()
    degree = str(user_profile.get("degree_level", "")).lower()
    if any(k in test_scores or k in history_text for k in [
        "ielts", "toefl", "pte", "gre", "gmat", "german language", "a1", "a2", "b1", "b2", "aps"
    ]):
        score += 20
        reasons.append("Standardized test or language preparation identified (IELTS/PTE/GRE/APS)")
    elif degree or user_profile.get("field_of_study"):
        score += 10
        reasons.append(f"Specific degree/field identified: {user_profile.get('degree_level', 'Degree')} in {user_profile.get('field_of_study', 'Specified Field')}")

    # 4. Engagement Depth (Max 15 pts)
    user_turns = sum(1 for m in chat_history if m.get("role") in ["user", "human"])
    if user_turns >= 4:
        score += 15
        reasons.append(f"High engagement depth ({user_turns} user turns exchanged)")
    elif user_turns >= 2:
        score += 10
        reasons.append(f"Moderate engagement depth ({user_turns} user turns)")
    else:
        score += 5
        reasons.append("New inquiry session")

    # 5. Target Country Specificity (Max 10 pts)
    country = user_profile.get("target_country", "")
    if country and country != "Study Abroad":
        score += 10
        reasons.append(f"Destination established: {country}")
    elif any(c in history_text for c in ["germany", "uk", "ireland", "france", "usa", "canada", "australia"]):
        score += 8
        reasons.append("Specific study destination actively discussed in chat")

    # Cap score at 100
    final_score = min(score, 100)
    
    # Determine Tier
    if final_score >= 70:
        category = "HOT"
        action = "Priority Outreach: Call within 2 hours with tailored university roadmap."
    elif final_score >= 40:
        category = "WARM"
        action = "Nurture: Share intake timelines and schedule 30-min discovery session."
    else:
        category = "COLD"
        action = "Exploratory: Send country comparison guide and invite to webinar/group session."

    # Identify Anxiety / Discussion Points
    anxieties = []
    if any(k in history_text for k in ["backlog", "low gpa", "cgpa", "rejection", "gap"]):
        anxieties.append("Concerned about academic backlogs, GPA or study gaps")
    if any(k in history_text for k in ["cost", "expensive", "fee", "afford", "loan", "blocked"]):
        anxieties.append("Anxious about living costs, blocked account or loan approvals")
    if any(k in history_text for k in ["visa", "refusal", "rejection", "interview"]):
        anxieties.append("Visa processing, interview nervousness or rejection risks")
    if any(k in history_text for k in ["shortlist", "ranking", "which university", "admit"]):
        anxieties.append("Uncertain about which universities will accept their profile")

    if not anxieties:
        anxieties.append("General exploration of intake requirements and timelines")

    return {
        "score": final_score,
        "category": category,
        "reasons": reasons,
        "anxiety_points": anxieties,
        "recommended_action": action
    }

def generate_counselor_dossier(
    booking_data: Dict[str, Any],
    qualification: Dict[str, Any],
    chat_history: List[Dict[str, str]]
) -> str:
    """
    Generate a 1-page Student Profile Brief / Handover Dossier for the assigned counselor.
    """
    student_name = booking_data.get("name", "Student")
    phone = booking_data.get("phone", "Not provided")
    country = booking_data.get("target_country", "Germany")
    degree = booking_data.get("degree", "Master's")
    intake = booking_data.get("intake", "Fall 2026")
    slot = booking_data.get("preferred_time", "Immediate")
    mode = booking_data.get("preferred_mode", "WhatsApp")
    score = qualification.get("score", 70)
    category = qualification.get("category", "HOT")
    reasons = qualification.get("reasons", [])
    anxieties = qualification.get("anxiety_points", [])
    action = qualification.get("recommended_action", "")
    booking_id = booking_data.get("booking_id", f"MRG-{uuid.uuid4().hex[:6].upper()}")
    created_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    # Format key chat summary
    recent_msgs = [f"- **{m.get('role', 'user').title()}**: {m.get('content', '')[:180]}" for m in chat_history[-6:]]
    history_summary = "\n".join(recent_msgs) if recent_msgs else "- No previous web chat history recorded."

    reasons_md = "\n".join([f"- {r}" for r in reasons])
    anxieties_md = "\n".join([f"- ⚠️ {a}" for a in anxieties])

    dossier = f"""# 📋 MARGAM COUNSELOR HANDOVER DOSSIER
**Booking Reference:** `{booking_id}` | **Generated:** {created_at}

---

## 🎯 LEAD STATUS & PRIORITY
| Metric | Value |
| :--- | :--- |
| **Lead Classification** | **{category} LEAD** |
| **Qualification Score** | **{score} / 100** |
| **Recommended Action** | {action} |

### Scoring Drivers:
{reasons_md}

---

## 👤 STUDENT PROFILE
- **Name:** {student_name}
- **Phone / WhatsApp:** {phone}
- **Target Country:** {country}
- **Target Degree:** {degree}
- **Target Intake:** {intake}
- **Preferred Slot:** {slot}
- **Preferred Channel:** {mode.upper()}

---

## ⚠️ KEY ANXIETY POINTS & STUDENT CONCERNS
{anxieties_md}

---

## 💡 COUNSELOR PITCH STRATEGY
1. **Opener:** Acknowledge their target intake ({intake}) and interest in {country}. Mention that their profile shows strong potential.
2. **Value Hook:** Address their specific concerns ({anxieties[0] if anxieties else 'university shortlisting'}) right up front.
3. **Margam Advantage:** Explain that founder Jeevithram personally reviews SOPs and that Margam operates on a genuine student-first model (0 upfront fees, pay after booking).

---

## 💬 RECENT CONVERSATION HIGHLIGHTS
{history_summary}
"""
    return dossier

def save_lead_dossier(booking_data: Dict[str, Any], qualification: Dict[str, Any], dossier_md: str) -> str:
    """Save lead dossier to filesystem and update leads index."""
    booking_id = booking_data.get("booking_id", f"MRG-{uuid.uuid4().hex[:6].upper()}")
    filename = f"{booking_id}_{booking_data.get('phone', 'lead')}.md"
    file_path = os.path.join(LEADS_DIR, filename)

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(dossier_md)
    except Exception as e:
        logger.error(f"Error saving lead dossier file: {e}")

    # Append to leads.json
    try:
        leads_list = []
        if os.path.exists(LEADS_JSON):
            with open(LEADS_JSON, "r", encoding="utf-8") as f:
                try:
                    leads_list = json.load(f)
                except Exception:
                    leads_list = []

        lead_entry = {
            "booking_id": booking_id,
            "timestamp": datetime.now().isoformat(),
            "name": booking_data.get("name"),
            "phone": booking_data.get("phone"),
            "target_country": booking_data.get("target_country"),
            "degree": booking_data.get("degree"),
            "intake": booking_data.get("intake"),
            "preferred_time": booking_data.get("preferred_time"),
            "preferred_mode": booking_data.get("preferred_mode"),
            "lead_score": qualification.get("score"),
            "lead_category": qualification.get("category"),
            "dossier_path": file_path
        }
        leads_list.append(lead_entry)

        with open(LEADS_JSON, "w", encoding="utf-8") as f:
            json.dump(leads_list, f, indent=2)
    except Exception as e:
        logger.error(f"Error updating leads.json: {e}")

    return file_path

