"""
Configuration file for Margam AI RAG system.
All hardcoded values should be moved here and made configurable.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM Configuration ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-flash-lite-latest")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", LLM_MODEL)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv(
        "GEMINI_FALLBACK_MODELS", 
        "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash"
    ).split(",") if m.strip()
]
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.4"))



EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-mpnet-base-v2")

# --- Retrieval Configuration ---
RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "12"))  
RETRIEVAL_FETCH_K = int(os.getenv("RETRIEVAL_FETCH_K", "40")) 
RETRIEVAL_LAMBDA_MULT = float(os.getenv("RETRIEVAL_LAMBDA_MULT", "0.5"))  

# --- Reranking Configuration (Optional - Improves Relevance) ---
USE_RERANKING = os.getenv("USE_RERANKING", "false").lower() == "true"
RERANK_TOP_K = int(os.getenv("RERANK_TOP_K", "5"))  # Top K docs after reranking
RERANK_PROVIDER = os.getenv("RERANK_PROVIDER", "flashrank")  # "cohere" or "flashrank"
RERANK_MODEL = os.getenv("RERANK_MODEL", "rerank-english-v3.0")  # or "rerank-multilingual-v3.0"
FLASHRANK_MODEL = os.getenv("FLASHRANK_MODEL", "ms-marco-MiniLM-L-12-v2")  

# --- Chunking Configuration ---
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))

# --- Hybrid Search Configuration (Optional) ---
USE_HYBRID_SEARCH = os.getenv("USE_HYBRID_SEARCH", "false").lower() == "true"
HYBRID_ALPHA = float(os.getenv("HYBRID_ALPHA", "0.7"))  # 0=keyword only, 1=semantic only, 0.7=balanced

# --- Web Search Configuration (Tavily API - Optional) ---
USE_WEB_SEARCH = os.getenv("USE_WEB_SEARCH", "false").lower() == "true"  # User-controlled toggle
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_MAX_RESULTS = int(os.getenv("TAVILY_MAX_RESULTS", "3"))  # Limit to avoid context bloat
TAVILY_SEARCH_DEPTH = os.getenv("TAVILY_SEARCH_DEPTH", "advanced")  # "basic" (faster) or "advanced" (more thorough, better quality, uses 2 credits)
TAVILY_CHUNKS_PER_SOURCE = int(os.getenv("TAVILY_CHUNKS_PER_SOURCE", "3"))  # Content chunks per source (1-3, default: 3)
TAVILY_INCLUDE_ANSWER = os.getenv("TAVILY_INCLUDE_ANSWER", "true").lower() == "true"  # Get AI-generated answer summary
TAVILY_TIME_RANGE = os.getenv("TAVILY_TIME_RANGE", "month")  # Filter by time: "day", "week", "month", "year" (default: "month" for recent info)

# --- Context Configuration ---
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "12000"))
MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "8"))

# --- Currency Conversion Rates ---
CURRENCY_RATES = {
    "GBP_TO_INR": float(os.getenv("GBP_TO_INR", "110")),
    "EUR_TO_INR": float(os.getenv("EUR_TO_INR", "93")),
    "USD_TO_INR": float(os.getenv("USD_TO_INR", "83"))
}

# --- Margam Contact Information ---
MARGAM_CONTACT = {
    "phone_primary": os.getenv("MARGAM_PHONE_PRIMARY", "+91 7981804359"),
    "phone_secondary": os.getenv("MARGAM_PHONE_SECONDARY", "+91 83418 80359"),
    "email": os.getenv("MARGAM_EMAIL", "hello@yourmargam.com"),
    "booking_url": os.getenv("MARGAM_BOOKING_URL", "https://calendly.com/yourmargam"),
    "linkedin": os.getenv("MARGAM_LINKEDIN", "https://www.linkedin.com/company/yourmargam/"),
    "instagram": os.getenv("MARGAM_INSTAGRAM", "https://www.instagram.com/yourmargam/"),
    "youtube": os.getenv("MARGAM_YOUTUBE", "https://www.youtube.com/@jeevithrammamidala")
}

# --- Margam Statistics (can be updated via env) ---
MARGAM_STATS = {
    "students_helped": os.getenv("MARGAM_STUDENTS_HELPED", "1,954+"),
    "visa_success_rate": os.getenv("MARGAM_VISA_SUCCESS", "100%"),
    "rating": os.getenv("MARGAM_RATING", "5/5")
}

# --- Database Configuration ---
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")

# --- Response Configuration ---
MAX_RESPONSE_WORDS_SIMPLE = int(os.getenv("MAX_RESPONSE_WORDS_SIMPLE", "100"))
MAX_RESPONSE_WORDS_STANDARD = int(os.getenv("MAX_RESPONSE_WORDS_STANDARD", "200"))
MAX_RESPONSE_WORDS_COMPLEX = int(os.getenv("MAX_RESPONSE_WORDS_COMPLEX", "300"))

