import sys

from rag_model import data_ingestion, build_retriever, ask


def main():
    
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = input("Enter path to PDF: ").strip()

    print(f"Ingesting '{pdf_path}'...")
    try:
        text = data_ingestion(pdf_path)
    except (FileNotFoundError, ValueError) as e:
        print(f"Failed to ingest PDF: {e}")
        sys.exit(1)

    print("Building vector store (this may take a moment the first time)...")
    try:
        retriever = build_retriever(text)
    except ValueError as e:
        print(f"Failed to build retriever: {e}")
        sys.exit(1)

    print("Ready. Ask questions about the PDF (type 'exit' or 'quit' to stop).\n")

    while True:
        question = input("Q: ").strip()
        if question.lower() in ("exit", "quit"):
            print("Goodbye.")
            break
        if not question:
            continue

        try:
            answer = ask(question, retriever)
        except EnvironmentError as e:
            print(f"Config error: {e}")
            break
        except Exception as e:
            print(f"Error answering question: {e}")
            continue

        print(f"A: {answer}\n")


if __name__ == "__main__":
    main()