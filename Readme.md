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

Voice chat (microphone conversation and "Listen" read-aloud) uses a local speech service, so no audio leaves your machine.

1. Build and run the speech service (Whisper STT + Piper TTS):
   ```bash
   docker build -t speech-service ./speech-service
   docker run -p 2060:2060 speech-service
   ```
   The first speech-to-text request downloads the Whisper model, so it is slow once.
2. Run Ollama, `ai-nodeapi` (port 2050) and `nodeapi` as usual, then open the Chat page and click the microphone button.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `SPEECH_SERVICE_URL` | ai-nodeapi | `http://localhost:2060` | Speech service address |
| `PIPER_VOICES` | speech-service | English only | JSON map of language code to Piper voice file, e.g. `{"en":"voices/en_US-lessac-medium.onnx","ne":"voices/ne_NP-google-medium.onnx"}` (download extra voices into the image's `voices/` folder) |
| `WHISPER_MODEL` | speech-service | `small` | faster-whisper model size |

A language without a configured voice is answered as text only. The browser needs microphone permission and must be on `localhost` or HTTPS.
