from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import re
import pandas as pd

embeddings = OllamaEmbeddings(model="mxbai-embed-large")
db_location = "./chrome_langchain_db"


def make_collection_name(file_path: str) -> str:
    base = os.path.splitext(os.path.basename(file_path))[0]
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", base)
    name = name.strip("_-")
    if len(name) < 3:
        name = name.ljust(3, "_")
    return name[:63]


def load_csv_documents(csv_path: str) -> list[Document]:
    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError(f"CSV file is empty: {csv_path}")

    columns = list(df.columns)

    documents = []
    for i, row in df.iterrows():
        content_parts = []
        for col in columns:
            value = row[col]
            if pd.notna(value):
                content_parts.append(f"{col}: {value}")
        page_content = "\n".join(content_parts)

        metadata = {"source": csv_path, "row_index": i}
        for col in columns:
            value = row[col]
            if pd.notna(value):
                metadata[col] = value if isinstance(value, (str, int, float, bool)) else str(value)

        document = Document(
            page_content=page_content,
            metadata=metadata,
            id=f"csv-{os.path.basename(csv_path)}-{i}"
        )
        documents.append(document)

    return documents


def load_pdf_documents(pdf_path: str) -> list[Document]:
    try:
        loader = PyPDFLoader(pdf_path)
        pages = loader.load()
    except Exception as e:
        raise ValueError(f"Could not read PDF '{pdf_path}': {e}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(pages)

    documents = []
    for i, chunk in enumerate(chunks):
        chunk.metadata["source"] = pdf_path
        chunk.id = f"pdf-{os.path.basename(pdf_path)}-{i}"
        documents.append(chunk)
    return documents

def load_documents(file_path: str) -> list[Document]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        return load_csv_documents(file_path)
    elif ext == ".pdf":
        return load_pdf_documents(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# def get_retriever(file_path: str, k: int = 5):
#     """
#     Builds (or loads, if already indexed) a Chroma vector store for the given
#     file, using a collection name derived from the filename, and returns a retriever.
#     """
#     collection_name = make_collection_name(file_path)
    
#     persist_directory = os.path.join(db_location, collection_name)
#     add_documents = not os.path.exists(persist_directory)

#     vector_store = Chroma(
#         collection_name=collection_name,
#         persist_directory=persist_directory,
#         embedding_function=embeddings
#     )

#     if add_documents:
#         documents = load_documents(file_path)
#         ids = [doc.id for doc in documents]
#         vector_store.add_documents(documents=documents, ids=ids)

#     return vector_store.as_retriever(search_kwargs={"k": k})

def get_retriever(file_path: str, k: int = 5):
    """
    Builds (or loads, if already indexed) a Chroma vector store for the given
    file, using a collection name derived from the filename, and returns a retriever.
    """

    collection_name = make_collection_name(file_path)
    persist_directory = os.path.join(db_location, collection_name)

    vector_store = Chroma(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_function=embeddings
    )

    existing_count = vector_store._collection.count()

    if existing_count == 0:
        documents = load_documents(file_path)
        ids = [doc.id for doc in documents]
        vector_store.add_documents(documents=documents, ids=ids)

    return vector_store.as_retriever(search_kwargs={"k": k})