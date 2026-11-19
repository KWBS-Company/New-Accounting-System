# 📦 Project Setup

## 📥 Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
```

---

## 📁 Navigate to Backend

```bash
cd backend
```

---

## 🐍 Create Virtual Environment

```bash
python -m venv as-venv
```

---

## ⚡ Activate Virtual Environment

### macOS / Linux

```bash
source ./as-venv/bin/activate
```

### Windows

```bash
as-venv\Scripts\activate
```

---

## 📥 Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Run the Application

```bash
python main.py
```

---

## 📚 API Documentation (Swagger)

Once the server is running, open:

```
http://localhost:3000/docs
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the `backend` directory with the following content:

```env
APP_PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_DATABASE=your_database
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

---

## 🗄️ Database Migrations (Alembic)

### Generate Migration

```bash
alembic revision --autogenerate -m "init"
```

### Apply All Pending Migrations

```bash
alembic upgrade head
```

### Downgrade One Step

```bash
alembic downgrade -1
```

---

## 🧠 Notes

* Always activate the virtual environment before running the app
* Ensure `.env.local` is correctly configured before starting the server
* Run migrations before starting the application if database schema changes
* If you install new packages:

```bash
pip freeze > requirements.txt
```

## 🎙️ Voice Chat

Voice chat (microphone conversation and "Listen" read-aloud) runs entirely inside `ai-nodeapi` using [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Whisper for speech-to-text, Piper for text-to-speech), so no audio leaves your machine and no extra service is needed.

1. Download the models once (about 270 MB, stored in `ai-nodeapi/models`, git-ignored):
   ```bash
   cd ai-nodeapi && npm install && ./scripts/download-models.sh
   ```
2. Run Ollama, `ai-nodeapi` (port 2050) and `nodeapi` as usual, then open the Chat page and click the microphone button. Start `ai-nodeapi` from its own folder, because model paths are relative to the working directory.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PIPER_VOICES` | ai-nodeapi | English only | JSON map of language code to a sherpa Piper voice folder, e.g. `{"en":"models/vits-piper-en_US-lessac-medium","ne":"models/vits-piper-ne_NP-google-medium"}` |
| `WHISPER_DIR` / `WHISPER_NAME` | ai-nodeapi | `models/sherpa-onnx-whisper-base` / `base` | Whisper model folder and file prefix (`tiny`, `base`, `small`...) |

Notes:
- `sherpa-onnx-node` is pinned to `1.13.8`. Version 2.x removed the phonemizer that Piper voices need, so do not upgrade without re-testing TTS.
- A language without a configured voice is answered as text only.
- The browser sends 16 kHz float32 PCM, because Node cannot decode webm/opus. `POST /api/voice/transcribe` accepts `audio/x-pcm-f32;rate=<Hz>` or 16-bit PCM WAV, and returns 415 otherwise.
- The browser needs microphone permission and must be on `localhost` or HTTPS.
