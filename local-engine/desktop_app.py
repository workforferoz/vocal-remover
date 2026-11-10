import sys
import threading
import time
from pathlib import Path
import uvicorn

# Ensure app package is in path
engine_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(engine_dir))

from app.main import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8524, log_level="warning")

if __name__ == "__main__":
    # 1. Start the unified FastAPI + Static Frontend server in a daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait briefly for loopback socket to open
    time.sleep(0.8)

    # 2. Launch native Windows desktop application window
    try:
        import webview
        window = webview.create_window(
            title="Vocal Remover",
            url="http://127.0.0.1:8524",
            width=1150,
            height=820,
            min_size=(880, 640),
            background_color="#080D18",
        )
        webview.start()
    except Exception as e:
        # Fallback to default browser if native webview has rendering quirk
        import webbrowser
        webbrowser.open("http://127.0.0.1:8524")
        # Keep process alive
        server_thread.join()

