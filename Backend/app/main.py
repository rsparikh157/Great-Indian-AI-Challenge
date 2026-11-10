from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .schemas import InterpretRequest, RouteRequest
from .services import interpret_text, search_places, get_route
import httpx

app = FastAPI(title=settings.app_name, version="1.0.0")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pata-batao.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}

@app.post("/api/locations/interpret")
async def interpret(req: InterpretRequest):
    try: return await interpret_text(req.text, req.language)
    except Exception as e: raise HTTPException(status_code=502, detail=f"AI interpretation failed: {e}")

@app.get("/api/locations/search")
async def places(q: str, lat: float | None = None, lng: float | None = None):
    if len(q.strip()) < 2: raise HTTPException(status_code=400, detail="Search query must contain at least 2 characters.")
    loc = {"lat": lat, "lng": lng} if lat is not None and lng is not None else None
    try: return {"places": await search_places(q, loc)}
    except Exception as e: raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/routes")
async def route(req: RouteRequest):
    try: return await get_route(req.origin, req.destination, req.travel_mode)
    except Exception as e: raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/speech/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Generic Gnani.ai adapter. Match URL, auth header and multipart field to your account's API contract."""
    if not settings.gnani_transcribe_url or not settings.gnani_api_key:
        raise HTTPException(status_code=501, detail="Gnani.ai is not configured. Set GNANI_TRANSCRIBE_URL and GNANI_API_KEY.")
    raw = await file.read()
    if len(raw) > settings.max_audio_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {settings.max_audio_mb} MB limit.")
    headers = {"Authorization": f"Bearer {settings.gnani_api_key}"}
    files = {settings.gnani_audio_field: (file.filename or "recording.webm", raw, file.content_type or "audio/webm")}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(settings.gnani_transcribe_url, headers=headers, files=files)
            response.raise_for_status()
            data = response.json()
        # Normalize common transcript field names; adjust this mapping to the exact Gnani response.
        transcript = data.get("text") or data.get("transcript") or data.get("transcription")
        if not transcript: raise ValueError("Gnani response did not contain text/transcript/transcription.")
        return {"text": transcript, "provider_response": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Speech provider request failed: {e}")
