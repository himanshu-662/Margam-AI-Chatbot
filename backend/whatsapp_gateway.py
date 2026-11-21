"""
Margam AI - Meta WhatsApp Cloud API Gateway
PRD Phase 3: WhatsApp-Native Distribution & Omnichannel Continuity
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
import aiohttp
from dotenv import load_dotenv

from session_store import (
    normalize_phone, get_or_create_session, append_session_message,
    update_session_profile, mark_session_as_booked
)
from lead_scoring import calculate_lead_score

load_dotenv()
logger = logging.getLogger(__name__)

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "margam_ai_secret_token_2026")
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_COUNSELOR_PHONE = os.getenv("WHATSAPP_COUNSELOR_PHONE", "+919347997790").replace(" ", "")

OUTBOUND_LOG = os.path.join(os.path.dirname(__file__), "data", "outbound_whatsapp.jsonl")
os.makedirs(os.path.dirname(OUTBOUND_LOG), exist_ok=True)

def verify_webhook(mode: str, token: str, challenge: str) -> Optional[int]:
    """Verify webhook token for Meta WhatsApp Cloud API handshake."""
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        try:
            return int(challenge)
        except (ValueError, TypeError):
            return 0
    return None

async def send_whatsapp_message(to_phone: str, text: str) -> bool:
    """
    Send an outbound message via Meta WhatsApp Cloud API.
    Gracefully falls back to mock logger/queue if API credentials are not set.
    """
    norm_phone = normalize_phone(to_phone)
    
    # Check if Meta WhatsApp Cloud API credentials are provided
    if WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID:
        url = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": norm_phone,
            "type": "text",
            "text": {"preview_url": True, "body": text}
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=10) as resp:
                    resp_json = await resp.json()
                    if resp.status in [200, 201]:
                        logger.info(f"WhatsApp message dispatched to {norm_phone}")
                        return True
                    else:
                        logger.warning(f"Meta WhatsApp API returned error: {resp_json}")
        except Exception as e:
            logger.error(f"Failed to send message via Meta API: {e}", exc_info=True)

    # Sandbox / Local Testing Logger
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "to": norm_phone,
        "message": text,
        "simulated": not bool(WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID)
    }
    logger.info(f"[WHATSAPP OUTBOUND to {norm_phone}]: {text}")
    try:
        with open(OUTBOUND_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.error(f"Failed writing outbound log: {e}")

    return True

def format_for_whatsapp(text: str) -> str:
    """Format markdown text cleanly for WhatsApp readability."""
    clean = text.replace("**", "*") # Bold
    clean = clean.replace("### ", "*").replace("## ", "*").replace("# ", "*")
    clean = clean.replace("```", "")
    return clean.strip()

async def process_incoming_whatsapp_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core entrypoint for incoming Meta WhatsApp webhooks.
    Maintains omnichannel session continuity across Web & WhatsApp.
    """
    entry = payload.get("entry", [])
    if not entry:
        return {"status": "ignored", "reason": "empty_entry"}
        
    changes = entry[0].get("changes", [])
    if not changes:
        return {"status": "ignored", "reason": "empty_changes"}
        
    value = changes[0].get("value", {})
    messages = value.get("messages", [])
    if not messages:
        # Might be a status update (delivered, read)
        return {"status": "acknowledged", "type": "status_event"}

    msg_obj = messages[0]
    sender_phone = msg_obj.get("from", "")
    msg_type = msg_obj.get("type", "")
    
    if msg_type != "text":
        # Handle non-text messages (e.g. voice/audio or images)
        reply = "Thanks for reaching out to Margam AI! Please send your questions as text so I can assist you with your study abroad queries."
        await send_whatsapp_message(sender_phone, reply)
        return {"status": "handled", "type": "non_text"}

    incoming_text = msg_obj.get("text", {}).get("body", "").strip()
    if not incoming_text:
        return {"status": "ignored", "reason": "empty_text"}

    # Extract sender profile name if available
    contacts = value.get("contacts", [])
    profile_name = contacts[0].get("profile", {}).get("name", "there") if contacts else "there"

    # Step 1: Omnichannel Session Continuity (Load existing history from Web or prior WhatsApp turns)
    session = get_or_create_session(sender_phone, name=profile_name, channel="whatsapp")
    append_session_message(sender_phone, role="user", content=incoming_text, channel="whatsapp")
    
    # Format chat history for RAG engine
    history_formatted = [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in session.get("messages", [])[-8:]
    ]

    # Step 2: Route question through Margam Router
    from rag.nodes import route_question, extract_user_preferences, llm
    from rag.graph import retrieve
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser

    state = {
        "question": incoming_text,
        "user_name": profile_name,
        "chat_history": history_formatted,
        "use_web_search": False
    }

    loop = asyncio.get_event_loop()
    routing_res = await loop.run_in_executor(None, route_question, state)
    decision = routing_res.get("router_decision", "RAG")
    logger.info(f"WhatsApp message from {sender_phone} routed to: {decision}")

    bot_reply = ""
    is_escalation = False

    if decision == "ESCALATION":
        is_escalation = True
        escalation_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Margam AI on WhatsApp, an elite study abroad pre-counsellor.
The student has asked an execution question (shortlists, application portals, or detailed form walkthroughs).

PRD GUARDRAILS:
1. NEVER provide direct portal URLs (Uni-Assist, UCAS) or definitive university shortlists.
2. Follow the 3-sentence formula:
   - Part 1: Warm acknowledgement (e.g. "Totally get why you're asking about that, {user_name} — university selection depends heavily on your exact GPA, ECTS credits, and budget.")
   - Part 2: Strategic context creating a curiosity gap (e.g. "There are great zero-tuition options in Germany, but picking the right one requires auditing your syllabus to prevent rejections.")
   - Part 3: Direction to book a free call (e.g. "Our expert counsellors review your full profile for free. Would you like to schedule a quick 30-min call?")
3. TONE: Warm, friendly, WhatsApp-native 26-year-old friend persona. Never start with 'I'."""),
            ("human", "{question}")
        ])
        chain = escalation_prompt | llm | StrOutputParser()
        bot_reply = await loop.run_in_executor(None, chain.invoke, {"user_name": profile_name, "question": incoming_text})
        
        # Append WhatsApp CTA Card
        bot_reply += (
            f"\n\n📅 *Schedule Free 30-Min Strategy Call*\n"
            f"Reply *BOOK* or message our senior team directly at {WHATSAPP_COUNSELOR_PHONE} to lock in your slot."
        )

    elif decision in ["RAG", "FOLLOW_UP"]:
        retrieval_res = await loop.run_in_executor(None, retrieve, state)
        docs = retrieval_res.get("documents", [])
        
        context_parts = []
        for doc in docs[:4]:
            src = os.path.basename(doc.metadata.get("source", "Guide"))
            context_parts.append(f"--- {src} ---\n{doc.page_content[:1000]}")
        context_text = "\n\n".join(context_parts)

        rag_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Margam AI on WhatsApp, a knowledgeable 26-year-old elder sibling and study abroad mentor.

CRITICAL INSTRUCTIONS:
1. NEVER start responses with 'I'.
2. NEVER repeat the student's question.
3. Follow the 3-Sentence Response Formula:
   - Sentence 1-2 (The Answer): Direct, factual, data-grounded answer based on verified context.
   - Sentence 3 (Context/Insight): Strategic tip or insider perspective.
   - Sentence 4 (Direction): A natural forward-moving question or next step.
4. Total length: 3 to 4 sentences maximum. Keep it concise, WhatsApp-friendly, and confident.
5. Exact numbers when relevant: Germany Blocked Account €11,904/yr (€992/mo), UK maintenance £1,023/mo outside London.

CONTEXT:
{context}"""),
            ("human", "Conversation History:\n{history}\n\nStudent Question:\n{question}")
        ])
        history_text = "\n".join([f"{m.get('role', 'user').title()}: {m.get('content', '')[:200]}" for m in history_formatted[-4:]])
        chain = rag_prompt | llm | StrOutputParser()
        bot_reply = await loop.run_in_executor(
            None, chain.invoke,
            {"user_name": profile_name, "context": context_text, "history": history_text, "question": incoming_text}
        )

        # Profile Extraction & Lead Scoring
        user_profile = extract_user_preferences(incoming_text, history_formatted, session.get("user_profile", {}))
        lead_qual = calculate_lead_score(user_profile, history_formatted, incoming_text)
        update_session_profile(sender_phone, user_profile, lead_qual["score"], lead_qual["category"])

        # Step 5 Funnel Conversion Check on WhatsApp
        user_turns = sum(1 for m in session.get("messages", []) if m.get("role") in ["user", "human"])
        if user_turns >= 4 or lead_qual["category"] == "HOT":
            bot_reply += (
                f"\n\n💡 *Tip:* Our senior counsellors evaluate your profile and backlogs 1-on-1 for free. "
                f"Reply *YES* if you'd like us to set up a quick 30-min call."
            )

    else:
        # Conversational / Greeting
        conv_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Margam AI on WhatsApp.
Give a warm, friendly 1-2 sentence response. Never start with 'I'. Ask them which country or course they are exploring (Germany, UK, Ireland, France, USA)."""),
            ("human", "{question}")
        ])
        chain = conv_prompt | llm | StrOutputParser()
        bot_reply = await loop.run_in_executor(None, chain.invoke, {"question": incoming_text})

    # Step 3: Record bot reply in session store and dispatch to WhatsApp
    formatted_reply = format_for_whatsapp(bot_reply)
    append_session_message(sender_phone, role="assistant", content=formatted_reply, channel="whatsapp")
    await send_whatsapp_message(sender_phone, formatted_reply)

    return {
        "status": "success",
        "sender": sender_phone,
        "decision": decision,
        "is_escalation": is_escalation,
        "reply": formatted_reply
    }

