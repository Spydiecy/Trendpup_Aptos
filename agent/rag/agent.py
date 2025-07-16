def exit_after_timeout(timeout_seconds=3600):
    def exit_thread():
        print(f"Agent will exit after {timeout_seconds/60:.0f} minutes...")
        time.sleep(timeout_seconds)
        print("Agent exiting after 1 hour.")
        os._exit(0)
    thread = threading.Thread(target=exit_thread, daemon=True)
    thread.start()

exit_after_timeout(3600)
import os
from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root
import vertexai
import threading
import time

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '/home/trendpup/trendpup-aptos'))
load_dotenv(os.path.join(project_root, '.env'))

vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location='us-central1'    
)

def upload_multiple_files_to_corpus(corpus_name, files):
    """Uploads multiple files to the specified corpus."""
    results = []
    for file_info in files:
        path = file_info['path']
        display_name = file_info.get('display_name', os.path.basename(path))
        description = file_info.get('description', '')
        print(f"Uploading {display_name} to corpus...")
        try:
            rag_file = rag.upload_file(
                corpus_name=corpus_name,
                path=path,
                display_name=display_name,
                description=description,
            )
            print(f"Successfully uploaded {display_name} to corpus")
            results.append(rag_file)
        except Exception as e:
            print(f"Error uploading file {display_name}: {e}")
            results.append(None)
    return results

ask_vertex_retrieval = VertexAiRagRetrieval(
    name='retrieve_rag_documentation',
    description=(
        'Use this tool to retrieve documentation and reference materials for the question from the RAG corpus,'
    ),
    rag_resources=[
        rag.RagResource(
            rag_corpus=os.environ.get("RAG_CORPUS")
        )
    ],
    similarity_top_k=10,
    vector_distance_threshold=0.6,
)

root_agent = Agent(
    model='gemini-2.5-flash',
    name='ask_rag_agent',
    instruction=return_instructions_root(),
    tools=[
        ask_vertex_retrieval,
    ]
)

def periodic_upload(corpus_name, files, interval_minutes=10):
    """Periodically uploads files to the corpus every interval_minutes."""
    def upload_loop():
        while True:
            print("Starting periodic upload...")
            upload_multiple_files_to_corpus(corpus_name, files)
            print(f"Waiting {interval_minutes} minutes for next upload...")
            time.sleep(interval_minutes * 60)
    thread = threading.Thread(target=upload_loop, daemon=True)
    thread.start()

files = [
    {"path": "/home/trendpup/trendpup-aptos/backend/ai_analyzer.json"},
    {"path": "/home/trendpup/trendpup-aptos/README.md"}
]
periodic_upload(os.environ.get("RAG_CORPUS"), files)
