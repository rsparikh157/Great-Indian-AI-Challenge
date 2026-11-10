export interface Destination {
  name: string; city?: string | null; landmark?: string | null;
  category?: string | null; description?: string | null;
}
export interface InterpretResult {
  language: string; intent: 'navigate' | 'search' | 'emergency' | 'unknown';
  destination: Destination; needs_clarification: boolean;
  clarification_question?: string | null; extracted_text: string;
}
export interface PlaceResult {
  place_id: string; name: string; address: string; lat: number; lng: number;
  rating?: number | null; types: string[];
}
export interface RouteResult {
  duration?: string; distance_meters?: number; encoded_polyline?: string;
}
