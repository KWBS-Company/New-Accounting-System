import io
import json
import os
import tempfile
import wave
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI()

# language code -> path to a Piper .onnx voice. Extend via env, e.g.
# PIPER_VOICES='{"en":"voices/en_US-lessac-medium.onnx","ne":"voices/ne_NP-google-medium.onnx"}'
VOICES: dict[str, str] = json.loads(
    os.environ.get("PIPER_VOICES", '{"en": "voices/en_US-lessac-medium.onnx"}')
)


@lru_cache(maxsize=1)
def _whisper():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8"
    )


@lru_cache(maxsize=None)
def _voice(lang: str):
    from piper import PiperVoice

    return PiperVoice.load(VOICES[lang])


def transcribe_file(path: str) -> tuple[str, str]:
    segments, info = _whisper().transcribe(path, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip(), info.language


def synthesize(text: str, lang: str) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        _voice(lang).synthesize_wav(text, wav)
    return buf.getvalue()


class TtsRequest(BaseModel):
    text: str
    language: str = "en"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        text, language = transcribe_file(path)
    finally:
        os.unlink(path)
    return {"text": text, "language": language}


@app.post("/tts")
def tts(req: TtsRequest):
    lang = req.language.split("-")[0].lower()
    if lang not in VOICES:
        raise HTTPException(status_code=404, detail=f"no voice for {lang}")
    return Response(content=synthesize(req.text, lang), media_type="audio/wav")
