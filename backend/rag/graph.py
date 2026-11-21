import os
import logging
from langgraph.graph import END, StateGraph
from .state import GraphState
from .nodes import (
    analyze_intent, route_question, grade_documents, generate_rag_answer, 
    general_greeting, off_topic_response, acknowledgment_response, 
    margam_defense_response, escalation_response, web_search, llm
)

# --- Configuration ---
from .config import (
    DB_DIR, EMBEDDING_MODEL, RETRIEVAL_K, RETRIEVAL_FETCH_K, RETRIEVAL_LAMBDA_MULT,
    USE_RERANKING, RERANK_TOP_K, RERANK_MODEL, RERANK_PROVIDER, FLASHRANK_MODEL
)

# --- Retriever Logic ---
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

logger = logging.getLogger(__name__)

logger.info("Initializing vector store...")
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
if os.path.exists(DB_DIR):
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
    # Enhanced MMR Retriever: Better relevance with more coverage
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": RETRIEVAL_K,  
            "fetch_k": RETRIEVAL_FETCH_K, 
            "lambda_mult": RETRIEVAL_LAMBDA_MULT 
        }
    )
    logger.info(f"Vector store loaded successfully from {DB_DIR}")
else:
    logger.warning(f"ChromaDB not found at {DB_DIR}")
    retriever = None

def rerank_documents(question: str, documents: list, top_k: int = None):
    """
    Rerank documents using either Cohere API (paid) or FlashRank (free, local).
    Falls back to original order if reranking fails or is disabled.
    """
    if not USE_RERANKING or not documents:
        return documents
    
    top_k = top_k or RERANK_TOP_K
    
    # Use FlashRank (FREE, local) by default
    if RERANK_PROVIDER.lower() == "flashrank":
        try:
            from flashrank import Ranker
            ranker = Ranker(model_name=FLASHRANK_MODEL)
            
            # Prepare documents for reranking - create list of dicts with id and text
            passages = []
            for idx, doc in enumerate(documents):
                passages.append({
                    "id": str(idx),
                    "text": doc.page_content[:500]  # FlashRank works better with shorter text
                })
            
            # Rerank
            results = ranker.rank(query=question, passages=passages, top_k=min(top_k, len(documents)))
            
            # Reorder documents based on rerank scores
            reranked_docs = []
            for result in results:
                doc_idx = int(result['id'])
                reranked_docs.append(documents[doc_idx])
            
            logger.debug(f"Reranked {len(reranked_docs)}/{len(documents)} documents using FlashRank")
            return reranked_docs
        
        except ImportError:
            logger.warning("FlashRank not installed. Falling back to original order.")
            return documents
        except Exception as e:
            logger.error(f"FlashRank reranking failed: {e}", exc_info=True)
            return documents
    
    # Use Cohere API (paid, but has free trial)
    elif RERANK_PROVIDER.lower() == "cohere":
        try:
            import cohere
            cohere_api_key = os.getenv("COHERE_API_KEY")
            if not cohere_api_key:
                logger.warning("Reranking disabled: COHERE_API_KEY not found")
                return documents
            
            co = cohere.Client(cohere_api_key)
            
            # Prepare documents for reranking
            doc_texts = [doc.page_content for doc in documents]
            
            # Rerank
            rerank_response = co.rerank(
                model=RERANK_MODEL,
                query=question,
                documents=doc_texts,
                top_n=min(top_k, len(documents))
            )
            
            # Reorder documents based on rerank scores
            reranked_docs = []
            for result in rerank_response.results:
                reranked_docs.append(documents[result.index])
            
            logger.debug(f"Reranked {len(reranked_docs)}/{len(documents)} documents using Cohere API")
            return reranked_docs
        
        except ImportError:
            logger.warning("Cohere not installed. Falling back to original order.")
            return documents
        except Exception as e:
            logger.error(f"Cohere reranking failed: {e}", exc_info=True)
            return documents
    
    else:
        logger.warning(f"Unknown rerank provider: {RERANK_PROVIDER}. Using original order.")
        return documents

def retrieve(state):
    """
    Retrieve documents with error handling and query expansion support.
    """
    from request_context import get_request_context, format_log_message
    context = get_request_context()
    
    context_str = ""
    if context.get("session_id"):
        context_str = f" [Session:{context['session_id']}]"
    if context.get("user_name"):
        context_str += f" [User:{context['user_name'][:20]}]"
    
    logger.debug(f"Retrieving documents{context_str}")
    question = state["question"]
    documents = []
    
    if not retriever:
        logger.warning("Retriever not available. Returning empty documents.")
        return {"documents": [], "question": question}
    
    try:
        # Attempt retrieval
        documents = retriever.invoke(question)
        
        # If no documents found, try with expanded query
        if not documents or len(documents) == 0:
            logger.debug("No documents found with original query. Trying expanded query...")
            # Simple query expansion - add common study abroad terms
            expanded_query = f"{question} study abroad education university visa"
            documents = retriever.invoke(expanded_query)
        
        # Apply reranking if enabled and we have documents
        if USE_RERANKING and documents:
            logger.debug("Applying reranking to retrieved documents")
            documents = rerank_documents(question, documents, RERANK_TOP_K)
        
        from request_context import get_request_context
        context = get_request_context()
        context_str = ""
        if context.get("session_id"):
            context_str = f" [Session:{context['session_id']}]"
        logger.debug(f"Retrieved {len(documents)} documents{context_str}")
        
    except Exception as e:
        from request_context import get_request_context
        context = get_request_context()
        context_str = ""
        if context.get("session_id"):
            context_str = f" [Session:{context['session_id']}]"
        logger.error(f"Retrieval error: {e}{context_str}", exc_info=True)
        # Return empty documents rather than crashing - let generation handle it
        documents = []
    
    return {"documents": documents, "question": question}


# --- Graph Definition ---

workflow = StateGraph(GraphState)

# Define Nodes
workflow.add_node("route_question", route_question)      # Entry point
workflow.add_node("analyze_intent", analyze_intent)      # Intent & sentiment analysis
workflow.add_node("retrieve", retrieve)
workflow.add_node("web_search", web_search)              # Optional web search (Tavily)
workflow.add_node("grade_documents", grade_documents)
workflow.add_node("generate_rag", generate_rag_answer)
workflow.add_node("greeting", general_greeting)
workflow.add_node("off_topic", off_topic_response)
workflow.add_node("acknowledgment", acknowledgment_response)
workflow.add_node("margam_defense", margam_defense_response)
workflow.add_node("escalation", escalation_response)

# Set Entry Point
workflow.set_entry_point("route_question")

# Conditional Router Logic
def route_decision(state):
    return state.get("router_decision", "RAG")

workflow.add_conditional_edges(
    "route_question",
    route_decision,
    {
        "MARGAM_DEFENSE": "margam_defense",
        "ESCALATION": "escalation",
        "RAG": "analyze_intent",
        "FOLLOW_UP": "analyze_intent", 
        "GREETING": "greeting",
        "OFF_TOPIC": "off_topic",
        "ACKNOWLEDGMENT": "acknowledgment"
    }
)

# RAG Flow
workflow.add_edge("analyze_intent", "retrieve")
workflow.add_edge("retrieve", "web_search")  # Always run web_search (it checks if enabled internally)
workflow.add_edge("web_search", "grade_documents")

# Conditional Edge after Grading
def check_safety(state):
    if state.get("safe_to_answer"):
        return "generate"
    else:
        return "refuse"

workflow.add_conditional_edges(
    "grade_documents",
    check_safety,
    {
        "generate": "generate_rag",
        "refuse": "generate_rag"
    }
)

workflow.add_edge("generate_rag", END)
workflow.add_edge("greeting", END)
workflow.add_edge("off_topic", END)
workflow.add_edge("acknowledgment", END)
workflow.add_edge("margam_defense", END)
workflow.add_edge("escalation", END)

# Compile
app = workflow.compile()
