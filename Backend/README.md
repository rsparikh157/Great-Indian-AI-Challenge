# PataBatao FastAPI backend

## Run locally

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows; use cp on macOS/Linux
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs and http://localhost:8000/health.

## Required Google APIs
Enable **Places API (New)** for `/api/locations/search` and **Routes API** for `/api/routes`. Enable Maps JavaScript API in the browser project for map rendering. Geocoding API is optional for this starter because Places Text Search supplies formatted addresses and coordinates.

Set `GOOGLE_MAPS_SERVER_KEY` in `.env`. Restrict this key to the required APIs and keep it server-side. Use a separate website-restricted key in Angular for Maps JavaScript API.

## Optional AI
Set `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` to an OpenAI-compatible `/chat/completions` service. `LLM_BASE_URL` is the base URL (for example, `https://api.example.com/v1`), not the full `/chat/completions` URL. If unset, a deterministic extraction fallback is used; it is intentionally basic and should not be presented as an LLM.

## Gnani.ai
The `/api/speech/transcribe` endpoint is a generic adapter. Gnani.ai account-specific URL, authentication scheme, multipart field, accepted audio formats and response JSON vary by product/account. Configure the exact values from your Gnani.ai API documentation. This starter uses Bearer authentication and a configurable multipart field; change `main.py` if your contract differs. The UI also supports browser speech recognition as a fallback where available.
