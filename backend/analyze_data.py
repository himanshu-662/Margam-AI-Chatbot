"""
Analyze data files to extract key information for dynamic prompts
"""
import os
from langchain_community.document_loaders import PyPDFDirectoryLoader, DirectoryLoader, TextLoader

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "Data")

def analyze_data():
    print("=== ANALYZING DATA FILES ===\n")
    
    # Load all documents
    pdf_loader = PyPDFDirectoryLoader(DOCS_DIR)
    pdf_docs = pdf_loader.load()
    
    txt_loader = DirectoryLoader(DOCS_DIR, glob="**/*.txt", loader_cls=TextLoader)
    txt_docs = txt_loader.load()
    
    all_docs = pdf_docs + txt_docs
    
    print(f"Total documents loaded: {len(all_docs)}\n")
    
    # Analyze content
    topics = {
        "UK": 0,
        "Germany": 0,
        "Ireland": 0,
        "France": 0,
        "Visa": 0,
        "Fees": 0,
        "University": 0,
        "Scholarship": 0,
        "Margam": 0,
        "SOP": 0,
        "Interview": 0,
        "Loan": 0,
    }
    
    for doc in all_docs:
        content = doc.page_content.upper()
        for topic in topics:
            if topic.upper() in content:
                topics[topic] += 1
    
    print("=== TOPIC COVERAGE ===")
    for topic, count in sorted(topics.items(), key=lambda x: x[1], reverse=True):
        print(f"{topic}: {count} documents")
    
    # Extract sample content
    print("\n=== SAMPLE CONTENT FROM EACH FILE ===\n")
    seen_sources = set()
    for doc in all_docs[:15]:
        source = os.path.basename(doc.metadata.get("source", "Unknown"))
        if source not in seen_sources:
            seen_sources.add(source)
            print(f"\n--- {source} ---")
            print(doc.page_content[:300].replace('\n', ' ')[:300] + "...")
    
    print(f"\n\nTotal unique sources: {len(seen_sources)}")

if __name__ == "__main__":
    analyze_data()
