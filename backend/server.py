import os
import asyncio
import sys
import json
import io
import re
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, APIRouter
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from rag.graph import app as rag_graph
from rag.nodes import llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from datetime import datetime
import uuid
import urllib.parse
import aiofiles
from typing import Optional, List, Dict, Any
from lead_scoring import calculate_lead_score, generate_counselor_dossier, save_lead_dossier
from session_store import (
    append_session_message, update_session_profile, mark_session_as_booked, get_or_create_session
)
from whatsapp_gateway import verify_webhook, process_incoming_whatsapp_message, send_whatsapp_message
from nudge_engine import find_pending_nudges, trigger_reengagement_nudges

# Import logging and middleware
from logging_config import logger, setup_logging
from middleware import RateLimitMiddleware, RequestLoggingMiddleware
from request_context import (
    generate_request_id, generate_session_id, set_request_context,
    get_request_context, format_log_message
)

# Setup logging
setup_logging(
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    log_dir=os.getenv("LOG_DIR", "logs")
)

# Rate limit configuration (needed before lifespan)
rate_limit_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
rate_limit_hour = int(os.getenv("RATE_LIMIT_PER_HOUR", "300"))

# Lifespan context manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Margam AI Backend starting up...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'production')}")
    logger.info(f"Log Level: {os.getenv('LOG_LEVEL', 'INFO')}")
    logger.info(f"Rate Limit: {rate_limit_minute}/min, {rate_limit_hour}/hour")
    logger.info("Margam AI Backend started successfully")
    
    yield
    
    # Shutdown
    logger.info("Margam AI Backend shutting down...")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Margam AI Backend",
    description="Production-ready RAG-powered study abroad assistant",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
    redoc_url="/redoc" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
    lifespan=lifespan
)

# CORS Configuration - Production ready
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware, 
                   calls_per_minute=rate_limit_minute,
                   calls_per_hour=rate_limit_hour)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Initialize API router to mount on both root and /api prefixes
router = APIRouter()

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=5000, description="User's question")
    user_name: str = Field(..., min_length=1, max_length=200, description="User's name")
    phone: str = Field(..., min_length=1, max_length=50, description="User's phone number")
    chat_history: list[dict] = Field(default_factory=list, max_length=20, description="Chat history")
    use_web_search: bool = Field(default=False, description="Enable web search for this request")
    
    @field_validator('question')
    @classmethod
    def validate_question(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Question cannot be empty")
        return v.strip()
    
    @field_validator('chat_history')
    @classmethod
    def validate_chat_history(cls, v: list) -> list:
        if len(v) > 20:
            logger.warning(f"Chat history truncated from {len(v)} to 20 messages")
            return v[-20:]
        return v

class BookingRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=1, max_length=50)
    target_country: Optional[str] = "Germany"
    degree: Optional[str] = "Master's"
    intake: Optional[str] = "Fall 2026"
    preferred_time: Optional[str] = "Tomorrow Evening (6 PM - 8 PM)"
    preferred_mode: Optional[str] = "whatsapp"
    chat_history: list[dict] = Field(default_factory=list)
    user_profile: dict = Field(default_factory=dict)


async def log_lead_async(name: str, phone: str, question: str):
    """Async logging of leads to CSV file - non-blocking"""
    try:
        leads_file = os.getenv("LEADS_FILE", "leads.csv")
        file_exists = os.path.exists(leads_file)
        
        # Sanitize inputs for CSV
        safe_name = name.replace(",", ";").replace("\n", " ")
        safe_phone = phone.replace(",", ";").replace("\n", " ")
        safe_question = question.replace(",", ";").replace("\n", " ")[:1000]  # Limit question length
        
        async with aiofiles.open(leads_file, "a", encoding="utf-8") as f:
            if not file_exists:
                await f.write("timestamp,name,phone,question\n")
            await f.write(f"{datetime.now().isoformat()},{safe_name},{safe_phone},{safe_question}\n")
    except Exception as e:
        logger.error(f"Failed to log lead: {e}", exc_info=True)

@router.get("/")
async def read_root():
    """Root endpoint - basic service status"""
    return {
        "status": "ok",
        "service": "Margam AI RAG Backend",
        "version": "1.0.0"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring"""
    try:
        # Check if vector store is accessible
        from rag.config import DB_DIR
        db_accessible = os.path.exists(DB_DIR)
        
        return {
            "status": "healthy" if db_accessible else "degraded",
            "timestamp": datetime.now().isoformat(),
            "database": "accessible" if db_accessible else "unavailable"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

def process_rag_result(result: dict) -> dict:
    """Extract clean response, follow-up chips, citations, and profile from RAG result."""
    raw_generation = result.get("generation", "")
    
    # Extract suggestions if embedded with <!-- SUGGESTIONS_START -->
    suggestions = []
    clean_text = raw_generation
    if "<!-- SUGGESTIONS_START -->" in raw_generation:
        parts = raw_generation.split("<!-- SUGGESTIONS_START -->")
        clean_text = parts[0].strip()
        suggestions_part = parts[1]
        for line in suggestions_part.split("\n"):
            line = line.strip()
            if line.startswith("- ") or line.startswith("* "):
                q = line[2:].strip()
                if q and len(q) > 3:
                    suggestions.append(q)
    
    # Fallback to intelligent_recommendations if needed
    rec = result.get("intelligent_recommendations", {})
    if not suggestions and isinstance(rec, dict):
        rec_questions = rec.get("questions", [])
        if isinstance(rec_questions, list):
            for q in rec_questions:
                if isinstance(q, str) and q.strip():
                    suggestions.append(q.strip())
                    
    # Extract rich citations with snippet and page number
    documents = result.get("documents", [])
    citations = []
    seen = set()
    for doc in documents:
        if doc and hasattr(doc, 'metadata') and doc.metadata:
            source_raw = doc.metadata.get("source", "Margam Knowledge Base")
            source_name = os.path.basename(source_raw)
            page = doc.metadata.get("page", 0)
            page_num = page + 1 if isinstance(page, int) else page
            
            key = (source_name, page_num)
            if key not in seen:
                seen.add(key)
                content = getattr(doc, "page_content", "") or ""
                snippet = content[:280].strip().replace("\n", " ")
                citations.append({
                    "source": source_name,
                    "page": page_num,
                    "snippet": snippet
                })
    
    user_profile = result.get("user_profile", {})
    is_escalation = result.get("is_escalation", False)
    cta_type = result.get("cta_type", "")
    
    return {
        "response": clean_text if clean_text else raw_generation,
        "suggestions": suggestions[:4],
        "citations": citations[:8],
        "sources": [c["source"] for c in citations[:8]],
        "user_profile": user_profile,
        "is_escalation": is_escalation,
        "cta_type": cta_type
    }

@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Handle standard chat requests returning response, citations, suggestions & profile.
    """
    request_id = generate_request_id()
    user_name = request.user_name.strip() if request.user_name.strip() else "there"
    session_id = generate_session_id(request.phone, user_name)
    set_request_context(request_id, session_id, user_name, request.phone)
    
    try:
        logger.info(
            f"Processing chat request - Question: {request.question[:100]}... - "
            f"History length: {len(request.chat_history)} messages"
        )
        
        asyncio.create_task(log_lead_async(user_name, request.phone, request.question))
        
        inputs = {
            "question": request.question,
            "user_name": user_name,
            "chat_history": request.chat_history,
            "use_web_search": request.use_web_search,
            "request_id": request_id,
            "session_id": session_id
        }
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, rag_graph.invoke, inputs)
        processed = process_rag_result(result)
        
        # Phase 2: Lead Qualification & Scoring
        lead_qual = calculate_lead_score(
            user_profile=processed.get("user_profile", {}),
            chat_history=request.chat_history,
            current_question=request.question
        )
        
        # Phase 3: Omnichannel Session Sync
        append_session_message(request.phone, role="user", content=request.question, channel="web")
        append_session_message(request.phone, role="assistant", content=processed["response"], channel="web")
        update_session_profile(request.phone, processed["user_profile"], lead_qual["score"], lead_qual["category"])
        
        return {
            "response": processed["response"],
            "sources": processed["sources"],
            "citations": processed["citations"],
            "suggestions": processed["suggestions"],
            "user_profile": processed["user_profile"],
            "is_escalation": processed.get("is_escalation", False),
            "cta_type": processed.get("cta_type", ""),
            "lead_score": lead_qual["score"],
            "lead_category": lead_qual["category"],
            "lead_action": lead_qual["recommended_action"],
            "request_id": request_id,
            "session_id": session_id
        }
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while processing your request.")

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    True real-time Server-Sent Events (SSE) streaming endpoint with live token emission.
    """
    request_id = generate_request_id()
    user_name = request.user_name.strip() if request.user_name.strip() else "there"
    session_id = generate_session_id(request.phone, user_name)
    set_request_context(request_id, session_id, user_name, request.phone)
    
    asyncio.create_task(log_lead_async(user_name, request.phone, request.question))
    
    async def event_generator():
        try:
            # Step 1: Initial status
            yield f"event: status\ndata: {json.dumps({'status': 'analyzing', 'message': 'Analyzing question & checking verified guides...'})}\n\n"
            await asyncio.sleep(0.01)
            
            from rag.nodes import route_question, get_follow_up_questions, extract_user_preferences
            from rag.graph import retrieve
            
            state = {
                "question": request.question,
                "user_name": user_name,
                "chat_history": request.chat_history,
                "use_web_search": request.use_web_search
            }
            
            loop = asyncio.get_event_loop()
            routing_res = await loop.run_in_executor(None, route_question, state)
            decision = routing_res.get("router_decision", "RAG")
            
            citations = []
            sources = []
            
            if decision in ["RAG", "FOLLOW_UP", "ESCALATION"]:
                yield f"event: status\ndata: {json.dumps({'status': 'retrieving', 'message': 'Retrieving university & visa documents...'})}\n\n"
                retrieval_res = await loop.run_in_executor(None, retrieve, state)
                docs = retrieval_res.get("documents", [])
                
                # Extract and deduplicate rich citations
                seen = set()
                for doc in docs:
                    if doc and hasattr(doc, 'metadata') and doc.metadata:
                        source_raw = doc.metadata.get("source", "Margam Knowledge Base")
                        source_name = os.path.basename(source_raw)
                        page = doc.metadata.get("page", 0)
                        page_num = page + 1 if isinstance(page, int) else page
                        
                        key = (source_name, page_num)
                        if key not in seen:
                            seen.add(key)
                            content = getattr(doc, "page_content", "") or ""
                            snippet = content[:280].strip().replace("\n", " ")
                            citations.append({
                                "source": source_name,
                                "page": page_num,
                                "snippet": snippet
                            })
                sources = [c["source"] for c in citations[:8]]
                citations = citations[:8]
                
                # Emit citations metadata immediately so user sees sources while generation begins
                yield f"event: metadata\ndata: {json.dumps({'citations': citations, 'sources': sources})}\n\n"
                
                # Build context
                context_parts = []
                for doc in docs[:6]:
                    src = os.path.basename(doc.metadata.get('source', 'Guide'))
                    pg = doc.metadata.get('page', 0) + 1
                    context_parts.append(f"--- Document: {src} (Page {pg}) ---\n{doc.page_content[:1400]}")
                context_text = "\n\n".join(context_parts)
                
                history_text = "\n".join([
                    f"{m.get('role', 'user').title()}: {m.get('content', '')[:300]}"
                    for m in request.chat_history[-6:]
                ])
                
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are Margam AI, an intelligent, empathetic, and exceptionally thorough study abroad mentor — structured and explanatory in the style of ChatGPT.

OBJECTIVE:
Answer EVERY question the user asks comprehensively, clearly, and insightfully. Never give robotic refusals or dismissive one-liners. Break down complex topics into clear, well-structured, easy-to-read sections.

EXPLANATION & FORMATTING STYLE (ChatGPT-Style):
1. **Direct Answer & Big Picture First**: Start with a clear, direct answer to the user's specific question.
2. **Structured & Logical Breakdown**:
   - Use bold markdown headers (###), bullet points, and numbered lists to structure points logically.
   - For comparisons, fees, or timelines: use markdown tables for crystal clarity.
   - For step-by-step procedures: break them into sequential numbered stages with clear explanations of what happens, why, and what to watch out for.
3. **Deep & Insightful Explanations**:
   - Explain the "why" and "how" behind policies, visa criteria, tests, and admission requirements.
   - Provide concrete examples, realistic timelines, and practical tips.
4. **Key Verification Data**:
   - Germany Blocked Account: €11,904/year (€992/month).
   - UK Maintenance Funds: £1,023/month outside London, £1,334/month inside London (up to 9 months).
   - Canada GIC requirement: CAD $20,635.
   - Australia Subclass 500 Living Capacity: AUD $29,710.
5. **Margam's Value & Next Steps**:
   - Address {user_name} warmly and conversationally.
   - Conclude with logical next actions or thoughtful follow-up considerations.
   - Mention Margam's free mentorship (profile evaluations, SOP reviews by founder Jeevithram Mamidala, visa counseling) naturally as an available resource to help them take the next step.

VERIFIED KNOWLEDGE CONTEXT:
{context}"""),
                    ("human", "Conversation History:\n{history}\n\nStudent Question:\n{question}")
                ])
                
                chain = prompt | llm | StrOutputParser()
                stream_inputs = {
                    "user_name": user_name,
                    "context": context_text,
                    "history": history_text,
                    "question": request.question
                }
                
                # Live token streaming with smooth pacing
                accumulated_text = ""
                async for chunk in chain.astream(stream_inputs):
                    token_text = chunk if isinstance(chunk, str) else str(chunk)
                    if token_text:
                        accumulated_text += token_text
                        parts = re.split(r'(\s+)', token_text)
                        for part in parts:
                            if part:
                                yield f"event: token\ndata: {json.dumps({'token': part})}\n\n"
                                await asyncio.sleep(0.018)
                
                # Follow-up inquiry chips
                follow_ups = get_follow_up_questions(request.question, "", "", request.chat_history)
                if not follow_ups:
                    follow_ups = [
                        "What is the blocked account requirement?",
                        "What are the document deadlines?",
                        "Can I work part-time during my studies?"
                    ]
                
                # Profile updates & Lead qualification
                user_profile = extract_user_preferences(request.question, request.chat_history, {})
                lead_qual = calculate_lead_score(user_profile, request.chat_history, request.question)
                user_turns = sum(1 for m in request.chat_history if m.get("role") in ["user", "human"]) + 1
                
                # Phase 3: Omnichannel Session Sync
                append_session_message(request.phone, role="user", content=request.question, channel="web")
                append_session_message(request.phone, role="assistant", content=accumulated_text, channel="web")
                update_session_profile(request.phone, user_profile, lead_qual["score"], lead_qual["category"])
                
                proactive_escalation = (decision == "ESCALATION") or user_turns >= 5 or (user_turns >= 4 and lead_qual["score"] >= 70)
                if proactive_escalation and "📅 Book free 30-min strategy session" not in follow_ups:
                    follow_ups.insert(0, "📅 Book free 30-min strategy session")

                meta = {
                    "citations": citations,
                    "sources": sources,
                    "suggestions": follow_ups[:4],
                    "user_profile": user_profile,
                    "is_escalation": proactive_escalation,
                    "cta_type": "book_consultation" if proactive_escalation else "",
                    "lead_score": lead_qual["score"],
                    "lead_category": lead_qual["category"],
                    "request_id": request_id,
                    "session_id": session_id
                }
                yield f"event: metadata\ndata: {json.dumps(meta)}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"
            
            else:
                # Conversational routing (greeting, acknowledgment, off-topic)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are Margam AI, an intelligent, empathetic, and exceptionally thorough study abroad mentor — structured and explanatory in the style of ChatGPT.

Answer {user_name}'s message in a clear, comprehensive, and engaging manner.
- If it is a greeting: Give a warm welcome, introduce yourself as Margam AI (your 24/7 study abroad mentor), and explain how you can help them navigate study abroad across Germany, UK, USA, Canada, Australia, Ireland, and France (admissions, visas, budgets, blocked accounts, SOP reviews, and scholarships).
- If it is a general question or off-topic: Answer their question thoroughly and thoughtfully like ChatGPT, providing great context and connecting back to global education, career growth, or studying abroad wherever appropriate.
- Always use clear formatting, bullet points, and well-structured explanations."""),
                    ("human", "{question}")
                ])
                chain = prompt | llm | StrOutputParser()
                async for chunk in chain.astream({"user_name": user_name, "question": request.question}):
                    token_text = chunk if isinstance(chunk, str) else str(chunk)
                    if token_text:
                        parts = re.split(r'(\s+)', token_text)
                        for part in parts:
                            if part:
                                yield f"event: token\ndata: {json.dumps({'token': part})}\n\n"
                                await asyncio.sleep(0.018)
                
                yield f"event: metadata\ndata: {json.dumps({'suggestions': ['Study in Germany with €0 tuition', 'UK Student Visa Checklist', 'Blocked Account (€11,904) step-by-step', 'Living expenses in Ireland'], 'citations': [], 'sources': []})}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"
        
        except Exception as e:
            logger.error(f"Error in chat_stream: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    doc_type: str = Form("sop"), # "sop", "resume", "transcript", "general"
    country: str = Form("Germany"),
    target_degree: str = Form("Master's")
):
    """
    Analyze student uploaded documents (SOP, CV, transcripts) for study abroad suitability.
    """
    try:
        content_bytes = await file.read()
        filename = file.filename.lower()
        extracted_text = ""
        
        if filename.endswith(".pdf"):
            import pypdf
            pdf_reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        elif filename.endswith(".docx"):
            import docx
            doc = docx.Document(io.BytesIO(content_bytes))
            for p in doc.paragraphs:
                extracted_text += p.text + "\n"
        else:
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
            
        extracted_text = extracted_text.strip()
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract readable text from document.")
            
        # Truncate to reasonable length
        sample_text = extracted_text[:8000]
        
        eval_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Margam AI's Senior Study Abroad Admissions & Visa Auditor.
Analyze the student's document rigorously for admissions and visa credibility to {country} for {degree}.

CRITICAL PRD AUDIT GUARDRAILS:
1. OPERATE STRICTLY IN DIAGNOSTIC & ADVISORY MODE.
2. DO NOT WRITE, GHOSTWRITE, OR REWRITE THE ESSAY OR PARAGRAPHS FOR THE STUDENT.
3. Diagnose structure, academic clarity, tone, and red flags for visa/university officers.
4. Highlight that Margam's founder Jeevithram personally reviews and mentors students on SOP drafts.

Provide your critique in structured JSON matching this schema:
{{
  "document_type": "{doc_type}",
  "overall_score": 8, // Integer 1-10
  "verdict": "Competitive / Needs Polish / High Risk",
  "summary": "2-3 sentence executive audit summary",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "critical_gaps": ["gap 1", "gap 2", "gap 3"],
  "country_specific_advice": "Specific insights for {country} (e.g. ECTS module alignment for Germany, CAS / career story for UK, 214(b) non-immigrant ties for USA)",
  "action_checklist": ["Immediate fix 1", "Immediate fix 2", "Immediate fix 3"],
  "founder_review_note": "Margam founder Jeevithram personally reviews every student's SOP to craft a compelling, authentic story without generic AI clichés."
}}
Return ONLY valid JSON. No conversational intro or markdown wraps."""),
            ("human", "Document Name: {filename}\n\nDocument Content:\n{content}")
        ])
        
        chain = eval_prompt | llm | JsonOutputParser()
        analysis = await asyncio.get_event_loop().run_in_executor(
            None, 
            chain.invoke, 
            {
                "country": country,
                "degree": target_degree,
                "doc_type": doc_type,
                "filename": file.filename,
                "content": sample_text
            }
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "analysis": analysis
        }
    except Exception as e:
        logger.error(f"Document analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to analyze document: {str(e)}")

class RoadmapRequest(BaseModel):
    user_name: str
    user_profile: dict
    chat_history: list[dict]

@router.post("/export-roadmap")
async def export_roadmap(request: RoadmapRequest):
    """
    Synthesize the student's consultation into a formal, downloadable Study Abroad Action Plan.
    """
    try:
        profile_str = json.dumps(request.user_profile, indent=2)
        history_str = "\n".join([f"{m.get('role', 'user').title()}: {m.get('content', '')[:300]}" for m in request.chat_history[-10:]])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Margam AI. Generate a comprehensive, professional, student-ready Study Abroad Roadmap & Visa Checklist in clean Markdown.
Include:
1. Executive Profile Summary (Destination, Intake, Field, Budget)
2. University Shortlisting Strategy & Deadlines
3. Financial Requirements & Blocked Account / Maintenance Funds Breakdown
4. Visa Application Step-by-Step Checklist (Documents, Appointments, Timelines)
5. Margam Mentor Tips & Next Action Items
Ensure high readability with clean tables and checklists."""),
            ("human", "Student Name: {name}\nProfile: {profile}\nConsultation Summary:\n{history}")
        ])
        
        chain = prompt | llm | StrOutputParser()
        roadmap_md = await asyncio.get_event_loop().run_in_executor(
            None,
            chain.invoke,
            {"name": request.user_name, "profile": profile_str, "history": history_str}
        )
        
        return {
            "status": "success",
            "roadmap_markdown": roadmap_md
        }
    except Exception as e:
        logger.error(f"Roadmap export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate roadmap.")

@router.post("/book-consultation")
async def book_consultation(request: BookingRequest):
    """
    Process consultation booking, compute lead score, generate counselor dossier,
    and return structured handover metadata with direct WhatsApp link.
    """
    try:
        booking_id = f"MRG-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
        booking_data = {
            "booking_id": booking_id,
            "name": request.name,
            "phone": request.phone,
            "target_country": request.target_country,
            "degree": request.degree,
            "intake": request.intake,
            "preferred_time": request.preferred_time,
            "preferred_mode": request.preferred_mode
        }
        
        # Calculate qualification score
        profile_data = request.user_profile or {
            "target_country": request.target_country,
            "degree_level": request.degree,
            "target_intake": request.intake
        }
        qualification = calculate_lead_score(
            user_profile=profile_data,
            chat_history=request.chat_history,
            current_question=""
        )
        
        # Generate 1-page counselor dossier
        dossier_md = generate_counselor_dossier(booking_data, qualification, request.chat_history)
        
        # Persist dossier
        file_path = save_lead_dossier(booking_data, qualification, dossier_md)
        # Mark omnichannel session as booked to suppress further re-engagement nudges
        mark_session_as_booked(request.phone)
        
        # Build pre-filled WhatsApp message
        wa_text = (
            f"Hi Margam Mentors! I booked my free 30-min strategy session.\n\n"
            f"📋 Ref: {booking_id}\n"
            f"👤 Name: {request.name}\n"
            f"🌍 Destination: {request.target_country} ({request.degree})\n"
            f"📅 Intake: {request.intake}\n"
            f"⏰ Slot: {request.preferred_time}\n"
            f"💬 Channel: {request.preferred_mode.upper()}\n\n"
            f"Looking forward to our call!"
        )
        wa_url = f"https://wa.me/919347997790?text={urllib.parse.quote(wa_text)}"
        
        logger.info(f"Consultation booked: {booking_id} for {request.name} ({request.phone}) - Score: {qualification['score']} ({qualification['category']})")
        
        return {
            "status": "confirmed",
            "booking_id": booking_id,
            "lead_score": qualification["score"],
            "lead_category": qualification["category"],
            "recommended_action": qualification["recommended_action"],
            "dossier_markdown": dossier_md,
            "whatsapp_url": wa_url,
            "message": "Consultation booked successfully. Dossier generated for counselor handover."
        }
    except Exception as e:
        logger.error(f"Error booking consultation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process consultation booking.")

@router.get("/leads")
async def get_leads():
    """
    Return all recorded consultation leads and qualification statuses for counselor review.
    """
    leads_json_path = os.path.join(os.path.dirname(__file__), "data", "leads.json")
    if not os.path.exists(leads_json_path):
        return {"leads": []}
    try:
        async with aiofiles.open(leads_json_path, "r", encoding="utf-8") as f:
            content = await f.read()
            leads = json.loads(content)
            return {"leads": list(reversed(leads))}
    except Exception as e:
        logger.error(f"Error reading leads: {e}")
        return {"leads": []}

@router.get("/leads/{booking_id}/dossier")
async def get_lead_dossier(booking_id: str):
    """
    Fetch the generated markdown handover dossier for a specific booked consultation.
    """
    leads_dir = os.path.join(os.path.dirname(__file__), "data", "leads")
    if not os.path.exists(leads_dir):
        raise HTTPException(status_code=404, detail="Dossier directory not found.")
        
    # Look for files matching the booking_id
    matching_file = None
    for f in os.listdir(leads_dir):
        if f.startswith(booking_id) and f.endswith(".md"):
            matching_file = os.path.join(leads_dir, f)
            break
            
    if not matching_file or not os.path.exists(matching_file):
        raise HTTPException(status_code=404, detail="Dossier not found for this consultation.")
        
    try:
        async with aiofiles.open(matching_file, "r", encoding="utf-8") as f:
            content = await f.read()
            return {"booking_id": booking_id, "dossier_markdown": content}
    except Exception as e:
        logger.error(f"Error reading dossier: {e}")
        raise HTTPException(status_code=500, detail="Failed to read counselor dossier.")

@router.get("/analytics/metrics")
async def get_analytics_metrics():
    """
    Calculate and return key PRD conversion and engagement metrics:
    - Total leads & distribution (HOT, WARM, COLD)
    - Total active omnichannel sessions & average session depth (turns)
    - Chatbot-to-consultation conversion rate
    - Destination popularity breakdown
    """
    leads_json_path = os.path.join(os.path.dirname(__file__), "data", "leads.json")
    sessions_dir = os.path.join(os.path.dirname(__file__), "data", "sessions")
    
    leads = []
    if os.path.exists(leads_json_path):
        try:
            async with aiofiles.open(leads_json_path, "r", encoding="utf-8") as f:
                leads = json.loads(await f.read())
        except Exception as e:
            logger.error(f"Error reading leads for analytics: {e}")
            leads = []
            
    # Session stats
    total_sessions = 0
    total_turns = 0
    booked_sessions = 0
    if os.path.exists(sessions_dir):
        try:
            for f_name in os.listdir(sessions_dir):
                if f_name.endswith(".json"):
                    s_path = os.path.join(sessions_dir, f_name)
                    async with aiofiles.open(s_path, "r", encoding="utf-8") as f:
                        s_data = json.loads(await f.read())
                        total_sessions += 1
                        history = s_data.get("chat_history", [])
                        total_turns += sum(1 for m in history if m.get("role") in ["user", "human"])
                        if s_data.get("is_booked", False):
                            booked_sessions += 1
        except Exception as e:
            logger.error(f"Error aggregating sessions for analytics: {e}")
            
    # Lead distribution
    hot_count = sum(1 for l in leads if l.get("lead_category") == "HOT")
    warm_count = sum(1 for l in leads if l.get("lead_category") == "WARM")
    cold_count = sum(1 for l in leads if l.get("lead_category") == "COLD")
    
    # Destination distribution
    destinations = {}
    for l in leads:
        country = l.get("target_country") or "Unknown"
        destinations[country] = destinations.get(country, 0) + 1
        
    avg_turns = round(total_turns / max(total_sessions, 1), 1)
    # Conversion rate: booked leads / sessions
    conversion_rate = round((len(leads) / max(total_sessions, len(leads), 1)) * 100, 1)
    
    return {
        "total_leads": len(leads),
        "lead_distribution": {
            "HOT": hot_count,
            "WARM": warm_count,
            "COLD": cold_count
        },
        "total_sessions": max(total_sessions, len(leads)),
        "average_session_turns": avg_turns,
        "chatbot_conversion_rate": conversion_rate,
        "destination_breakdown": destinations,
        "timestamp": datetime.now().isoformat()
    }

# ---------------------------------------------------------
# Phase 3: Meta WhatsApp Cloud API Gateway Endpoints
# ---------------------------------------------------------

@router.get("/webhook/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """
    Meta WhatsApp Cloud API Webhook Verification Challenge Handshake.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    verified_challenge = verify_webhook(mode, token, challenge)
    if verified_challenge is not None:
        logger.info("Meta WhatsApp webhook challenge successfully verified.")
        return PlainTextResponse(str(verified_challenge), status_code=200)
    
    logger.warning("WhatsApp webhook verification failed: token mismatch.")
    raise HTTPException(status_code=403, detail="Verification token mismatch.")

@router.post("/webhook/whatsapp")
async def handle_whatsapp_webhook(request: Request):
    """
    Process incoming WhatsApp messages with omnichannel session continuity.
    """
    try:
        body = await request.json()
        logger.debug(f"Received WhatsApp webhook event: {json.dumps(body)[:200]}")
        result = await process_incoming_whatsapp_message(body)
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error(f"Error handling WhatsApp webhook: {e}", exc_info=True)
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=200)

# ---------------------------------------------------------
# Phase 3: Automated 24h Re-engagement Nudge Endpoints
# ---------------------------------------------------------

@router.get("/nudges/pending")
async def get_pending_nudges_endpoint(min_hours: float = 20.0):
    """
    Identify student sessions eligible for a proactive re-engagement nudge.
    """
    pending = find_pending_nudges(min_hours_inactive=min_hours)
    # Strip raw session ref before returning JSON
    sanitized = [
        {k: v for k, v in item.items() if k != "session_ref"}
        for item in pending
    ]
    return {
        "pending_count": len(sanitized),
        "pending_nudges": sanitized
    }

@router.post("/nudges/trigger")
async def trigger_nudges_endpoint(force_all: bool = False, min_hours: float = 20.0):
    """
    Trigger and dispatch re-engagement nudges for all eligible student sessions.
    """
    result = await trigger_reengagement_nudges(force_all=force_all, min_hours=min_hours)
    return result

# Mount router on both root and /api prefixes for Vercel multi-service routing compatibility
app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    
    # Production-ready uvicorn configuration
    port = int(os.environ.get("PORT", 8000))
    
    # Check if we're on Windows (uvloop and multiprocessing have limitations on Windows)
    is_windows = sys.platform == "win32"
    
    # Default to 1 worker on Windows, allow more on Linux/Mac
    default_workers = 1 if is_windows else int(os.environ.get("WORKERS", "1"))
    workers = int(os.environ.get("WORKERS", str(default_workers)))
    log_level = os.environ.get("LOG_LEVEL", "info").lower()
    
    # For production with multiple workers (Linux/Mac only)
    # On Windows, use single worker mode as multiprocessing has limitations
    if workers > 1 and not is_windows:
        # Use uvloop only on non-Windows systems
        uvicorn.run(
            "server:app",
            host="0.0.0.0",
            port=port,
            workers=workers,
            log_level=log_level,
            access_log=True,
            loop="uvloop",  # Use uvloop for better performance (Linux/Mac only)
            timeout_keep_alive=30
        )
    else:
        # Single worker mode (Windows or development)
        if workers > 1 and is_windows:
            logger.warning(f"Multiple workers ({workers}) not fully supported on Windows. Using single worker mode.")
        
        # Don't use uvloop on Windows (it's not available/supported)
        uvicorn_config = {
            "app": app,
            "host": "0.0.0.0",
            "port": port,
            "log_level": log_level,
            "access_log": True
        }
        
        # Only add uvloop on non-Windows systems if available
        if not is_windows:
            try:
                import uvloop
                uvicorn_config["loop"] = "uvloop"
            except ImportError:
                # uvloop not installed, use default asyncio
                pass
        
        uvicorn.run(**uvicorn_config)
