from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from vector import get_retriever

file_path = "dl-1.pdf" 
retriever = get_retriever(file_path)

model = OllamaLLM(model="llama3.2")

template = """
You are an expert in answering questions about the uploaded document.

Here are some relevant excerpts: {reviews}

Here is the question to answer: {question}
"""

prompt = ChatPromptTemplate.from_template(template)
chain = prompt| model

while True:
    print("\n\n-------------------------------")
    question = input("Ask your question (q to quit): ")
    print("\n\n")

    if question == "q":
        break

    reviews = retriever.invoke(question)
    result = chain.invoke({"reviews": reviews, "question": question})
    print(result)