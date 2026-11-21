from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.documents import Document
from .state import GraphState
from .config import (
    LLM_PROVIDER, LLM_MODEL, GEMINI_MODEL, GEMINI_API_KEY, GEMINI_FALLBACK_MODELS,
    LLM_TEMPERATURE, MAX_CONTEXT_CHARS, MAX_HISTORY_MESSAGES,
    CURRENCY_RATES, MARGAM_CONTACT, MARGAM_STATS, MAX_RESPONSE_WORDS_SIMPLE,
    MAX_RESPONSE_WORDS_STANDARD, MAX_RESPONSE_WORDS_COMPLEX,
    USE_WEB_SEARCH, TAVILY_API_KEY, TAVILY_MAX_RESULTS, TAVILY_SEARCH_DEPTH,
    TAVILY_CHUNKS_PER_SOURCE, TAVILY_INCLUDE_ANSWER, TAVILY_TIME_RANGE
)
import os
import random
import logging
from request_context import get_request_context, format_log_message

logger = logging.getLogger(__name__)

def log_with_context(level: str, message: str, **kwargs):
    """Helper function to log with request context."""
    try:
        context = get_request_context()
        context_parts = []
        
        if context and context.get("session_id"):
            context_parts.append(f"Session:{context['session_id']}")
        if context and context.get("user_name"):
            context_parts.append(f"User:{context['user_name'][:20]}")
        if context and context.get("request_id"):
            context_parts.append(f"ReqID:{context['request_id']}")
        
        if context_parts:
            prefixed_message = f"[{', '.join(context_parts)}] {message}"
        else:
            prefixed_message = message
        
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(prefixed_message, **kwargs)
    except Exception:
        # Fallback to normal logging if context fails
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(message, **kwargs)

# --- LLM Helper (Google Gemini / OpenAI) ---
def get_llm():
    """Configure and return the LLM, prioritizing Google Gemini."""
    google_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    has_valid_openai = openai_key and not openai_key.startswith("your_openai_") and len(openai_key) > 20

    # If configured for Gemini or if Gemini key is available, use Google Gemini
    if LLM_PROVIDER == "gemini" or (google_key and not has_valid_openai):
        if not google_key:
            logger.warning("Google Gemini configured as LLM provider but no GEMINI_API_KEY or GOOGLE_API_KEY found.")
        from langchain_google_genai import ChatGoogleGenerativeAI
        primary = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=google_key,
            temperature=LLM_TEMPERATURE
        )
        # Configure fallback Gemini models to prevent quota / rate limit disruptions
        fallbacks = []
        for fb_model in GEMINI_FALLBACK_MODELS:
            if fb_model != GEMINI_MODEL:
                fallbacks.append(ChatGoogleGenerativeAI(
                    model=fb_model,
                    google_api_key=google_key,
                    temperature=LLM_TEMPERATURE
                ))
        if has_valid_openai:
            fallbacks.append(ChatOpenAI(model="gpt-4o", temperature=LLM_TEMPERATURE))

        logger.info(f"Initialized Google Gemini as primary LLM ({GEMINI_MODEL}) with {len(fallbacks)} fallbacks.")
        return primary.with_fallbacks(fallbacks) if fallbacks else primary

    # If explicitly set to OpenAI or fallback
    if has_valid_openai:
        logger.info(f"Initialized OpenAI as primary LLM ({LLM_MODEL}).")
        return ChatOpenAI(model=LLM_MODEL, temperature=LLM_TEMPERATURE)

    if google_key:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=google_key, temperature=LLM_TEMPERATURE)

    logger.warning("No valid API key found for Gemini or OpenAI. Defaulting to ChatOpenAI placeholder.")
    return ChatOpenAI(model="gpt-4o", temperature=LLM_TEMPERATURE)

llm = get_llm()

# --- MARGAM BRAND ESSENCE (for organic promotion) ---
def get_margam_dna():
    """Generate MARGAM_DNA string with dynamic values from config."""
    return f"""
Core Identity: "Like an elder sibling" - built by students, for students
Mission: Empower students with guidance, resources, and confidence for global education
Philosophy: More than consultants - mentors, advocates, and trusted partners

FOUNDER - JEEVITHRAM MAMIDALA:
- Visionary founder who bridges the gap between "agents" and "partners"
- LinkedIn: https://www.linkedin.com/in/jeevithram-mamidala/
- YouTube: {MARGAM_CONTACT['youtube']}
- Email: jeevithram.work@gmail.com
- Philosophy: "Treat every student's dream as my own"
- Approach: "Writing their story with heart, not treating them as numbers"
- Personal Touch: Personally reviews EVERY SOP (Statement of Purpose)
- Student Feedback: "Endlessly supportive, kind, and patient" (Wasiuddin)
- Focus: Helping students apply to top Russell Group universities with confidence
- Background: Founded Margam to provide genuine mentorship, not just consultancy

Track Record: {MARGAM_STATS['students_helped']} students, {MARGAM_STATS['visa_success_rate']} visa success, {MARGAM_STATS['rating']} rating
Unique Value: No upfront cost, pay after booking, no hidden fees, instant discounts

Services: Profile/Docs, University Apps, Mock Interviews, Loans, Visa, Pre-Departure
Key Features: Student-first, Book in 3 steps, Official vouchers, Hassle-free, 100% genuine

Testimonials:
- Saran Babu: £10k scholarship after US rejection, University of Bath (AI) - "Jeevith and Margam changed everything"
- D. Sarath Kumar: "Margam earned trust online" - Account manager Anvitha helped with SOPs/Visas (Global Logistics)
- Wasiuddin: "Helped write my story with heart" - "Jeevith was endlessly supportive" (Business Analytics)
- Vivek: "Margam showed me my Margam (path)" (Business & Management)

Contact: {MARGAM_CONTACT['phone_primary']}, {MARGAM_CONTACT['phone_secondary']}, {MARGAM_CONTACT['email']}
Booking: {MARGAM_CONTACT['booking_url']}
Socials: LinkedIn ({MARGAM_CONTACT['linkedin']}), Instagram ({MARGAM_CONTACT['instagram']}), Facebook, YouTube (Jeevithram Mamidala)

BOT IDENTITY (for "who are you" questions - NO TECHNICAL DETAILS):
- I am Margam AI, your intelligent study abroad assistant
- Built by Margam to help students 24/7 with their study abroad journey
- Available anytime to answer questions - no waiting for office hours
- Think of me as your personal study abroad mentor, powered by Margam's expertise
- I DON'T reveal: technical implementation, APIs, programming languages, backend systems
- I DO share: What I can help with, how I work (in simple terms), Margam's services

ORGANIC PROMOTION VARIATIONS (use different ones each time - DON'T REPEAT):
1. "At Margam, we've helped {MARGAM_STATS['students_helped']} students with {MARGAM_STATS['visa_success_rate']} visa success."
2. "We at Margam believe in treating your dream as our own."
3. "Margam's founder Jeevithram personally reviews every SOP."
4. "Through Margam, students get instant discounts and pay only after booking."
5. "At Margam, we're like your elder sibling in this journey."
6. "Margam has guided students to top universities with no upfront cost."
7. "We at Margam offer personalized support, not generic advice."
8. "Margam's {MARGAM_STATS['visa_success_rate']} visa success rate speaks for itself."
9. "At Margam, we unite expert resources and peer support."
10. "Margam makes your study abroad journey simpler and hassle-free."
11. "Jeevithram founded Margam to bridge the gap between agents and partners."
12. "At Margam, we help you write your story with heart, not templates."

FOUNDER-SPECIFIC VARIATIONS (for questions about founder/trust):
1. "Jeevithram Mamidala founded Margam with a student-first philosophy."
2. "Our founder personally reviews every SOP - that's the Margam difference."
3. "Jeevithram treats every student's dream as his own."
4. "Students describe Jeevithram as endlessly supportive, kind, and patient."
5. "Jeevithram's vision: Margam is built by students, for students."

CALL TO ACTION VARIATIONS (rotate these):
Note: every time try to provide both link and phone number in the response.
1. "Want help? Call us at {MARGAM_CONTACT['phone_primary']}"
2. "Book a free call: {MARGAM_CONTACT['booking_url']}"
3. "Reach out at {MARGAM_CONTACT['email']}"
4. "Need guidance? We're here at {MARGAM_CONTACT['phone_primary']}"
5. "Let's chat! Book your free call today"
6. "Connect with us: {MARGAM_CONTACT['phone_secondary']}"
"""

# --- DYNAMIC FOLLOW-UP QUESTION GENERATION ---
def generate_follow_up_questions_dynamic(question: str, answer: str, chat_history: list, country: str = "", field: str = "") -> list:
    """
    Dynamically generate contextual follow-up questions using LLM.
    Replaces static key-based approach with intelligent generation.
    """
    # Extract what was already discussed
    discussed_topics = set()
    for msg in chat_history[-MAX_HISTORY_MESSAGES:]:
        if msg.get("role") == "user":
            content_lower = msg.get("content", "").lower()
            discussed_topics.add(content_lower[:100])  # First 100 chars
    
    discussed_str = "\n".join(list(discussed_topics)[:5]) if discussed_topics else "None"
    
    prompt = ChatPromptTemplate.from_template(
        """You are generating contextual follow-up questions for a study abroad chatbot.

**CURRENT QUESTION:** {question}

**BOT'S ANSWER:** {answer}

**PREVIOUSLY DISCUSSED (avoid repeating these):**
{discussed_topics}

**CONTEXT:**
- Country mentioned: {country}
- Field of study: {field}

**TASK:** Generate 3 relevant, specific follow-up questions that:
1. Are directly related to the current question/answer
2. Help the user explore the topic deeper
3. Are NOT already discussed (check the previously discussed list)
4. Are specific and actionable (not vague)
5. Use natural language that a student would ask

**EXAMPLES:**
- If answer was about UK visa fees → "What documents do I need for UK visa?", "How long does UK visa processing take?", "Do I need to show proof of funds?"
- If answer was about universities → "What are the admission requirements?", "What's the application deadline?", "Are there scholarships available?"
- If answer was about costs → "How can I get education loans?", "What's the cost of living?", "Can I work while studying?"

**OUTPUT:** Return ONLY a JSON array of exactly 3 questions:
["question1", "question2", "question3"]

Make them specific, relevant, and avoid repetition.
"""
    )
    
    chain = prompt | llm | JsonOutputParser()
    
    try:
        questions = chain.invoke({
            "question": question[:300],
            "answer": answer[:500],
            "discussed_topics": discussed_str,
            "country": country,
            "field": field
        })
        # Ensure we return a list
        if isinstance(questions, list):
            return questions[:3]
        return []
    except Exception as e:
        logger.error(f"Follow-up generation error: {e}", exc_info=True)
        # Fallback to simple questions
        fallback = []
        if country:
            fallback.append(f"What documents do I need for {country} visa?")
        if field:
            fallback.append(f"What are the top universities for {field}?")
        fallback.append("How can I get started?")
        return fallback[:3]

# --- ENHANCED EMOTIONAL INTELLIGENCE ---
EMOTION_KEYWORDS = {
    "overwhelmed": ["too much", "confused", "don't know where to start", "complicated", "lost", "difficult to understand"],
    "excited": ["can't wait", "so excited", "amazing", "love this", "awesome", "fantastic", "great"],
    "worried": ["scared", "nervous", "what if", "afraid", "concerned", "anxious", "risky"],
    "frustrated": ["difficult", "hard", "complicated", "annoying", "stuck", "not working"],
    "grateful": ["thank you", "thanks", "appreciate", "helpful", "great help", "amazing"],
    "doubtful": ["not sure", "is it worth", "should i", "is it safe", "can i trust", "genuine", "scam"],
    "confused": ["don't understand", "what does", "explain", "clarify", "not clear", "how does"],
    "hopeful": ["hoping", "wish", "dream", "want to", "planning", "looking forward"]
}

EMPATHY_RESPONSES = {
    "overwhelmed": "I totally get it, {user_name}. Let's break this down into simple steps...",
    "excited": "Love your energy, {user_name}! Let's channel that into action...",
    "worried": "It's completely normal to feel this way, {user_name}. Here's the truth...",
    "frustrated": "I hear you, {user_name}. Let's make this easier...",
    "grateful": "Happy to help, {user_name}! That's what we're here for...",
    "doubtful": "{user_name}, I understand your concern. Let me share some facts...",
    "confused": "No worries, {user_name}, let me simplify this for you...",
    "hopeful": "That's the spirit, {user_name}! Let's turn that hope into reality..."
}


# --- BILINGUAL SUPPORT (Code-Switching: Telugu-English, Hindi-English, etc.) ---
BILINGUAL_TEMPLATES = {
    "hindi": {
        "greeting": "नमस्ते {user_name}! मैं Margam AI हूं - आपका 24/7 study abroad assistant। कैसे मदद कर सकता हूं?",
        "visa_intro": "{user_name}, {country} visa ke liye yeh hai breakdown:",
        "cost_intro": "{user_name}, costs ka breakdown yeh hai:",
        "university_intro": "{user_name}, yeh hain top universities:",
        "help_offer": "Margam mein hum aapki help kar sakte hain। Call karein: {phone}",
        "follow_up": "Aur kuch jaanna chahte hain, {user_name}?"
    },
    "telugu": {
        "greeting": "నమస్కారం {user_name}! నేను Margam AI - మీ 24/7 study abroad assistant. ఎలా సహాయం చేయగలను?",
        "visa_intro": "{user_name}, {country} visa kosam idi breakdown:",
        "cost_intro": "{user_name}, costs yela untayo chudandi:",
        "university_intro": "{user_name}, ivi top universities:",
        "help_offer": "Margam lo manam mee ki help cheyagalamu. Call cheyyandi: {phone}",
        "follow_up": "Inkemaina telusukovalante, {user_name}?"
    },
    "tamil": {
        "greeting": "வணக்கம் {user_name}! நான் Margam AI - உங்கள் 24/7 study abroad assistant. எப்படி உதவலாம்?",
        "visa_intro": "{user_name}, {country} visa ku idhu breakdown:",
        "cost_intro": "{user_name}, costs ipdi irukum:",
        "university_intro": "{user_name}, idhu top universities:",
        "help_offer": "Margam la naanga ungaluku help pannuvom. Call pannunga: {phone}",
        "follow_up": "Vera edhavathu therinjukanum na, {user_name}?"
    },
    "kannada": {
        "greeting": "ನಮಸ್ಕಾರ {user_name}! ನಾನು Margam AI - ನಿಮ್ಮ 24/7 study abroad assistant. ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "visa_intro": "{user_name}, {country} visa ge idu breakdown:",
        "cost_intro": "{user_name}, costs hinge ide:",
        "university_intro": "{user_name}, ivi top universities:",
        "help_offer": "Margam alli navu nimge help maadabahudhu. Call maadi: {phone}",
        "follow_up": "Bere yenu tilkobeku, {user_name}?"
    }
}

# Language detection keywords (simple approach)
LANGUAGE_KEYWORDS = {
    "hindi": ["hai", "hain", "ke liye", "kaise", "kya", "aur", "mein", "ka", "ki"],
    "telugu": ["undi", "untundi", "kosam", "ela", "emiti", "enti", "lo", "ki"],
    "tamil": ["iruku", "irukku", "ku", "epdi", "enna", "la", "um"],
    "kannada": ["ide", "idhe", "ge", "hege", "enu", "li", "alli"]
}

# --- CONVERSATION MEMORY ---
COUNTRY_KEYWORDS = {
    "UK": ["uk", "united kingdom", "britain", "england", "london"],
    "Germany": ["germany", "german", "deutschland", "berlin"],
    "Ireland": ["ireland", "irish", "dublin"],
    "France": ["france", "french", "paris"],
    "USA": ["usa", "america", "united states", "us"],
    "Canada": ["canada", "canadian", "toronto"],
    "Australia": ["australia", "australian", "sydney"]
}

FIELD_KEYWORDS = {
    "Computer Science": ["computer science", "cs", "software", "programming", "coding", "it"],
    "Business": ["business", "mba", "management", "marketing", "finance"],
    "Engineering": ["engineering", "mechanical", "electrical", "civil"],
    "Data Science": ["data science", "analytics", "machine learning", "ai", "artificial intelligence"],
    "Medicine": ["medicine", "medical", "mbbs", "doctor", "healthcare"]
}


# --- Node Logic ---

def route_question(state: GraphState):
    """
    Ultra-intelligent router - handles ANY question dynamically.
    """
    # Update context if available from state
    if "session_id" in state and "request_id" in state:
        from request_context import set_request_context
        set_request_context(
            state.get("request_id", ""),
            state.get("session_id", ""),
            state.get("user_name", ""),
            ""  # Phone not in state
        )
    
    log_with_context("debug", f"Processing route_question - Question: {state['question'][:100]}...")
    question = state["question"]
    chat_history = state.get("chat_history", [])
    
    # Format recent history
    history_str = ""
    if chat_history:
        for msg in chat_history[-min(4, MAX_HISTORY_MESSAGES):]:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            history_str += f"{role}: {content}\n"
    
    prompt = ChatPromptTemplate.from_template(
        """You are an ULTRA-INTELLIGENT, STRATEGIC conversation router for Margam AI. You have COMPLETE FREEDOM to make smart decisions based on context.

**CONTEXT (Last 4 messages):**
{history}

**USER'S MESSAGE:** {question}

**YOUR MISSION:** 
- Analyze the user's message DEEPLY - understand not just what they're asking, but WHY they're asking it
- Consider the conversation flow and context - what came before matters
- Make INTELLIGENT decisions - you're not bound by rigid rules, use your reasoning
- Think strategically - what's the best path forward for this user?
- Be ADAPTIVE - handle edge cases and ambiguous situations intelligently

---

## 🎯 CLASSIFICATION CATEGORIES

### 1. **MARGAM_DEFENSE** (HIGHEST PRIORITY)
**When to use:** User attacks, doubts, or questions Margam's credibility

**Triggers:**
- Direct attacks: "scam", "fraud", "fake", "cheat", "lie", "con"
- Trust issues: "don't trust", "not genuine", "suspicious", "doubt Margam"
- Negative statements: "Margam is bad", "Margam sucks", "waste of money"
- Skepticism: "are you real?", "is this legit?", "prove it"

**Examples:**
- "Margam is a scam" → MARGAM_DEFENSE
- "I don't trust you guys" → MARGAM_DEFENSE
- "This seems fake" → MARGAM_DEFENSE
- "Prove Margam is genuine" → MARGAM_DEFENSE

**CRITICAL:** If there's ANY doubt about Margam's credibility, choose this.

---

### 2. **ESCALATION** (PRD HARD GUARDRAILS - CRITICAL BUSINESS POLICY)
**When to use:** User asks for detailed execution, specific university shortlists, application portal links, or scholarship portals that belong exclusively to human counsellors.

**Triggers:**
- Specific university shortlisting or rankings for their profile: "Give me university list", "Shortlist 5 universities for me", "Which universities will accept 60%?", "Rank colleges for my profile"
- Direct application links or portal URLs: "Give me Uni-Assist link", "Send portal link for Oxford/TUM", "How to apply on UCAS portal"
- Step-by-step application execution: "How do I fill the application form step by step", "Apply for me", "Walk me through portal submission"
- Scholarship application execution or portals: "Direct portal link to apply for DAAD/Chevening", "Scholarship application steps"
- SOP writing / drafting / templates: "Write my SOP", "Give me an SOP template for MS in CS", "Draft my admission essay"
- Guaranteed outcomes or hacks: "Guarantee my admission", "Visa approval hacks", "How to cheat the interview"

**Examples:**
- "Give me a shortlist of 5 universities for my profile in Germany" → ESCALATION
- "Send me the direct link to apply on Uni-Assist" → ESCALATION
- "Can you write an SOP for me?" → ESCALATION
- "Give me step-by-step instructions to submit application on university portal" → ESCALATION
- "What are the scholarship portals to apply directly?" → ESCALATION

**RULE:** The chatbot must never over-solve or provide portal links. Escalate to human consultation.

---

### 2. **ACKNOWLEDGMENT**
**When to use:** User is satisfied, agreeing, or just acknowledging

**Triggers:**
- Simple agreement: "ok", "okay", "alright", "sure", "fine"
- Gratitude: "thanks", "thank you", "appreciate it"
- Satisfaction: "that's good", "got it", "understood", "makes sense"
- Positive: "cool", "nice", "great", "perfect", "awesome"

**Examples:**
- "ok" → ACKNOWLEDGMENT
- "thanks for the info" → ACKNOWLEDGMENT
- "that makes sense" → ACKNOWLEDGMENT
- "got it, thanks!" → ACKNOWLEDGMENT

**Edge Cases:**
- "ok but what about..." → FOLLOW_UP (not pure acknowledgment)
- "thanks, can you tell me more?" → FOLLOW_UP

---

### 3. **FOLLOW_UP**
**When to use:** User wants MORE details on the CURRENT topic

**Triggers:**
- Explicit: "tell me more", "what else?", "and?", "go on", "continue"
- Implicit: "elaborate", "explain further", "details?", "more info?"
- Curious: "interesting, tell me more", "what about that?", "how so?"
- Specific: "what about [aspect of current topic]?"

**Examples:**
- "tell me more about UK visas" → FOLLOW_UP (if discussing UK)
- "what else should I know?" → FOLLOW_UP
- "can you elaborate?" → FOLLOW_UP
- "and what about the fees?" → FOLLOW_UP (if discussing related topic)

**Edge Cases:**
- "what about Germany?" (after UK discussion) → RAG (NEW topic, not follow-up)

---

### 4. **RAG** (DEFAULT FOR MOST QUESTIONS)
**When to use:** ANY question that needs information/knowledge

**This is your GENEROUS category - if unsure, choose RAG!**

**Topics:**
- **Study Abroad:** Visas, universities, scholarships, applications, deadlines
- **Countries:** UK, Germany, Ireland, France, USA, Canada, Australia
- **Processes:** How to apply, documents needed, timeline, steps
- **Tests:** IELTS, PTE, TOEFL, Duolingo, GRE, GMAT
- **Finances:** Costs, fees, loans, scholarships, budgeting
- **Margam Services:** What we offer, how we help, pricing, process
- **Founder/Team:** Jeevithram, team, story, testimonials
- **Student Life:** Accommodation, part-time jobs, culture, weather, food
- **Career:** Job prospects, ROI, placements, internships
- **Comparisons:** UK vs Germany, PTE vs IELTS, etc.
- **Advice:** "Should I?", "Is it worth it?", "What's better?"
- **Concerns:** Safety, loneliness, difficulty, challenges
- **Bot Identity:** "Who are you?", "What can you do?", "How do you work?", "Are you AI?"

**Examples:**
- "What are UK visa fees?" → RAG
- "How do I apply to German universities?" → RAG
- "Can you help with SOP?" → RAG
- "Is studying abroad worth it?" → RAG
- "What's student life like in UK?" → RAG
- "How do I make friends abroad?" → RAG
- "What's the weather in UK?" → RAG (student life context)
- "Best cities for students?" → RAG
- "Part-time job opportunities?" → RAG
- "Who is Jeevithram?" → RAG
- "What makes Margam different?" → RAG
- "How much does it cost?" → RAG
- **"Who are you?" → RAG** (bot identity - answer WITHOUT technical details)
- **"What can you do?" → RAG** (capabilities)
- **"Are you a bot?" → RAG** (be honest, but focus on helpfulness)
- **"How do you work?" → RAG** (simple explanation, NO tech stack)

**CRITICAL:** Be GENEROUS - if there's ANY way to connect it to study abroad or Margam, choose RAG!


---

### 5. **GREETING**
**When to use:** Simple hello/greeting

**Triggers:**
- "hi", "hello", "hey", "hola"
- "good morning", "good evening", "good afternoon"
- "what's up", "how are you", "how's it going"

**Examples:**
- "hi" → GREETING
- "hello there" → GREETING
- "hey, how are you?" → GREETING

**Edge Cases:**
- "hi, I want to know about UK visas" → RAG (not pure greeting)

---

### 6. **OFF_TOPIC** (RARELY USED)
**When to use:** Truly unrelated AND cannot be connected to study abroad

**Only use this if:**
- Topic is completely unrelated (cooking, sports, politics)
- AND there's NO study abroad angle
- AND you can't creatively connect it

**Examples:**
- "What's the best pizza recipe?" → OFF_TOPIC (unless discussing Italy study)
- "Who will win the cricket match?" → OFF_TOPIC (unless discussing UK/Australia)
- "How to fix my car?" → OFF_TOPIC

**BUT BE CREATIVE:**
- "What's the food like in Germany?" → RAG (student life)
- "Best pizza in Italy?" → RAG (can discuss Italy study)
- "Cricket in UK?" → RAG (can discuss UK student life)

---

## 🧠 INTELLIGENT DECISION-MAKING FRAMEWORK

**YOUR INTELLIGENCE & FREEDOM:**
- You have COMPLETE FREEDOM to reason about each message
- Think STRATEGICALLY - what's the user's real intent?
- Consider MULTIPLE factors: sentiment, context, conversation flow, underlying needs
- Make SMART decisions - don't just follow rules, understand the situation
- Be ADAPTIVE - handle ambiguous cases intelligently

**STRATEGIC ANALYSIS PROCESS:**

1. **DEEP UNDERSTANDING:**
   - What is the user REALLY asking? (surface vs. underlying question)
   - What's their emotional state? (curious, frustrated, satisfied, confused)
   - What's the conversation context? (new topic, follow-up, clarification, deep dive)
   - What information do they need? (facts, advice, comparison, process, reassurance)

2. **INTELLIGENT ROUTING:**
   - **MARGAM_DEFENSE**: Only if there's genuine concern/attack about Margam's credibility
   - **ACKNOWLEDGMENT**: Only if it's pure acknowledgment with no follow-up intent
   - **FOLLOW_UP**: If user wants more on CURRENT topic (be smart about what "current" means)
   - **RAG**: If user needs information, advice, or help (be generous - this is your default)
   - **GREETING**: Only if it's a pure greeting with no question/request
   - **OFF_TOPIC**: Only if truly unrelated AND cannot be connected to study abroad

3. **CONTEXT-AWARE REASONING:**
   - Analyze conversation history to understand flow
   - Recognize implicit questions and underlying concerns
   - Identify when user is exploring vs. confirming vs. needing help
   - Understand when to provide more detail vs. when to summarize

4. **ADAPTIVE HANDLING:**
   - Ambiguous messages → Use context to infer intent
   - Multi-part questions → Route to RAG (we can handle complex queries)
   - Emotional undertones → Consider sentiment in routing decision
   - Vague requests → Be intelligent about what they likely need
   - Edge cases → Use your judgment, default to RAG if helpful

5. **SMART DEFAULT:**
   - When genuinely unsure → RAG (we're smart enough to handle it)
   - When it could be helpful → RAG (be generous)
   - When user needs information → RAG
   - When user needs advice → RAG
   - When user needs reassurance → RAG

---

## 📋 DECISION FLOWCHART

```
Does it attack/doubt Margam? → YES → MARGAM_DEFENSE
                              ↓ NO
Does it ask for university shortlist/ranking, portal links, application steps, or SOP writing? → YES → ESCALATION
                              ↓ NO
Is it pure acknowledgment? → YES → ACKNOWLEDGMENT
                           ↓ NO
Is it asking for more on current topic? → YES → FOLLOW_UP
                                        ↓ NO
Is it a pure greeting? → YES → GREETING
                       ↓ NO
Can it relate to study abroad/Margam? → YES → RAG
                                      ↓ NO
                                      OFF_TOPIC
```

---

## ✅ YOUR INTELLIGENCE IN ACTION

**THINK BEFORE YOU ROUTE:**
1. Read the message carefully - what's the user really asking?
2. Consider the context - what came before? What's the conversation flow?
3. Analyze the intent - information need? Advice? Reassurance? Clarification? Escalation?
4. Make a SMART decision - what's the best path forward?
5. Be CONFIDENT in your reasoning - you have the intelligence to handle this

**Return ONLY the category name (one word: MARGAM_DEFENSE, ESCALATION, ACKNOWLEDGMENT, FOLLOW_UP, RAG, GREETING, OFF_TOPIC).**
"""
    )
    
    chain = prompt | llm | StrOutputParser()
    category = chain.invoke({"question": question, "history": history_str}).strip().upper()
    
    # Robust normalization with MARGAM_DEFENSE and ESCALATION priority
    if "MARGAM" in category and ("DEFENSE" in category or "DEFEND" in category):
        decision = "MARGAM_DEFENSE"
    elif "ESCALAT" in category or "GUARDRAIL" in category:
        decision = "ESCALATION"
    elif "ACKNOWLEDGMENT" in category or "ACKNOWLEDGE" in category:
        decision = "ACKNOWLEDGMENT"
    elif "FOLLOW" in category or "FOLLOW_UP" in category:
        decision = "FOLLOW_UP"
    elif "RAG" in category:
        decision = "RAG"
    elif "GREETING" in category:
        decision = "GREETING"
    else:
        decision = "OFF_TOPIC"
    
    log_with_context("debug", f"Router Decision: {decision} (from: {category})")
    return {"router_decision": decision}



def analyze_intent(state: GraphState):
    """
    Deep intent analysis with understanding of underlying questions.
    """
    log_with_context("debug", "Processing analyze_intent")
    question = state["question"]
    chat_history = state.get("chat_history", [])
    
    # Format history with more context
    history_str = ""
    for msg in chat_history[-MAX_HISTORY_MESSAGES:]:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        history_str += f"{role}: {content[:300]}\n"
    
    prompt = ChatPromptTemplate.from_template(
        """You are a STRATEGIC INTENT ANALYZER with deep understanding and reasoning capabilities. You have COMPLETE FREEDOM to analyze questions intelligently.

**CHAT HISTORY:**
{history}

**LATEST QUESTION:** {question}

**YOUR TASK:** 
- Analyze this question DEEPLY - understand not just what they're asking, but WHY
- Think STRATEGICALLY about what information they really need
- Consider the conversation context - what came before? What's the flow?
- Make INTELLIGENT inferences about underlying questions and concerns
- Be ADAPTIVE - handle ambiguous questions with smart reasoning

**UNDERSTANDING UNDERLYING QUESTIONS:**
- "Is it worth it?" → User wants ROI, career prospects, life experience, cost-benefit
- "Is it safe?" → User wants security info, cultural fit, support systems
- "How difficult is it?" → User wants to understand challenges, requirements, success rates
- "What do I need?" → User wants requirements, documents, qualifications
- "Can I...?" → User wants to know possibilities, limitations, options

**OUTPUT (JSON):**
{{
  "search_query": "Optimized query for vector search (extract core intent, include country/field if mentioned, expand if needed)",
  "answer_format": "Best format (table/list/narrative/brief/comparison) - choose intelligently based on question type and data structure",
  "user_sentiment": "curious/doubtful/confused/satisfied/frustrated/excited/anxious/confident",
  "conversation_state": "new_topic/follow_up/clarification/deep_dive/exploration/comparison",
  "discussed_topics": ["topic1", "topic2"],
  "margam_relevance": "high/medium/low - Can we organically mention Margam services?",
  "underlying_question": "What the user really wants to know (beyond surface question) - be intelligent about this",
  "information_needs": ["need1", "need2"],
  "reasoning": "Your intelligent reasoning for this analysis - why you made these choices",
  "smart_suggestions": "Any intelligent suggestions for how to best answer this question"
}}

**DYNAMIC FORMATTING INTELLIGENCE (CRITICAL - Response formatting is most important):**
- **Fees/Costs/Dates** → "cost_table" (MUST use table with currency conversion)
- **Comparisons** (vs, compare, difference, better) → "comparison_table" (MUST use side-by-side table)
- **Documents/Requirements** (document, requirement, need, checklist) → "document_list" (MUST use bullet points)
- **Processes/Steps** (how to, process, steps, procedure) → "process_steps" (MUST use numbered steps)
- **Lists/Enumerations** (list, universities, cities, options) → "item_list" (MUST use bullet points)
- **Timelines/Deadlines** (deadline, timeline, when, dates) → "timeline_table" (MUST use table)
- **Statistics/Numbers** (statistics, percentage, rate, data) → "stats_table" (MUST use table)
- **Trust/Concerns** → "explanatory_paragraphs" (Narrative with proof + testimonials)
- **General advice/Explanations** → "explanatory_paragraphs" (Conversational narrative with bullet points for key points)
- **Quick facts** → "item_list" (Brief bullet points)

**IMPORTANT:** Choose the format that BEST matches the question type. Be specific and accurate.

**SENTIMENT DETECTION (be nuanced):**
- "I don't trust" / "Is it worth it?" → doubtful
- "What is" / "Tell me about" → curious
- "I don't understand" / "Confused about" → confused
- "ok", "thanks", "good" → satisfied
- "This is taking too long" / "Why so complicated?" → frustrated
- "I'm so excited!" / "Can't wait!" → excited

**MARGAM RELEVANCE (for organic promotion):**
- high: Question about services we offer (SOP, visa, loans, applications)
- medium: General study abroad (we can mention how we help)
- low: Pure factual info (fees, requirements) - focus on facts first

**YOUR INTELLIGENCE:**
- Think STRATEGICALLY about what the user needs
- Consider MULTIPLE angles - what information would be most helpful?
- Make SMART inferences - if they ask about "fees", they might also need info on "loans" or "scholarships"
- Be ADAPTIVE - if the question is vague, infer what they likely need
- Provide COMPREHENSIVE analysis - don't just answer the surface question

**Return ONLY valid JSON.**
"""
    )
    
    chain = prompt | llm | JsonOutputParser()
    
    try:
        intent = chain.invoke({"history": history_str, "question": question})
        new_query = intent.get("search_query", question)
        
        # Smart keyword injection
        query_upper = str(intent).upper()
        if any(word in query_upper for word in ["FOUNDER", "JEEVITHRAM", "BIO", "STORY", "WHO", "TEAM"]):
            new_query += " Jeevithram Mamidala Profile Story Margam"
        elif any(word in query_upper for word in ["SERVICE", "HELP", "OFFER", "PROVIDE", "ASSIST"]):
            new_query += " Margam services offerings"
        elif any(word in query_upper for word in ["TRUST", "GENUINE", "RELIABLE", "TESTIMONIAL", "REVIEW"]):
            new_query += " Margam testimonials success stories trust"
        
        log_with_context("debug", f"Intent analysis completed: {intent.get('answer_format', 'unknown')} format")
        
        return {
            "question": new_query,
            "search_intent": intent,
            "user_sentiment": intent.get("user_sentiment", "curious"),
            "conversation_state": intent.get("conversation_state", "new_topic"),
            "discussed_topics": intent.get("discussed_topics", []),
            "underlying_question": intent.get("underlying_question", question),
            "information_needs": intent.get("information_needs", []),
            "smart_suggestions": intent.get("smart_suggestions", "")
        }
    except Exception as e:
        log_with_context("error", f"Intent analysis error: {e}", exc_info=True)
        return {
            "question": question,
            "search_intent": {"search_query": question, "answer_format": "Conversational", "underlying_question": question},
            "user_sentiment": "curious",
            "conversation_state": "new_topic",
            "discussed_topics": [],
            "underlying_question": question
        }


def web_search(state: GraphState):
    """
    Optional web search using Tavily API to get real-time information.
    Only runs if enabled (either via config or user request) and API key is available.
    """
    log_with_context("debug", "Processing web_search")
    question = state["question"]
    web_results = []
    
    # Check if web search is enabled (config OR user request)
    use_web = state.get("use_web_search", False) or USE_WEB_SEARCH
    
    if not use_web:
        logger.debug("Web search disabled. Skipping.")
        return {"web_search_results": []}
    
    if not TAVILY_API_KEY:
        logger.debug("Tavily API key not found. Skipping web search.")
        return {"web_search_results": []}
    
    try:
        from tavily import TavilyClient
        from datetime import datetime, timezone
        
        client = TavilyClient(api_key=TAVILY_API_KEY)
        
        # Get current date/time dynamically (ensure UTC for consistency)
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month
        current_date = now.strftime("%Y-%m-%d")
        current_datetime_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Enhance query for time-sensitive questions to get current information
        enhanced_query = question
        question_lower = question.lower()
        
        # Detect time-sensitive keywords
        time_sensitive_keywords = [
            "next", "current", "latest", "upcoming", "now", "today", "recent", 
            "this year", "when is", "what is the", "deadline", "season", "intake",
            "dates", "schedule", "timeline", "when does", "fee", "price", "cost"
        ]
        
        is_time_sensitive = any(keyword in question_lower for keyword in time_sensitive_keywords)
        
        # Enhance query if it's asking about current/next dates, seasons, or time-sensitive info
        if is_time_sensitive:
            # Add current year, next year, and time context to query dynamically
            next_year = current_year + 1
            enhanced_query = f"{question} {current_year} {next_year} {current_date} latest current"
            logger.debug(f"Enhanced time-sensitive query (Date: {current_date})")
        
        # Perform advanced search with enhanced parameters for better quality results
        search_params = {
            "query": enhanced_query,
            "search_depth": TAVILY_SEARCH_DEPTH,  # "advanced" for deeper, more thorough search
            "max_results": TAVILY_MAX_RESULTS,
            "include_answer": TAVILY_INCLUDE_ANSWER,  # Get AI-generated answer summary
            "include_raw_content": False,  # Don't include raw HTML (saves tokens)
            "include_images": False,  # Don't include images (saves tokens)
            "chunks_per_source": TAVILY_CHUNKS_PER_SOURCE,  # More content chunks per source (1-3)
        }
        
        # Force time range filter for time-sensitive queries to get recent information
        if is_time_sensitive:
            search_params["time_range"] = "month"  # Prioritize last month's information
        elif TAVILY_TIME_RANGE and TAVILY_TIME_RANGE in ["day", "week", "month", "year"]:
            search_params["time_range"] = TAVILY_TIME_RANGE
        
        response = client.search(**search_params)
        
        # Extract AI-generated answer if available (from advanced search)
        tavily_answer = response.get("answer", "")
        
        # Extract results
        for result in response.get("results", []):
            web_results.append({
                "title": result.get("title", ""),
                "content": result.get("content", ""),
                "url": result.get("url", ""),
                "score": result.get("score", 0.0)
            })
        
        # Add Tavily's AI-generated answer as a special result if available
        if tavily_answer:
            web_results.insert(0, {
                "title": "AI Summary",
                "content": tavily_answer,
                "url": "",
                "score": 1.0  # Highest priority
            })
        
        log_with_context("debug", f"Web search found {len(web_results)} results (depth: {TAVILY_SEARCH_DEPTH})")
        
    except ImportError:
        log_with_context("warning", "Tavily package not installed. Skipping web search.")
        return {"web_search_results": []}
    except Exception as e:
        log_with_context("error", f"Web search error: {e}", exc_info=True)
        return {"web_search_results": []}
    
    return {"web_search_results": web_results}


def grade_documents(state: GraphState):
    """
    Strict document grading - only keep documents that directly answer the question.
    Prevents hallucination by ensuring only relevant data is used.
    """
    log_with_context("debug", "Processing grade_documents")
    question = state["question"]
    documents = state["documents"]
    
    if not documents:
        return {"documents": [], "safe_to_answer": False}

    doc_strings = "\n".join([f"[{i}] {doc.page_content[:500]}..." for i, doc in enumerate(documents)])
    
    prompt = ChatPromptTemplate.from_template(
        """You are a STRICT relevance grader for Margam AI. Your job is to filter documents to prevent hallucination.

**QUESTION:** {question}

**DOCUMENTS:**
{doc_strings}

**TASK:** Identify ONLY documents that can DIRECTLY answer this question from the provided data.

**STRICT RULES:**
- Keep documents with DIRECT relevance to the question
- Keep documents with CONTEXTUAL relevance (e.g., UK visa doc for "UK fees" question)
- Discard documents that are COMPLETELY unrelated
- If a document only partially relates, KEEP it (we'll handle partial info in generation)
- Be permissive for data-grounded answers - better to have more context than miss information

**EXAMPLES:**
- Question: "UK visa fees?" → Keep: UK visa docs, fee guides, application guides
- Question: "What documents for UK visa?" → Keep: UK visa checklist, application guides
- Question: "How to apply for UK visa?" → Keep: UK visa application guides, process documents
- Question: "Is studying abroad worth it?" → Keep: testimonials, success stories, Margam brand info

Return JSON: 
{{
  "relevant_indexes": [0, 2, 5],
  "confidence": "high/medium/low",
  "reasoning": "Why these docs are relevant"
}}
"""
    )
    
    chain = prompt | llm | JsonOutputParser()
    
    try:
        result = chain.invoke({"doc_strings": doc_strings, "question": question})
        relevant_idxs = result.get("relevant_indexes", [])
        filtered_docs = [documents[i] for i in relevant_idxs if i < len(documents)]
        confidence = result.get("confidence", "medium")
        
        log_with_context("debug", f"Grading: {len(filtered_docs)}/{len(documents)} docs, Confidence: {confidence}")
    except Exception as e:
        log_with_context("error", f"Grading failed: {e}", exc_info=True)
        filtered_docs = documents[:6]  # Fallback

    # Safety check - always return some docs if available
    if len(filtered_docs) == 0 and len(documents) > 0:
        log_with_context("warning", "No relevant docs found, using fallback (top 4)")
        return {"documents": documents[:4], "safe_to_answer": True}
    
    return {"documents": filtered_docs, "safe_to_answer": True}




# --- Helper Functions for Enhanced Features ---

def detect_emotion(question: str) -> str:
    """Detect user's emotion from their question."""
    question_lower = question.lower()
    
    for emotion, keywords in EMOTION_KEYWORDS.items():
        if any(keyword in question_lower for keyword in keywords):
            return emotion
    
    return "neutral"


def get_follow_up_questions(question: str, country: str = "", field: str = "", chat_history: list = None) -> list:
    """
    Generate dynamic follow-up questions using LLM instead of static dictionaries.
    """
    chat_history = chat_history or []
    
    # Get the last bot response for context
    last_bot_response = ""
    for msg in reversed(chat_history):
        if msg.get("role") == "assistant":
            last_bot_response = msg.get("content", "")
            break
    
    # Use dynamic generation
    return generate_follow_up_questions_dynamic(question, last_bot_response, chat_history, country, field)


def detect_language(text: str) -> str:
    """Detect if user is using Hindi/Telugu/Tamil/Kannada mixed with English."""
    text_lower = text.lower()
    
    # Count matches for each language
    language_scores = {}
    for lang, keywords in LANGUAGE_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            language_scores[lang] = score
    
    # Return language with highest score, or "english" if none detected
    if language_scores:
        return max(language_scores, key=language_scores.get)
    return "english"


def analyze_formatting_requirements(question: str, context: str, intent: dict) -> dict:
    """
    DYNAMIC formatting analysis using LLM to intelligently determine optimal format
    based on question, context, and data structure. More flexible than keyword matching.
    """
    # First, use LLM to analyze the question and context dynamically
    try:
        # Get a preview of context to understand data structure
        context_preview = context[:2000] if context else ""
        
        format_prompt = ChatPromptTemplate.from_template(
            """You are a FORMATTING ANALYZER. Analyze the question and context to determine the BEST response format.

**QUESTION:** {question}

**CONTEXT PREVIEW:** {context_preview}

**INTENT ANALYSIS:** {intent_info}

**YOUR TASK:** Determine the optimal formatting based on:
1. Question type and structure
2. Data available in context
3. What format would be most readable and informative

**FORMAT OPTIONS:**
- "comparison_table" - For comparing 2+ items (UK vs Germany, PTE vs IELTS)
- "cost_table" - For fees, costs, prices (with currency conversion)
- "document_list" - For lists of documents, requirements, checklists
- "process_steps" - For how-to guides, procedures, step-by-step processes
- "item_list" - For lists of universities, cities, options, examples
- "timeline_table" - For deadlines, timelines, schedules, dates
- "stats_table" - For statistics, percentages, rates, numerical data
- "explanatory_paragraphs" - For explanations, definitions, general advice
- "narrative" - For conversational responses, stories, testimonials

**ANALYZE:**
- What is the user REALLY asking for?
- What data structure is in the context?
- What format would make the answer clearest?

**OUTPUT (JSON):**
{{
  "format_type": "best_format_name",
  "use_table": true/false,
  "use_list": true/false,
  "use_numbered": true/false,
  "use_paragraphs": true/false,
  "specific_instructions": "Detailed instructions for this specific format",
  "reasoning": "Why this format is best"
}}

**CRITICAL RULES:**
- If question asks to compare → comparison_table
- If question asks about costs/fees → cost_table
- If question asks "what documents" or "what do I need" → document_list
- If question asks "how to" or "steps" → process_steps
- If question asks for a list → item_list
- If question asks about timeline/deadlines → timeline_table
- If question asks about statistics/numbers → stats_table
- If context has tabular data → prefer table format
- If context has numbered steps → prefer numbered format
- If context has bullet points → prefer list format

Return ONLY valid JSON.
"""
        )
        
        chain = format_prompt | llm | JsonOutputParser()
        result = chain.invoke({
            "question": question,
            "context_preview": context_preview,
            "intent_info": str(intent.get("answer_format", "unknown"))
        })
        
        # Validate and set defaults
        formatting_guide = {
            "format_type": result.get("format_type", "explanatory_paragraphs"),
            "use_table": result.get("use_table", False),
            "use_list": result.get("use_list", False),
            "use_numbered": result.get("use_numbered", False),
            "use_paragraphs": result.get("use_paragraphs", True),
            "specific_instructions": result.get("specific_instructions", "Format the response clearly and informatively."),
            "reasoning": result.get("reasoning", "")
        }
        
        logger.debug(f"Dynamic Format Analysis: {formatting_guide['format_type']}")
        
    except Exception as e:
        logger.warning(f"Dynamic format analysis failed: {e}. Using fallback.", exc_info=True)
        # Fallback to keyword-based analysis
        question_lower = question.lower()
        context_lower = context.lower() if context else ""
        
        formatting_guide = {
            "format_type": "explanatory_paragraphs",
            "use_table": False,
            "use_list": False,
            "use_numbered": False,
            "use_paragraphs": True,
            "specific_instructions": "Format the response clearly with paragraphs and bullet points where appropriate."
        }
        
        # Quick keyword fallback
        if any(kw in question_lower for kw in ["vs", "versus", "compare", "comparison", "difference", "better", "which"]):
            formatting_guide.update({"format_type": "comparison_table", "use_table": True, "use_paragraphs": False})
        elif any(kw in question_lower for kw in ["fee", "cost", "price", "how much", "budget", "tuition"]):
            formatting_guide.update({"format_type": "cost_table", "use_table": True, "use_paragraphs": True})
        elif any(kw in question_lower for kw in ["document", "requirement", "need", "checklist", "what do i need"]):
            formatting_guide.update({"format_type": "document_list", "use_list": True, "use_paragraphs": True})
        elif any(kw in question_lower for kw in ["how to", "process", "steps", "procedure", "how do i"]):
            formatting_guide.update({"format_type": "process_steps", "use_numbered": True, "use_paragraphs": True})
        elif any(kw in question_lower for kw in ["list", "universities", "colleges", "cities", "top", "examples"]):
            formatting_guide.update({"format_type": "item_list", "use_list": True, "use_paragraphs": True})
        elif any(kw in question_lower for kw in ["deadline", "timeline", "when", "dates", "schedule"]):
            formatting_guide.update({"format_type": "timeline_table", "use_table": True, "use_paragraphs": True})
        elif any(kw in question_lower for kw in ["statistics", "stats", "percentage", "rate", "number"]):
            formatting_guide.update({"format_type": "stats_table", "use_table": True, "use_paragraphs": True})
    
    # Final validation - ensure at least one format is enabled
    if not any([formatting_guide["use_table"], formatting_guide["use_list"], formatting_guide["use_numbered"], formatting_guide["use_paragraphs"]]):
        formatting_guide["use_paragraphs"] = True
    
    return formatting_guide


def generate_intelligent_recommendations(question: str, user_profile: dict, chat_history: list, context: str, documents: list) -> dict:
    """
    INTELLIGENT MID-LEVEL CONSULTANT: Determines when to ask questions vs provide recommendations.
    Only asks questions if truly needed - otherwise provides intelligent recommendations.
    
    Returns:
    {
        "should_ask_questions": bool,
        "questions": [],  # Only if should_ask_questions is True
        "recommendations": [],  # Intelligent recommendations based on context
        "complexity": "simple/moderate/complex",
        "needs_human_consultation": bool
    }
    """
    logger.debug("Processing intelligent recommendations")
    
    # Check if we have enough context to make recommendations
    has_sufficient_context = bool(documents and len(context) > 500)
    profile_completeness = sum([
        1 if user_profile.get("target_country") else 0,
        1 if user_profile.get("field_of_study") else 0,
        1 if user_profile.get("budget_range") else 0
    ])
    
    # Analyze question type and user intent
    question_lower = question.lower()
    is_recommendation_request = any(phrase in question_lower for phrase in [
        "recommend", "suggest", "should i", "which", "what should", "best", 
        "help me choose", "guide me", "advice", "which one", "what do you think"
    ])
    
    is_factual_question = any(phrase in question_lower for phrase in [
        "what is", "how much", "when", "where", "what are", "how to", 
        "what documents", "fee", "cost", "deadline", "requirement"
    ])
    
    # Build conversation summary for LLM analysis
    conversation_summary = ""
    for msg in chat_history[-5:]:
        if msg.get("role") == "user":
            conversation_summary += f"User: {msg.get('content', '')[:200]}\n"
    
    prompt = ChatPromptTemplate.from_template(
        """You are a MID-LEVEL STUDY ABROAD CONSULTANT analyzing a user's needs. Your job is to decide:
1. Do we NEED to ask questions, or can we make intelligent recommendations now?
2. What intelligent recommendations can we provide based on available information?
3. Is this case too complex and needs human consultation?

**USER'S QUESTION:** {question}

**CONVERSATION HISTORY:**
{conversation_summary}

**USER PROFILE:**
- Target Country: {target_country}
- Field of Study: {field_of_study}
- Budget: {budget}
- Concerns: {concerns}
- Profile Completeness: {profile_completeness}/3

**CONTEXT AVAILABILITY:** {has_context}

**QUESTION TYPE:**
- Is this asking for recommendations/suggestions? {is_recommendation}
- Is this a factual question? {is_factual}

**YOUR INTELLIGENCE (ACT LIKE A MID-LEVEL CONSULTANT):**

**RULE 1: DON'T IRRITATE USERS - Only ask questions if ABSOLUTELY necessary**
- If the question is FACTUAL (what, how, when, where) → Answer directly, NO questions
- If the question is GENERAL but we have enough context → Make recommendations, NO questions
- Only ask questions if: The question REQUIRES specific user info AND we truly don't have it AND it's critical

**RULE 2: MAKE INTELLIGENT RECOMMENDATIONS**
- Based on user profile, conversation history, and context
- Be strategic and thoughtful
- Provide actionable guidance

**RULE 3: DETECT COMPLEXITY**
- Simple: Can answer with general info or basic recommendations
- Moderate: Needs some context but we can provide good guidance
- Complex: Requires deep personalization, multiple factors, or specialized knowledge → Suggest human consultation

**OUTPUT (JSON):**
{{
  "should_ask_questions": true/false,
  "questions": ["q1", "q2"] (ONLY if should_ask_questions is true, MAX 2-3 questions, make them smart and essential),
  "recommendations": ["rec1", "rec2", "rec3"] (Intelligent recommendations based on context - be specific and actionable),
  "complexity": "simple/moderate/complex",
  "needs_human_consultation": true/false,
  "reasoning": "Why you made these decisions"
}}

**EXAMPLES:**

Example 1 - Factual Question (NO questions needed):
Question: "What are UK visa fees?"
Output: {{"should_ask_questions": false, "questions": [], "recommendations": ["Based on UK visa fees, budget accordingly", "Consider IHS surcharge for longer courses"], "complexity": "simple", "needs_human_consultation": false}}

Example 2 - Recommendation Request with Context (NO questions, provide recommendations):
Question: "Which country should I choose for Masters?"
Profile: {{"target_country": "UK", "field_of_study": "Computer Science", "budget": ""}}
Output: {{"should_ask_questions": false, "questions": [], "recommendations": ["UK is excellent for 1-year CS Masters", "Consider Germany for lower costs if budget is concern", "Look at post-study work options"], "complexity": "moderate", "needs_human_consultation": false}}

Example 3 - Recommendation Request WITHOUT Critical Info (Ask ONLY essential questions):
Question: "Which university should I apply to?"
Profile: {{"target_country": "", "field_of_study": "", "budget": ""}}
Output: {{"should_ask_questions": true, "questions": ["What's your field of study?", "Which country are you considering?"], "recommendations": [], "complexity": "moderate", "needs_human_consultation": false}}

Example 4 - Complex Case (Human consultation needed):
Question: "I have a 2.5 GPA, low IELTS score, and need full scholarship - what are my options?"
Output: {{"should_ask_questions": false, "questions": [], "recommendations": ["This requires personalized assessment"], "complexity": "complex", "needs_human_consultation": true}}

**CRITICAL:**
- DON'T ask questions for factual queries - just answer
- DON'T ask if we have enough info to provide good recommendations
- ONLY ask if it's truly critical and we can't proceed without it
- Be intelligent and strategic like a mid-level consultant
- Make recommendations based on available information - be helpful

Return ONLY valid JSON.
"""
    )
    
    chain = prompt | llm | JsonOutputParser()
    
    try:
        result = chain.invoke({
            "question": question[:500],
            "conversation_summary": conversation_summary[:1000],
            "target_country": user_profile.get("target_country", "Not specified"),
            "field_of_study": user_profile.get("field_of_study", "Not specified"),
            "budget": user_profile.get("budget_range", "Not specified"),
            "concerns": ", ".join(user_profile.get("concerns", [])) or "None",
            "profile_completeness": profile_completeness,
            "has_context": "Yes" if has_sufficient_context else "Limited",
            "is_recommendation": "Yes" if is_recommendation_request else "No",
            "is_factual": "Yes" if is_factual_question else "No"
        })
        
        # Ensure we don't ask questions for factual queries
        if is_factual_question and result.get("should_ask_questions"):
            result["should_ask_questions"] = False
            result["questions"] = []
        
        logger.debug("Intelligent recommendations generated")
        return result
        
    except Exception as e:
        logger.error(f"Intelligent recommendation error: {e}", exc_info=True)
        # Fallback: Don't ask questions, provide basic recommendations
        return {
            "should_ask_questions": False,
            "questions": [],
            "recommendations": [],
            "complexity": "simple",
            "needs_human_consultation": False,
            "reasoning": "Error in analysis, defaulting to simple response"
        }


def extract_user_preferences(question: str, chat_history: list, current_profile: dict) -> dict:
    """Extract and update user preferences from conversation."""
    profile = current_profile.copy() if current_profile else {
        "target_country": "",
        "field_of_study": "",
        "budget_range": "",
        "concerns": []
    }
    
    # Combine current question with recent history for context
    full_text = question.lower()
    for msg in chat_history[-min(5, MAX_HISTORY_MESSAGES):]:
        if msg.get("role") == "user":
            full_text += " " + msg.get("content", "").lower()
    
    # Extract country preference
    if not profile.get("target_country"):
        for country, keywords in COUNTRY_KEYWORDS.items():
            if any(keyword in full_text for keyword in keywords):
                profile["target_country"] = country
                break
    
    # Extract field of study
    if not profile.get("field_of_study"):
        for field, keywords in FIELD_KEYWORDS.items():
            if any(keyword in full_text for keyword in keywords):
                profile["field_of_study"] = field
                break
    
    # Extract budget concerns
    if any(word in full_text for word in ["cheap", "affordable", "budget", "expensive", "cost"]):
        if "budget" not in profile.get("concerns", []):
            profile.setdefault("concerns", []).append("budget")
    
    # Extract visa concerns
    if any(word in full_text for word in ["visa", "immigration", "permit"]):
        if "visa" not in profile.get("concerns", []):
            profile.setdefault("concerns", []).append("visa")
    
    return profile


def generate_rag_answer(state: GraphState):
    """
    ULTRA-DYNAMIC response generation - handles ANY question intelligently.
    Organically promotes Margam when relevant.
    """
    log_with_context("debug", f"Processing generate_rag_answer - Question length: {len(state['question'])} chars")
    question = state["question"]
    documents = state["documents"]
    user_name = state.get("user_name", "there")
    chat_history = state.get("chat_history", [])
    user_sentiment = state.get("user_sentiment", "curious")
    conversation_state = state.get("conversation_state", "new_topic")
    
    # Extract and update user preferences (Conversation Memory)
    current_profile = state.get("user_profile", {})
    updated_profile = extract_user_preferences(question, chat_history, current_profile)
    
    # Detect language for bilingual support
    detected_language = detect_language(question)
    
    # Check if web search is enabled
    use_web_search = state.get("use_web_search", False)
    web_search_results = state.get("web_search_results", [])
    has_web_search = use_web_search and web_search_results and len(web_search_results) > 0
    
    context_parts = []
    
    # Build context - prioritize web search results when enabled
    if has_web_search:
        # When web search is enabled, give priority to web results for real-time/current information
        web_parts = []
        web_len = 0
        max_web_chars = min(6000, MAX_CONTEXT_CHARS)  # Allocate more space for web results when enabled
        
        for i, result in enumerate(web_search_results[:TAVILY_MAX_RESULTS * 2]):  # Include more results
            web_chunk = f"--- Web Source {i+1}: {result.get('title', 'Unknown')} ({result.get('url', '')}) ---\n{result.get('content', '')}"
            if web_len + len(web_chunk) > max_web_chars:
                break
            web_parts.append(web_chunk)
            web_len += len(web_chunk)
        
        if web_parts:
            web_search_context = "\n\n".join(web_parts)
            # Place web search results FIRST when enabled (higher priority)
            context_parts.append("=== LATEST WEB SEARCH RESULTS (Current/Real-time Information) ===\n" + web_search_context)
            
            # Then add document results (for reference/background) - limit to save space for web results
            doc_parts = []
            doc_len = 0
            max_doc_chars = min(4000, MAX_CONTEXT_CHARS - web_len)
            for doc in documents[:5]:
                doc_chunk = f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}"
                if doc_len + len(doc_chunk) > max_doc_chars:
                    break
                doc_parts.append(doc_chunk)
                doc_len += len(doc_chunk)
            
            if doc_parts:
                doc_context = "\n\n".join(doc_parts)
                context_parts.append("\n\n=== BACKGROUND KNOWLEDGE (Reference Documents) ===\n" + doc_context)
    else:
        # When web search is disabled, use only documents (original behavior)
        current_len = 0
        for doc in documents:
            chunk = f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}"
            if current_len + len(chunk) > MAX_CONTEXT_CHARS:
                break
            context_parts.append(chunk)
            current_len += len(chunk)
    
    context_str = "\n\n".join(context_parts)
    
    # Generate intelligent recommendations (MID-LEVEL CONSULTANT LOGIC)
    intelligent_rec = generate_intelligent_recommendations(
        question, updated_profile, chat_history, context_str, documents
    )
    
    # Extract intelligent recommendation variables
    should_ask_questions = intelligent_rec.get("should_ask_questions", False)
    intelligent_questions = intelligent_rec.get("questions", [])
    intelligent_recommendations_list = intelligent_rec.get("recommendations", [])
    recommendation_complexity = intelligent_rec.get("complexity", "simple")
    needs_human_consultation = intelligent_rec.get("needs_human_consultation", False)
    
    # Extract last bot response
    last_bot_msg = ""
    for msg in reversed(chat_history):
        if msg.get("role") == "assistant":
            last_bot_msg = msg.get("content", "")
            break
    
    # Format history
    history_str = ""
    for msg in chat_history[-MAX_HISTORY_MESSAGES:]:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")[:250]
        history_str += f"{role}: {content}...\n"
    
    # Intent-based formatting (with intelligent analysis)
    intent = state.get("search_intent", {})
    answer_format = intent.get("answer_format", "Natural conversation")
    margam_relevance = intent.get("margam_relevance", "medium")
    information_needs = intent.get("information_needs", [])
    smart_suggestions = intent.get("smart_suggestions", "")
    
    # Analyze formatting requirements based on question and context
    formatting_guide = analyze_formatting_requirements(question, context_str, intent)
    
    # Build conversation context for better understanding
    conversation_summary = ""
    previous_topics = []
    for msg in chat_history[-MAX_HISTORY_MESSAGES:]:
        if msg.get("role") == "user":
            content_lower = msg.get("content", "").lower()
            for country, keywords in COUNTRY_KEYWORDS.items():
                if any(kw in content_lower for kw in keywords) and country not in previous_topics:
                    previous_topics.append(country)
            for field, keywords in FIELD_KEYWORDS.items():
                if any(kw in content_lower for kw in keywords) and field not in previous_topics:
                    previous_topics.append(field)
    
    if previous_topics:
        conversation_summary = f"Previously discussed: {', '.join(previous_topics[:3])}"
    
    is_new_conversation = len(chat_history) <= 2
    
    # Extract source names for citation
    source_names = []
    for doc in documents[:5]:
        source = os.path.basename(doc.metadata.get("source", "Unknown"))
        if source not in source_names:
            source_names.append(source)
    
    prompt = ChatPromptTemplate.from_template(
        """You are Margam AI - an INTELLIGENT, KNOWLEDGEABLE, and STRATEGIC study abroad assistant. You have COMPLETE FREEDOM to make smart decisions about how to best help the user.

**YOUR INTELLIGENCE & FREEDOM:**
- You're not just a responder - you're a STRATEGIC ASSISTANT who thinks about what the user really needs
- You have FREEDOM to reason about questions, infer underlying needs, and provide comprehensive answers
- You can make SMART decisions about what information to include, how to structure it, and what additional context might help
- You're ADAPTIVE - handle edge cases, ambiguous questions, and complex scenarios intelligently
- You think MULTI-DIMENSIONALLY - consider not just the question, but the conversation flow, user sentiment, and underlying needs

**CRITICAL RULES - NO HALLUCINATION (But Be Intelligent):**
1. **ONLY use information from the context provided below** - but be smart about extracting ALL relevant information
2. **NEVER make up facts, numbers, dates, or details not in the context** - but you CAN make intelligent inferences and connections
3. **If information is missing, be STRATEGIC:**
   - Say what you DO know from context
   - Acknowledge what's missing intelligently
   - Offer helpful alternatives or next steps
   - Only mention Margam if it's truly relevant and helpful
4. **Always cite which document/source your information comes from when relevant** - but don't over-cite simple facts
5. **If the context doesn't answer the question, be INTELLIGENT:**
   - Can you infer a helpful answer from related information?
   - Can you provide partial information that's still useful?
   - Can you guide them to the right next step?
   - Be honest but helpful

**WEB SEARCH INTELLIGENCE (ONLY when web search results are provided - {has_web_search}):**

**CRITICAL: When web search is enabled, you have FREEDOM to use web search results intelligently!**

**INTELLIGENT USE OF WEB SEARCH RESULTS:**
- **DYNAMIC EVALUATION**: Use your intelligence to evaluate web search results based on the specific question
- **QUESTION-BASED PRIORITY**: 
  * For questions about CURRENT prices, dates, deadlines, fees, flights, weather, etc. → PRIORITIZE web search results (they're more current)
  * For questions about processes, requirements, general info → Use both web + documents intelligently
  * For questions about Margam-specific info → Prioritize documents, use web for verification
- **USE YOUR JUDGMENT**: Analyze which sources are most relevant and reliable for THIS specific question
- **REAL-TIME INFORMATION**: Web search results contain CURRENT information - use them actively when the question requires up-to-date data
- **SMART SYNTHESIS**: Combine information from multiple web sources intelligently - cross-reference, verify patterns, extract the best information

**WHEN TO PRIORITIZE WEB SEARCH:**
- Current prices, costs, fees, flight prices
- Recent deadlines, dates, timelines
- Latest policy changes, updates
- Current weather, events, news
- Real-time availability, booking info
- Any question explicitly asking for "current", "latest", "now", "today", "recent"

**WHEN TO USE BOTH:**
- General processes (use documents for structure, web for current specifics)
- Requirements (use documents for standards, web for recent changes)
- Comparisons (use both to get comprehensive view)

**CITATIONS & DISCLAIMERS:**
- When using web search data: Cite the source naturally (e.g., "According to recent search results..." or "Based on current information from [source]...")
- Always add a disclaimer at the END of your response when web search is used: "Note: The information above is based on recent web search results and may change. Please verify current details with official sources before making decisions."
- For prices/costs: Mention that prices are approximate and subject to change

**RELIABILITY:**
- Prefer official websites (government, airlines, universities, financial institutions)
- Cross-reference multiple sources when possible
- Use common sense - if something seems off, mention it or rely more on documents

**YOUR IDENTITY:**
{margam_dna}

**CRITICAL - BOT IDENTITY QUESTIONS:**
If user asks about YOU (the chatbot) - "Who are you?", "What are you?", "What can you do?", "How do you work?", "Are you AI?":
- Answer ONLY about YOURSELF (Margam AI assistant)
- DO NOT mention the founder (Jeevithram) unless specifically asked about him
- Keep it SHORT and SIMPLE (50-100 words max)
- Mention Margam briefly (1 sentence only)
- Focus on: What you are, what you help with, that you're available 24/7
- Example: "Hi {user_name}! I'm Margam AI - your 24/7 study abroad assistant. I help with visas, universities, scholarships, and more. I'm built by Margam to make your study abroad journey easier. What would you like to know?"

**CONVERSATION CONTEXT:**
{conversation_summary}

**RECENT CHAT HISTORY:**
{history}

**LAST BOT RESPONSE (DO NOT REPEAT THIS CONTENT):**
{last_bot_msg}

**USER'S NAME:** {user_name}
**USER'S EMOTIONAL STATE:** {user_sentiment}
**CONVERSATION STATE:** {conversation_state}
**IS NEW CONVERSATION:** {is_new_conversation}

**CURRENT DATE/TIME CONTEXT (DYNAMIC - UPDATED IN REAL-TIME):**
- Current Date: {current_date}
- Current Year: {current_year}
- Current Month: {current_month_name} ({current_month})
- Full DateTime: {current_datetime}
- Next Year: {next_year}
- Current Academic Year: {academic_year}
- Next Academic Season: {next_academic_season}
- Current Academic Season: {current_academic_season}

**IMPORTANT - USE DYNAMIC DATE CONTEXT:**
When answering questions about "current", "latest", "next", "upcoming", or time-sensitive information, use the dynamic date context above to provide accurate, up-to-date responses. 

**KEY CONTEXT:**
- Today is {current_date} ({current_month_name} {current_year})
- "Next academic season" refers to: {next_academic_season}
- "Current academic season" refers to: {current_academic_season}
- Academic year context: {academic_year}

Always use these dynamic values when interpreting time-sensitive questions. For example, if someone asks "when is the next intake?", they're asking about {next_academic_season} based on today's date ({current_date}).

**USER'S QUESTION:** {question}

**YOUR CONTEXT (Web Search Results + Documents):**
{context}

**NOTE**: If web search is enabled ({has_web_search}), the context above includes BOTH web search results (for current/real-time info) AND documents (for background knowledge). Use your intelligence to prioritize based on the question type.

**AVAILABLE SOURCES:**
{source_list}

**RESPONSE STRUCTURE:**

1. **PERSONALIZED INTRODUCTION**:
   - If new conversation: Start with warm greeting using {user_name}'s name
   - If follow-up: Acknowledge previous discussion naturally
   - If continuing: Connect to ongoing conversation
   - Keep brief (1-2 sentences)
   - NO emojis unless absolutely necessary (max 1, prefer none)

2. **MAIN ANSWER** (Data-Grounded, Information-Dense, Intelligently Structured):
   - Answer STRICTLY from the context provided - but be SMART about extracting ALL relevant information
   - **PACK INFORMATION DENSELY**: Give maximum information in minimum words
   - **THINK STRATEGICALLY**: What does the user REALLY need? Include related information that might help
   - If context has the answer: Present ALL relevant details clearly and concisely - don't miss anything important
   - If context is partial: Be INTELLIGENT - can you infer helpful information? Can you provide partial but useful answers?
   - If context is missing: Be STRATEGIC - can you provide related information? Can you guide them intelligently?
   - Use {user_name}'s name 1-2 times in the main answer naturally
   - Reference source documents when providing specific facts - but don't over-cite
   - **BE COMPREHENSIVE**: Include all key points, not just one aspect - think about what else might be relevant
   - **BE CONCISE**: Every word must add value - no filler
   - **BE INTELLIGENT**: Make connections, provide context, anticipate follow-up questions

3. **INTELLIGENT FORMATTING BASED ON QUESTION TYPE (CRITICAL - MOST IMPORTANT):**

**FORMATTING ANALYSIS:**
- Format Type: {format_type}
- Use Table: {use_table}
- Use List: {use_list}
- Use Numbered Steps: {use_numbered}
- Use Paragraphs: {use_paragraphs}
- Specific Instructions: {format_instructions}

**DETAILED FORMATTING RULES:**

**A. COMPARISON QUESTIONS** (vs, compare, difference, better, which):
   - **MUST use a comparison table** with side-by-side columns
   - Table structure: | Feature/Aspect | Option 1 | Option 2 | Option 3 |
   - Include ALL relevant metrics: costs, requirements, duration, pros/cons
   - Add brief paragraph explaining key differences
   - Example: "UK vs Germany for Masters" → Table with columns: UK | Germany, rows: Tuition, Living Cost, Duration, Work Permit, etc.

**B. FEE/COST QUESTIONS** (fee, cost, price, expense, budget, tuition):
   - **MUST use a cost table** with currency conversion
   - Table structure: | Item/Service | Original Currency | INR Equivalent |
   - Always include both original currency (£, €, $) AND INR (₹)
   - Conversion rates: £1 = ₹{gbp_to_inr}, €1 = ₹{eur_to_inr}, $1 = ₹{usd_to_inr}
   - Group related costs (e.g., Application Fees, Visa Fees, Living Costs)
   - Add totals where applicable
   - Include brief paragraph explaining what each cost covers

**C. DOCUMENT/REQUIREMENT QUESTIONS** (document, requirement, need, checklist):
   - **MUST use bullet points** (•) for each item
   - Format: • **Item Name** (brief description or requirement)
   - Group related documents if applicable
   - Add brief paragraph explaining purpose or important notes
   - If many items, consider sub-grouping (e.g., Academic Documents, Financial Documents, etc.)

**D. PROCESS/STEP QUESTIONS** (how to, process, steps, procedure):
   - **MUST use numbered steps** (1., 2., 3., etc.)
   - Each step should be clear, actionable, and complete
   - Format: 
     1. **Step Title** - Detailed explanation
     2. **Step Title** - Detailed explanation
   - Add brief introductory paragraph explaining the overall process
   - Add brief conclusion paragraph with tips or next steps

**E. LIST/ENUMERATION QUESTIONS** (list, universities, cities, options):
   - **MUST use bullet points** (•) for each item
   - Format: • **Item Name** - Brief description or key detail
   - If many items, group them logically (e.g., by country, by ranking, by field)
   - Add brief introductory paragraph
   - Consider limiting to top 10-15 items if list is very long

**F. TIMELINE/DEADLINE QUESTIONS** (deadline, timeline, when, dates):
   - **MUST use a timeline table**
   - Table structure: | Event/Milestone | Date/Timeframe | Details/Notes |
   - Organize chronologically (earliest to latest)
   - Include all relevant dates and deadlines
   - Add brief paragraph explaining the timeline or important considerations

**G. STATISTICS/NUMBERS QUESTIONS** (statistics, percentage, rate, data):
   - **MUST use a statistics table**
   - Table structure: | Metric/Statistic | Value | Notes/Context |
   - Make percentages and rates prominent
   - Include all relevant numbers from context
   - Add brief paragraph providing context or interpretation

**H. EXPLANATION QUESTIONS** (what is, why, explain, meaning):
   - **Use clear paragraphs** with logical flow
   - Break complex explanations into 2-3 paragraphs
   - Use bullet points for key points or features
   - Make it scannable with subheadings if needed
   - Keep paragraphs concise (3-5 sentences each)

**FORMATTING BEST PRACTICES:**
- **Tables**: Use markdown table format with proper alignment. Always include headers. Keep columns aligned.
- **Lists**: Use bullet points (•) for unordered lists, numbered (1., 2., 3.) for ordered/sequential lists
- **Paragraphs**: Keep to 3-5 sentences. Use line breaks between paragraphs for readability.
- **Combination**: You can combine formats (e.g., table + paragraph, list + table, numbered steps + bullet points)
- **Data Extraction**: Extract ALL relevant data from context. Don't miss any important numbers, dates, or details.
- **Visual Hierarchy**: Use bold (**text**) for emphasis, especially for table headers, list items, and key terms

4. **ANTI-REPETITION:**
   - NEVER repeat content from the last bot response
   - If similar question, provide NEW information or different angle
   - Vary your phrasing and structure
   - Reference what was discussed before only if adding new information

5. **CONVERSATIONAL TONE & EXPLANATORY CHATGPT-STYLE FORMATTING:**
   - Persona: An intelligent, empathetic, and exceptionally thorough study abroad advisor — explaining concepts in the engaging, structured, and helpful style of ChatGPT.
   - **ANSWER THOROUGHLY & COMPREHENSIVELY**: Answer every question the user asks. Break down complex questions with clear sections, headers, bullet points, and tables. Explain the "why" and "how".
   - **STRUCTURE OVER BREVITY**: Do not artificially restrict responses to 3 sentences when the user asks for explanations, processes, comparisons, or requirements. Provide detailed, well-structured, easy-to-read insights.
   - **CLEAR FORMATTING**: Use bold text, organized bullet lists, numbered steps, and markdown tables whenever helpful for readability.
   - **HELPFUL MENTORSHIP**: Acknowledge the student warmly by name, provide practical tips, actionable next steps, and mention Margam's mentorship (profile evaluations, SOP reviews by founder Jeevithram Mamidala) organically.
   - Minimal emojis (0-1 max, prefer clean readability).

6. **INFORMATION-DENSE & HIGH-VALUE EXPLANATIONS:**
   - Every paragraph should provide clear value, concrete data points, and actionable knowledge.
   - For fees and living costs: cite verified figures (e.g., Germany Blocked Account €11,904/year; UK £1,023–£1,334/month; Canada CAD $20,635 GIC; Australia AUD $29,710).

7. **PERSONALIZED CONCLUSION**:
   - Natural closing that feels conversational
   - Use {user_name}'s name if appropriate
   - **ONLY mention Margam if it's truly relevant** (not every time)
   - If mentioning Margam: Keep it to 1 sentence, make it feel natural
   - Invite further questions naturally
   - Keep conclusion brief (1-2 sentences max)

**MARGAM BRANDING (TRULY ORGANIC - Only When It Makes Sense):**
- **CRITICAL**: Do NOT mention Margam in every response
- Only mention Margam when:
  * User asks about Margam services specifically
  * User needs help that Margam provides (SOP, visa assistance, loans, etc.)
  * User asks "who can help me?" or similar
  * It naturally fits the conversation flow
- **DO NOT mention Margam for:**
  * Simple factual questions (fees, requirements, dates)
  * General information questions
  * When the answer is complete without it
  * When it feels forced or unnatural
- When you DO mention Margam:
  * Keep it to 1 sentence maximum
  * Use DIFFERENT variations each time (rotate from MARGAM_DNA)
  * Make it feel like a natural suggestion, not a sales pitch
  * Never repeat the same phrase in consecutive responses

**EXAMPLES OF GOOD RESPONSES:**

**Example 1 - New Conversation, Visa Question (Information-Dense, No Forced Margam):**
"Hi {user_name}! Based on the UK Student Visa Application Guide, here's the fee breakdown:

| Fee Type | Amount | INR Equivalent |
|----------|--------|----------------|
| Visa Application Fee | £490 | ₹53,900 |
| IHS Surcharge (per year) | £470 | ₹51,700 |
| **Total (1 year)** | **£960** | **₹1,05,600** |

The IHS surcharge covers your NHS access for the duration of your course. For longer courses, multiply £470 by the number of years. The visa fee is a one-time payment, {user_name}.

Feel free to ask if you need details on the application process or required documents!"

**Example 2 - Follow-up Question (Comprehensive but Concise):**
"{user_name}, here are the key documents based on the UK Student Visa Checklist:

- **Valid passport** (with at least 6 months validity)
- **CAS letter** from your university (Confirmation of Acceptance for Studies)
- **Financial evidence** (bank statements showing funds for tuition + living costs for 9-12 months)
- **TB test certificate** (required if staying more than 6 months, from approved clinics)
- **Academic certificates** (transcripts, degree certificates)
- **English language test results** (IELTS/PTE/Duolingo)
- **ATAS certificate** (if required for certain courses)

Each document has specific requirements, {user_name}. Want details on any specific one, or shall we discuss the application timeline?"

**Example 3 - Missing Information (Margam Mention Only When Relevant):**
"{user_name}, the documents I have don't include specific scholarship deadline information, as these vary by university and program. Generally, scholarship deadlines are:
- **Early deadlines**: October-December (for September intake)
- **Regular deadlines**: January-March
- **Late deadlines**: April-June (limited options)

For accurate deadlines for your target universities, check each university's website or contact their admissions office directly. Is there anything else about scholarships or the application process I can help with?"

**Example 4 - Comparison Question (MUST Use Table):**
"{user_name}, here's a comparison of UK vs Germany for Masters:

| Aspect | UK | Germany |
|--------|----|---------|
| Tuition Fees | £15,000-£35,000/year | €0-€20,000/year (mostly free) |
| Living Costs | £12,000-£15,000/year | €8,000-€12,000/year |
| Duration | 1 year | 2 years |
| Work Permit | 2 years post-study | 18 months post-study |
| Language | English | German (some English programs) |
| Application Deadline | Jan-Mar | Varies by university |

UK offers shorter programs and strong post-study work options, while Germany provides lower costs and longer programs. Choose based on your budget and career goals, {user_name}."

**Example 5 - Process Question (MUST Use Numbered Steps):**
"{user_name}, here's how to apply for a UK student visa:

1. **Get CAS Letter** - Receive Confirmation of Acceptance for Studies from your university
2. **Prepare Documents** - Gather passport, financial evidence, TB test certificate, academic certificates
3. **Complete Online Application** - Fill the visa application form on UKVI website
4. **Pay Fees** - Pay visa fee (£490) and IHS surcharge (£470/year)
5. **Book Biometric Appointment** - Schedule appointment at VFS Global center
6. **Submit Documents** - Upload documents online and submit passport at appointment
7. **Wait for Decision** - Processing takes 3-8 weeks typically

Start the process 3 months before your course starts, {user_name}. Need details on any specific step?"

**Example 6 - Timeline Question (MUST Use Table):**
"{user_name}, here's the UK student visa application timeline:

| Milestone | Timeframe | Details |
|-----------|-----------|---------|
| Receive CAS | 3-4 months before course | University issues CAS after acceptance |
| Apply for Visa | 3 months before course | Earliest application date |
| Biometric Appointment | Within 2 weeks of application | Book at VFS Global center |
| Visa Decision | 3-8 weeks after appointment | Standard processing time |
| Travel to UK | Up to 1 month before course | Can enter UK early |

Plan to start your application 4-5 months before your course begins, {user_name}."

**Example 7 - Bot Identity Question (SHORT & SIMPLE):**
"Hi {user_name}! I'm Margam AI - your 24/7 study abroad assistant. I help with visas, universities, scholarships, SOPs, and more. I'm built by Margam to make your study abroad journey easier. What would you like to know?"

**CRITICAL FOR BOT IDENTITY QUESTIONS:**
- Keep it SHORT (50-100 words max)
- Only talk about YOURSELF (the AI assistant)
- DO NOT mention founder unless specifically asked
- Mention Margam briefly (1 sentence only)
- Be simple and direct

**INTELLIGENT RECOMMENDATIONS & QUESTIONING (MID-LEVEL CONSULTANT LOGIC):**

**COMPLEXITY LEVEL:** {recommendation_complexity}
**NEEDS HUMAN CONSULTATION:** {needs_human_consultation}

**SHOULD WE ASK QUESTIONS?** {should_ask_questions}
- If YES: We've identified that we need more information. Ask these questions naturally in your response: {intelligent_questions}
- If NO: Don't ask questions - provide recommendations and guidance instead

**INTELLIGENT RECOMMENDATIONS TO INCLUDE:**
{intelligent_recommendations}

**HANDLING COMPLEX CASES:**
- If complexity is "complex" OR needs_human_consultation is true:
  * Provide what guidance you can from context
  * At the end, naturally suggest: "For personalized guidance tailored to your specific situation, I'd recommend speaking with our expert team. They can provide detailed assessment and help create a customized plan for you. You can reach them at {phone_primary} or book a consultation at {booking_url}."
  * Make it feel helpful, not dismissive
- If complexity is "simple" or "moderate": Provide full guidance and recommendations

**CRITICAL RULES:**
- **DON'T IRRITATE USERS**: Only ask questions if should_ask_questions is true AND the questions are essential
- **BE HELPFUL**: If we have enough info, provide recommendations - don't ask unnecessary questions
- **BE STRATEGIC**: Like a mid-level consultant, provide intelligent guidance based on what we know
- **NATURAL FLOW**: Integrate questions or recommendations naturally into your response, don't make it feel like a form

**NOW GENERATE YOUR RESPONSE (USE YOUR INTELLIGENCE):**

**YOUR STRATEGIC APPROACH:**
1. **THINK FIRST**: What does the user really need? What's the best way to help them?
2. **BE INTELLIGENT**: Make smart decisions about what information to include, how to structure it, what additional context helps
3. **BE COMPREHENSIVE**: Don't just answer the surface question - think about related information that might help
4. **BE ADAPTIVE**: Handle edge cases, ambiguous questions, and complex scenarios intelligently
5. **BE STRATEGIC**: Consider the conversation flow, user sentiment, and underlying needs
6. **INTELLIGENT RECOMMENDATIONS**: Include the intelligent recommendations naturally in your response if provided
7. **ASK QUESTIONS ONLY IF NEEDED**: If should_ask_questions is true, ask the provided questions naturally - otherwise focus on providing value

**FORMATTING (CRITICAL - MOST IMPORTANT):**
- **FOLLOW THE FORMATTING INSTRUCTIONS ABOVE STRICTLY** - This is the MOST IMPORTANT aspect
- **If format_type requires a table, YOU MUST CREATE A TABLE** - No exceptions
- **If format_type requires numbered steps, YOU MUST USE NUMBERED STEPS** - No exceptions
- **If format_type requires bullet points, YOU MUST USE BULLET POINTS** - No exceptions
- **But be SMART**: If the question needs a combination of formats, use them intelligently

**CONTENT QUALITY:**
- Use {user_name} naturally 2-3 times
- Answer STRICTLY from context - NO hallucination, but be intelligent about extracting information
- **Pack maximum information in minimum words** - be comprehensive but concise
- **Use simple, natural language** - like talking to a friend
- **Be direct and clear** - no fluff, no filler
- **Extract ALL relevant data from context** - don't miss any numbers, dates, or details
- **Format data properly** - tables must be properly formatted markdown, lists must use bullets/numbers
- **Make intelligent connections** - if they ask about fees, maybe mention related costs or financial aid options
- **Anticipate needs** - what follow-up questions might they have? Address them proactively

**PERSONALIZATION & TONE:**
- Personalized intro and conclusion
- NO repetition from previous responses
- **Mention Margam ONLY when it's truly relevant** - not every time
- Minimal emojis (0-1 max, prefer none)

**YOUR FREEDOM TO BE INTELLIGENT:**
- You're not bound by rigid rules - you can make smart decisions
- If a question is ambiguous, use context to infer what they likely need
- If information is partial, be strategic about what you can still provide
- If you see an opportunity to be more helpful, take it
- Think like a smart assistant who genuinely wants to help

**REMEMBER: You're an intelligent assistant. Use your reasoning, consider context, make smart decisions, and provide the most helpful answer possible. Response formatting is critical, but so is being intelligent about what information to include and how to structure it.**
"""
    )

    
    chain = prompt | llm | StrOutputParser()
    
    try:
        # Include intelligent suggestions in the prompt context
        intelligent_guidance = ""
        if smart_suggestions:
            intelligent_guidance = f"\n\n**INTELLIGENT SUGGESTIONS:** {smart_suggestions}\n"
        if information_needs:
            intelligent_guidance += f"\n**INFORMATION NEEDS IDENTIFIED:** {', '.join(information_needs)}\n"
        
        enhanced_context = context_str + intelligent_guidance
        
        # Get current date/time dynamically for context
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        current_year = now.year
        next_year = current_year + 1
        current_month = now.month
        current_month_name = now.strftime("%B")  # Full month name (e.g., "January")
        current_date = now.strftime("%Y-%m-%d")
        current_datetime = now.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Determine next academic season dynamically based on current month
        # UK academic year typically starts in September
        if current_month >= 9:  # September onwards
            next_academic_season = f"September {next_year}"
            current_academic_season = f"September {current_year}"
        elif current_month >= 1:  # January to August
            next_academic_season = f"September {current_year}"
            current_academic_season = f"September {current_year - 1}"
        
        # Determine academic year context
        if current_month >= 9:
            academic_year = f"{current_year}-{next_year}"
        else:
            academic_year = f"{current_year - 1}-{current_year}"
        
        generation = chain.invoke({
            "margam_dna": get_margam_dna(),
            "context": enhanced_context,
            "question": question,
            "history": history_str,
            "conversation_summary": conversation_summary,
            "last_bot_msg": last_bot_msg[:500] if last_bot_msg else "",
            "user_name": user_name,
            "user_sentiment": user_sentiment,
            "conversation_state": conversation_state,
            "is_new_conversation": is_new_conversation,
            "answer_format": answer_format,
            "margam_relevance": margam_relevance,
            "source_list": ", ".join(source_names[:5]),
            "phone_primary": MARGAM_CONTACT['phone_primary'],
            "booking_url": MARGAM_CONTACT['booking_url'],
            "gbp_to_inr": str(CURRENCY_RATES['GBP_TO_INR']),
            "eur_to_inr": str(CURRENCY_RATES['EUR_TO_INR']),
            "usd_to_inr": str(CURRENCY_RATES['USD_TO_INR']),
            "format_type": formatting_guide["format_type"],
            "use_table": "YES - REQUIRED" if formatting_guide["use_table"] else "NO",
            "use_list": "YES - REQUIRED" if formatting_guide["use_list"] else "NO",
            "use_numbered": "YES - REQUIRED" if formatting_guide["use_numbered"] else "NO",
            "use_paragraphs": "YES" if formatting_guide["use_paragraphs"] else "NO",
            "format_instructions": formatting_guide["specific_instructions"],
            "MAX_RESPONSE_WORDS_SIMPLE": str(MAX_RESPONSE_WORDS_SIMPLE),
            "MAX_RESPONSE_WORDS_STANDARD": str(MAX_RESPONSE_WORDS_STANDARD),
            "MAX_RESPONSE_WORDS_COMPLEX": str(MAX_RESPONSE_WORDS_COMPLEX),
            "should_ask_questions": "YES" if should_ask_questions else "NO",
            "intelligent_questions": "\n".join([f"- {q}" for q in intelligent_questions]) if intelligent_questions else "None",
            "intelligent_recommendations": "\n".join([f"- {r}" for r in intelligent_recommendations_list]) if intelligent_recommendations_list else "None",
            "recommendation_complexity": recommendation_complexity,
            "needs_human_consultation": "YES" if needs_human_consultation else "NO",
            "has_web_search": "YES" if has_web_search else "NO",
            "current_date": current_date,
            "current_year": str(current_year),
            "next_year": str(next_year),
            "current_month": str(current_month),
            "current_month_name": current_month_name,
            "current_datetime": current_datetime,
            "next_academic_season": next_academic_season,
            "current_academic_season": current_academic_season,
            "academic_year": academic_year
        })
    except Exception as e:
        log_with_context("error", f"Generation error: {e}", exc_info=True)
        
        # Provide helpful error message based on error type
        if "timeout" in str(e).lower() or "timed out" in str(e).lower():
            error_msg = f"I apologize, {user_name}, but the request took too long to process. Please try rephrasing your question or contact Margam's team at {MARGAM_CONTACT.get('phone_primary', '+91 7981804359')} for immediate assistance."
        elif "rate limit" in str(e).lower() or "quota" in str(e).lower():
            error_msg = f"I apologize, {user_name}, but we're experiencing high demand. Please try again in a moment or contact Margam's team at {MARGAM_CONTACT.get('phone_primary', '+91 7981804359')} for immediate assistance."
        else:
            error_msg = f"I apologize, {user_name}, but I encountered an issue processing your question. Please try rephrasing it, or reach out to Margam's team at {MARGAM_CONTACT.get('phone_primary', '+91 7981804359')} for immediate assistance."
        
        generation = error_msg
    
    # Remove excessive emojis (keep max 1 if natural)
    lines = generation.split('\n')
    cleaned_lines = []
    emoji_count = 0
    for line in lines:
        # Count emojis in line (excluding currency symbols)
        emoji_chars = [c for c in line if ord(c) > 127 and c not in ['₹', '£', '€', '$', '•', '✓', '✅']]
        if len(emoji_chars) > 0 and emoji_count >= 1:
            # Remove emojis if we already have one
            line = ''.join(c for c in line if ord(c) <= 127 or c in ['₹', '£', '€', '$', '•', '✓', '✅'])
        elif len(emoji_chars) > 0:
            emoji_count += 1
        cleaned_lines.append(line)
    generation = '\n'.join(cleaned_lines)
    
    # Add web search disclaimer if web search was used
    if has_web_search:
        disclaimer_text = f"\n\n*Note: The information above is based on recent web search results and may change. Please verify current details with official sources before making decisions.*"
        generation += disclaimer_text
    
    # Add intelligent follow-up suggestions (only if not a bot identity question and not asking questions)
    is_bot_identity_question = any(phrase in question.lower() for phrase in [
        "who are you", "what are you", "what can you do", "how do you work", 
        "are you ai", "are you a bot", "what is margam ai"
    ])
    
    # Only add follow-up suggestions if:
    # 1. Not a bot identity question
    # 2. We're NOT asking questions (if asking questions, those are the suggestions)
    # 3. We have intelligent recommendations OR we can generate contextual follow-ups
    if not is_bot_identity_question and not should_ask_questions and not needs_human_consultation:
        # Generate contextual follow-up questions
        follow_up_questions = get_follow_up_questions(
            question, 
            updated_profile.get("target_country", ""),
            updated_profile.get("field_of_study", ""),
            chat_history
        )
        
        if follow_up_questions:
            follow_up_headers = {
                "hindi": "**You might also want to know:**",
                "telugu": "**You might also want to know:**",
                "tamil": "**You might also want to know:**",
                "kannada": "**You might also want to know:**",
                "english": "**You might also want to know:**"
            }
            header = follow_up_headers.get(detected_language, follow_up_headers["english"])
            follow_up_text = f"\n\n<!-- SUGGESTIONS_START -->\n\n{header}\n"
            for fq in follow_up_questions:
                follow_up_text += f"- {fq}\n"
            generation += follow_up_text
    
    return {
        "generation": generation, 
        "last_bot_response": generation,
        "user_profile": updated_profile,  # Save updated profile
        "recommendation_complexity": recommendation_complexity,
        "needs_clarification": should_ask_questions,
        "intelligent_recommendations": intelligent_rec
    }



def escalation_response(state: GraphState):
    """
    Handle queries asking about shortlisting, application processes, portals, or requirements.
    Provides a comprehensive, structured explanation in ChatGPT style while recommending Margam's free mentorship.
    """
    log_with_context("info", "Processing escalation_response (ChatGPT-Style Explanatory Guidance)")
    user_name = state.get("user_name", "")
    name_str = f" {user_name}" if user_name and user_name != "there" else ""
    question = state.get("question", "")
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are Margam AI, an elite Study Abroad Mentor providing comprehensive, structured explanations in the style of ChatGPT.

The student is asking an admissions or application execution question: {question}

OBJECTIVE:
1. Provide a thorough, well-structured, explanatory answer addressing their question directly.
2. If they ask about university shortlisting: Explain the exact criteria used for shortlisting (categorization into Dream/Reach/Safe, GPA/backlog impact, APS/ECTS credit matching for Germany, CAS points for UK, GRE/IELTS minimums), provide concrete examples of top destinations and program tiers, and explain how candidates optimize their odds.
3. If they ask about portals or application steps: Walk them through the overall stage-by-stage application workflow, typical application fees, timeline milestones, and common pitfalls to avoid.
4. If they ask about SOPs or essays: Provide structured frameworks for writing winning SOPs (hook, academic foundation, research/work experience, why this university, career vision) with clear do's and don'ts.
5. FORMATTING: Use bold subheadings, clean bullet points, and actionable breakdowns.
6. CALL TO ACTION: Acknowledge {user_name} warmly and mention that Margam's mentors and founder Jeevithram Mamidala offer free 1-on-1 profile evaluations and SOP reviews to help them build their exact customized application roadmap."""),
        ("human", "Student Question: {question}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    try:
        response = chain.invoke({"question": question, "name_str": name_str, "user_name": user_name or "there"})
    except Exception as e:
        logger.error(f"Escalation generation failed: {e}")
        response = f"Here is a comprehensive breakdown of how university applications and shortlisting work for your journey{name_str}."

    return {
        "generation": response,
        "is_escalation": True,
        "cta_type": "book_consultation",
        "last_bot_response": response
    }

def general_greeting(state: GraphState):
    """
    Warm, human greeting following PRD Tone & Persona Guide - never starts with 'I'.
    """
    log_with_context("debug", "Processing greeting")
    user_name = state.get("user_name", "there")
    
    greetings = [
        f"Hey {user_name}! Great to connect. Are you exploring Fall 2026 or Spring 2027 intakes right now?",
        f"Hey {user_name}! Welcome to Margam. Where are you leaning towards studying — Germany, UK, Ireland, or somewhere else?",
        f"Hey {user_name}! Figuring out study abroad can feel like a maze, but we'll break it down together. What degree and country are on your mind?",
        f"Hey there, {user_name}! Good to have you here. Let's figure out what country and course fit your profile best. What's the main goal right now?",
    ]
    
    return {"generation": random.choice(greetings)}



def acknowledgment_response(state: GraphState):
    """
    Brief, encouraging response for acknowledgments with personalization - minimal emojis.
    """
    log_with_context("debug", "Processing acknowledgment")
    user_name = state.get("user_name", "")
    
    responses = [
        f"Awesome, {user_name}! What else can I help you with? I'm here for all your study abroad questions - visas, universities, scholarships, you name it!",
        f"Perfect, {user_name}! Anything specific you'd like to dive into? Feel free to ask anything!",
        f"Great, {user_name}! Let me know if you want to explore any topic deeper. I'm here to guide you every step of the way!",
        f"Glad that helped, {user_name}! What's next on your mind? Whether it's applications, visas, or student life - I've got you covered!",
        f"Cool, {user_name}! Feel free to ask anything else about your study abroad journey. I'm always ready to help!",
        f"Nice, {user_name}! I'm here whenever you have more questions. What would you like to know next?",
        f"Awesome, {user_name}! Whether it's about applications, visas, or student life - just ask! I'm here for you.",
        f"Perfect, {user_name}! Want to discuss anything else? Universities, scholarships, loans - I've got you covered!",
    ]
    
    return {"generation": random.choice(responses)}



def margam_defense_response(state: GraphState):
    """
    STRONG defense of Margam against negative comments.
    Uses proof, testimonials, and stats to build trust.
    """
    log_with_context("debug", "Processing margam defense")
    user_name = state.get("user_name", "")
    question = state["question"]
    
    prompt = ChatPromptTemplate.from_template(
        """You are Margam AI - and someone just attacked or doubted Margam's credibility.

**USER SAID:** "{question}"
**USER'S NAME:** {user_name}

**YOUR MISSION:** DEFEND Margam STRONGLY with PROOF. Be empathetic but firm.

**DEFENSE STRATEGY:**

1. **Acknowledge their concern** (don't dismiss it)
2. **Provide CONCRETE PROOF:**
   - {students_helped} successful students
   - {visa_success_rate} visa success rate
   - {rating} rating
   - Real testimonials (Saran Babu, Wasiuddin, etc.)
   - Founder Jeevithram's personal involvement
3. **Address the specific concern** (scam/trust/genuine)
4. **Offer transparency** (call us, talk to students, no upfront cost)
5. **End with invitation** to verify

**TONE:** Confident, empathetic, proof-driven (NOT defensive or angry)

**MARGAM PROOF POINTS:**
- **No Upfront Cost**: You only pay after booking (shows confidence)
- **{visa_success_rate} Visa Success**: Every single student we've helped got their visa
- **Founder's Personal Touch**: Jeevithram personally reviews every SOP
- **Real Students**: Saran Babu got £10k scholarship after US rejection
- **Transparent**: Call {phone_primary}, talk to our team, ask for student references
- **Student-First**: We're built by students, for students (not agents)

**RESPONSE EXAMPLES:**

For "Margam is a scam":
"{user_name}, I understand why you might be skeptical - there are unfortunately many fake consultants out there. But let me share some facts about Margam:

**Our Track Record:**
- {students_helped} students successfully placed
- {visa_success_rate} visa success rate (not 99%, ONE HUNDRED percent)
- {rating} rating from students
- No upfront cost - you pay only after booking

**Real Stories:**
Saran Babu came to us after a US visa rejection, completely lost. We helped him get into University of Bath with a £10,000 scholarship. He's now thriving in AI. Wasiuddin Mohammed says we helped him 'write his story with heart' to get into top Russell Group schools.

**Why We're Different:**
Our founder Jeevithram personally reviews every SOP. He doesn't treat students as numbers - he treats your dream as his own. That's not how scams operate, {user_name}.

**Verify Yourself:**
- Call us: {phone_primary}
- Ask for student references
- Check our LinkedIn testimonials
- Talk to Jeevithram directly

{user_name}, we've earned trust through results, not promises. Want to talk to some of our students? We're happy to connect you."

For "I don't trust Margam":
"{user_name}, trust has to be earned, and I respect that you're being careful. Here's how Margam earns trust:

**Transparency:**
- No hidden fees
- No upfront cost (you pay after booking)
- Clear process from day one

**Proof:**
- {visa_success_rate} visa success rate (every student got their visa)
- {students_helped} successful placements
- Real testimonials you can verify

**Personal Touch:**
Our founder Jeevithram personally talks to every student. He founded Margam because he was tired of agents treating students like numbers. His philosophy: treat every student's dream as his own.

**Student Voices:**
- D. Sarath Kumar: 'Margam earned my trust online'
- Saran Babu: 'After US rejection, Margam changed everything'
- Wasiuddin: 'Jeevith was endlessly supportive'

{user_name}, we don't ask you to trust us blindly. Call us at {phone_primary}, ask tough questions, talk to our students. Trust is earned through transparency, and we're an open book."

**NOW GENERATE YOUR STRONG DEFENSE:**
(Use {user_name}, provide PROOF, be confident, offer verification, defend Margam with facts)
"""
    )
    
    chain = prompt | llm | StrOutputParser()
    response = chain.invoke({
        "question": question, 
        "user_name": user_name,
        "students_helped": MARGAM_STATS['students_helped'],
        "visa_success_rate": MARGAM_STATS['visa_success_rate'],
        "rating": MARGAM_STATS['rating'],
        "phone_primary": MARGAM_CONTACT['phone_primary']
    })
    
    return {"generation": response}


def off_topic_response(state: GraphState):
    """
    Intelligent, thorough general answering in the style of ChatGPT, connecting back to global education.
    """
    log_with_context("debug", "Processing off-topic response")
    question = state["question"]
    user_name = state.get("user_name", "there")
    
    prompt = ChatPromptTemplate.from_template(
        """You are Margam AI, an intelligent, versatile assistant answering in the clear, engaging, and structured explanation style of ChatGPT.

The user asked: "{question}"
User's Name: {user_name}

INSTRUCTIONS:
1. Answer their question thoroughly, accurately, and thoughtfully like ChatGPT with clear explanations and structured formatting.
2. If the topic is entirely unrelated to study abroad (e.g. general tech, history, food, lifestyle), provide a genuinely helpful answer first, and then draw an engaging, creative connection to international education, student culture, or global career opportunities.
3. Keep the tone warm, articulate, and friendly."""
    )
    
    chain = prompt | llm | StrOutputParser()
    response = chain.invoke({"question": question, "user_name": user_name})
    
    return {"generation": response}

