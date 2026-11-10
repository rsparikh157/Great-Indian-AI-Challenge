from typing import Optional, Literal
from pydantic import BaseModel, Field

class InterpretRequest(BaseModel):
    text: str = Field(min_length=2, max_length=1000)
    language: Optional[str] = None
    user_location: Optional[dict] = None  # {lat: number, lng: number}

class Destination(BaseModel):
    name: str = ""
    city: Optional[str] = None
    landmark: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

class InterpretResponse(BaseModel):
    language: str
    intent: Literal["navigate", "search", "emergency", "unknown"]
    destination: Destination
    needs_clarification: bool
    clarification_question: Optional[str] = None
    extracted_text: str

class Place(BaseModel):
    place_id: str
    name: str
    address: str
    lat: float
    lng: float
    rating: Optional[float] = None
    types: list[str] = []

class PlacesResponse(BaseModel):
    places: list[Place]
    source: str = "Google Places API"

class RouteRequest(BaseModel):
    origin: dict
    destination: dict
    travel_mode: str = "DRIVE"
