import os
import io

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq

load_dotenv()

_TESSERACT_CMD = os.getenv("TESSERACT_CMD")
if _TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = _TESSERACT_CMD

_embeddings = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings()
    return _embeddings


def data_ingestion(pdf_path: str) -> str:
    """
    Extract text from a PDF. Tries native text extraction first (fast,
    accurate for text-based PDFs) and only falls back to OCR per-page
    for pages that come back empty (e.g. scanned pages/images).
    """
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    text_parts = []

    try:
        for page in doc:
            page_text = page.get_text().strip()

            if page_text:
                text_parts.append(page_text)
                continue

            # No extractable text layer -> OCR this page.
            pix = page.get_pixmap()
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))
            ocr_text = pytesseract.image_to_string(image).strip()
            if ocr_text:
                text_parts.append(ocr_text)
    finally:
        doc.close()

    full_text = "\n\n".join(text_parts)

    if not full_text.strip():
        raise ValueError(
            "No text could be extracted from the PDF (native or OCR)."
        )

    return full_text


def build_retriever(text: str, k: int = 3):
    """
    Split text into chunks, embed them, and return a FAISS retriever.
    """
    if not text or not text.strip():
        raise ValueError("Cannot build a retriever from empty text.")

    embeddings = get_embeddings()

    # 100 chars is too small for RAG chunks -- it fragments sentences and
    # hurts retrieval quality. 500-1000 with some overlap is a much more
    # reasonable default.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
    )
    chunks = splitter.create_documents([text])

    if not chunks:
        raise ValueError("Text splitting produced no chunks.")

    vector_store = FAISS.from_documents(chunks, embeddings)

    retriever = vector_store.as_retriever(
        search_kwargs={"k": k},
        search_type="similarity",
    )

    return retriever


_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""You are answering a question using only the context below,
which was extracted from a PDF document. If the answer is not contained in
the context, say you don't know instead of guessing.

Context:
{context}

Question: {question}

Answer:""",
)

_llm_client = None


def get_llm():
    global _llm_client
    if _llm_client is None:
        if not os.getenv("GROQ_API_KEY"):
            raise EnvironmentError(
                "GROQ_API_KEY is not set. Add it to your .env file."
            )
        _llm_client = ChatGroq(model="llama-3.1-8b-instant")
    return _llm_client


def ask(question: str, retriever) -> str:
    """
    Retrieve relevant chunks for `question` and ask the LLM to answer
    using only that context.
    """
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")

    retrieved_docs = retriever.invoke(question)
    context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)

    final_prompt = _PROMPT.invoke({"context": context_text, "question": question})

    client = get_llm()
    response = client.invoke(final_prompt)

    return response.content