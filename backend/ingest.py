import os
import shutil
from langchain_community.document_loaders import PyPDFDirectoryLoader, DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# Configuration
from rag.config import EMBEDDING_MODEL, DB_DIR, CHUNK_SIZE, CHUNK_OVERLAP

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
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    
    # Check if DB exists and clear it for clean re-ingestion (optional, but good for dev)
    if os.path.exists(DB_DIR):
        print("Removing existing database for clean ingestion...")
        shutil.rmtree(DB_DIR)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_DIR
    )
    
    print(f"Ingestion complete! Stored in {DB_DIR}")

if __name__ == "__main__":
    ingest()
