import os
import shutil
import time
from langchain_community.document_loaders import PyPDFDirectoryLoader, DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

# Configuration
from rag.config import EMBEDDING_MODEL, DB_DIR, CHUNK_SIZE, CHUNK_OVERLAP, GEMINI_API_KEY

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "Data")

def load_documents():
    """Load documents from the docs directory."""
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        print(f"Created {DOCS_DIR} directory. Please parse your documents there.")
        return []
    
    # Load PDFs
    pdf_loader = PyPDFDirectoryLoader(DOCS_DIR)
    pdf_docs = pdf_loader.load()
    
    # Load Text files
    txt_loader = DirectoryLoader(DOCS_DIR, glob="**/*.txt", loader_cls=TextLoader)
    txt_docs = txt_loader.load()
    
    docs = pdf_docs + txt_docs
    print(f"Loaded {len(docs)} documents.")
    return docs

def chunk_documents(docs):
    """Split documents into smaller chunks with optimized strategy."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],  # Better separators for document structure
        add_start_index=True
    )
    chunks = text_splitter.split_documents(docs)
    print(f"Split into {len(chunks)} chunks (size: {CHUNK_SIZE}, overlap: {CHUNK_OVERLAP}).")
    return chunks

def ingest():
    """Main ingestion function."""
    print("Starting ingestion...")
    
    # 1. Load
    docs = load_documents()
    if not docs:
        print("No documents found to ingest.")
        return

    # 2. Split
    chunks = chunk_documents(docs)

    # 3. Embed & Store
    print("Initializing embeddings and ChromaDB...")
    google_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=google_key
    )
    
    # Connect to vectorstore (resuming if already partially populated)
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
    try:
        current_count = vectorstore._collection.count()
    except Exception:
        current_count = 0

    print(f"Current documents in ChromaDB: {current_count}/{len(chunks)}")
    batch_size = 10
    total_batches = (len(chunks) + batch_size - 1) // batch_size
    i = current_count
    while i < len(chunks):
        batch = chunks[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        print(f"Embedding batch {batch_num}/{total_batches} ({len(batch)} chunks)...")
        max_retries = 8
        success = False
        for attempt in range(max_retries):
            try:
                vectorstore.add_documents(batch)
                success = True
                break
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    wait_time = 45
                    print(f"Rate limit reached on batch {batch_num}. Pausing for {wait_time}s before retry (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait_time)
                else:
                    print(f"Error on batch {batch_num}: {e}. Retrying in 15s...")
                    time.sleep(15)
        if not success:
            print(f"Failed to ingest batch {batch_num} after {max_retries} attempts.")
            return
        i += len(batch)
        time.sleep(3)  # Pacing between batches to respect RPM / TPM

    print(f"Ingestion complete! Successfully stored {len(chunks)} chunks in {DB_DIR}")

if __name__ == "__main__":
    ingest()
