from typing import List, TypedDict, Any
from langchain_core.messages import BaseMessage
from langchain_core.documents import Document

class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        question: User's question
        user_name: User's name for personalization
        generation: LLM generation
        documents: List of retrieved documents
        safe_to_answer: (bool) Whether the grader thinks we have enough info
        conversation_state: Type of message (new_topic, follow_up, acknowledgment)
        discussed_topics: List of topics already covered to prevent repetition
        user_sentiment: Detected user emotion (curious, doubtful, satisfied, confused)
        last_bot_response: Previous bot message to avoid repetition
        user_profile: Dict tracking user preferences (country, field, budget, etc.)
    """
    question: str
    chat_history: List[dict] # [{"role": "user", "content": "..."}, ...]
    user_name: str
    generation: str
    documents: List[Document]
    safe_to_answer: bool
    router_decision: str
    search_intent: dict # {"query": "...", "format": "..."}
    conversation_state: str  # "new_topic", "follow_up", "acknowledgment", "clarification"
    discussed_topics: List[str]  # Track what we've already covered
    user_sentiment: str  # "curious", "doubtful", "satisfied", "confused"
    last_bot_response: str  # Previous bot message
    user_profile: dict  # {"target_country": "", "field_of_study": "", "budget_range": "", "concerns": []}
    web_search_results: List[dict]  # Tavily web search results [{"title": "...", "content": "...", "url": "..."}]
    use_web_search: bool  # User-controlled flag to enable web search for this request
    recommendation_complexity: str  # "simple", "moderate", "complex" - determines if human consultation needed
    needs_clarification: bool  # Whether we need to ask clarifying questions
    intelligent_recommendations: dict  # {"should_ask_questions": bool, "questions": [], "recommendations": [], "complexity": "simple/moderate/complex"}
    is_escalation: bool  # True when PRD guardrail triggers escalation to human counselor
    cta_type: str  # e.g., "book_consultation"
    request_id: str  # Request tracking ID for debugging
    session_id: str  # Session tracking ID for user session
