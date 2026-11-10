import json
import re
import httpx
from .config import settings

GOOGLE_BASE = "https://places.googleapis.com/v1/places:searchText"

async def interpret_text(text: str, language: str | None = None) -> dict:
    """Extract intent and destination. Optional OpenAI-compatible LLM; deterministic fallback otherwise."""
    if settings.llm_base_url and settings.llm_api_key and settings.llm_model:
        prompt = (
            "Extract a location-search intent from the user's utterance. Return JSON only with keys: "
            "language (gu/en/hi), intent (navigate/search/emergency/unknown), destination "
            "(name, city, landmark, category, description), needs_clarification, clarification_question. "
            "Do not invent coordinates or claim a place exists. Preserve local place names.\nUtterance: " + text
        )
        url = settings.llm_base_url.rstrip("/") + "/chat/completions"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json={
                "model": settings.llm_model,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": prompt}]
            })
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            data["extracted_text"] = text
            data.setdefault("language", language or detect_language(text))
            data.setdefault("intent", "search")
            data.setdefault("destination", {})
            data.setdefault("needs_clarification", True)
            return data

    lang = language or detect_language(text)
    lowered = text.lower()
    intent = "emergency" if any(w in lowered for w in ["help", "emergency", "બચાવો", "મદદ", "मदद"]) else "navigate"
    category = None
    categories = {
        "hospital": ["hospital", "હોસ્પિટલ", "अस्पताल"],
        "pharmacy": ["pharmacy", "medical store", "દવાની", "મેડિકલ", "दवाई", "मेडिकल"],
        "restaurant": ["restaurant", "રેસ્ટોરન્ટ", "रेस्टोरेंट"],
        "school": ["school", "શાળા", "स्कूल"],
    }
    for cat, words in categories.items():
        if any(w in lowered for w in words):
            category = cat
            break
    city = None
    for known in ["Ahmedabad", "અમદાવાદ", "Gandhinagar", "ગાંધીનગર", "Surat", "સુરત", "Vadodara", "વડોદરા"]:
        if known.lower() in lowered:
            city = {"અમદાવાદ": "Ahmedabad", "ગાંધીનગર": "Gandhinagar", "સુરત": "Surat", "વડોદરા": "Vadodara"}.get(known, known)
            break
    # Simple phrase cleanup; this is a fallback, not a replacement for an LLM.
    name = re.sub(r"(?i)\b(find|search|take me to|navigate to|near|in|મને|શોધી આપો|જવું છે|ले चलो|खोजो)\b", " ", text)
    name = re.sub(r"\s+", " ", name).strip(" ,.!?")
    needs = len(name) < 3
    return {
        "language": lang, "intent": intent, "destination": {
            "name": name, "city": city, "landmark": None, "category": category, "description": text
        },
        "needs_clarification": needs,
        "clarification_question": "Please tell me the place name or a nearby landmark." if needs else None,
        "extracted_text": text
    }

def detect_language(text: str) -> str:
    if re.search(r"[\u0A80-\u0AFF]", text): return "gu"
    if re.search(r"[\u0900-\u097F]", text): return "hi"
    return "en"

async def search_places(query: str, location: dict | None = None, radius_m: int = 5000) -> list[dict]:
    if not settings.google_maps_server_key:
        raise RuntimeError("Google server key is not configured. Set GOOGLE_MAPS_SERVER_KEY in backend/.env")
    body: dict = {"textQuery": query, "maxResultCount": 5, "languageCode": "en"}
    if location and isinstance(location.get("lat"), (int, float)) and isinstance(location.get("lng"), (int, float)):
        body["locationBias"] = {"circle": {"center": {"latitude": location["lat"], "longitude": location["lng"]}, "radius": radius_m}}
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": settings.google_maps_server_key,
               "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types"}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(GOOGLE_BASE, headers=headers, json=body)
        if r.is_error:
            detail = r.text[:800]
            raise RuntimeError(f"Google Places error ({r.status_code}): {detail}")
        data = r.json()
    results = []
    for p in data.get("places", []):
        loc = p.get("location", {})
        if "latitude" not in loc or "longitude" not in loc: continue
        results.append({
            "place_id": p.get("id", ""),
            "name": p.get("displayName", {}).get("text", "Unknown place"),
            "address": p.get("formattedAddress", ""),
            "lat": loc["latitude"], "lng": loc["longitude"],
            "rating": p.get("rating"), "types": p.get("types", [])
        })
    return results

async def get_route(origin: dict, destination: dict, travel_mode: str = "DRIVE") -> dict:
    if not settings.google_maps_server_key:
        raise RuntimeError("Google server key is not configured.")
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    body = {
        "origin": {"location": {"latLng": {"latitude": origin["lat"], "longitude": origin["lng"]}}},
        "destination": {"location": {"latLng": {"latitude": destination["lat"], "longitude": destination["lng"]}}},
        "travelMode": travel_mode,
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
        "languageCode": "en"
    }
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": settings.google_maps_server_key,
               "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(url, headers=headers, json=body)
        if r.is_error: raise RuntimeError(f"Google Routes error ({r.status_code}): {r.text[:800]}")
        data = r.json()
    routes = data.get("routes", [])
    if not routes: raise RuntimeError("No route returned for these points.")
    route = routes[0]
    return {"duration": route.get("duration"), "distance_meters": route.get("distanceMeters"),
            "encoded_polyline": route.get("polyline", {}).get("encodedPolyline")}
