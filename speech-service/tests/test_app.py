import app as speech
from fastapi.testclient import TestClient

client = TestClient(speech.app)

def test_health():
    assert client.get("/health").json() == {"status": "ok"}

def test_stt_returns_text_and_language(monkeypatch):
    monkeypatch.setattr(speech, "transcribe_file", lambda path: ("hello world", "en"))
    r = client.post("/stt", files={"file": ("a.webm", b"fake", "audio/webm")})
    assert r.status_code == 200
    assert r.json() == {"text": "hello world", "language": "en"}

def test_tts_returns_wav(monkeypatch):
    monkeypatch.setattr(speech, "synthesize", lambda text, lang: b"RIFFfake")
    r = client.post("/tts", json={"text": "hi", "language": "en"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.content == b"RIFFfake"

def test_tts_unknown_language_is_404():
    r = client.post("/tts", json={"text": "hi", "language": "xx"})
    assert r.status_code == 404
