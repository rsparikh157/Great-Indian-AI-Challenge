import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { InterpretResult, PlaceResult, RouteResult } from '../models/location.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;
  interpret(text: string, language?: string): Observable<InterpretResult> {
    return this.http.post<InterpretResult>(`${this.base}/api/locations/interpret`, { text, language });
  }
 searchPlaces(
  query: string,
  position?: { lat: number; lng: number },
  language: string = 'en'
): Observable<{ places: PlaceResult[] }> {

  let params = new HttpParams()
    .set('q', query)
    .set('language', language);

  if (position) {
    params = params
      .set('lat', position.lat)
      .set('lng', position.lng);
  }

  return this.http.get<{ places: PlaceResult[] }>(
    `${this.base}/api/locations/search`,
    { params }
  );
}
  getRoute(origin: {lat:number; lng:number}, destination: {lat:number; lng:number}): Observable<RouteResult> {
    return this.http.post<RouteResult>(`${this.base}/api/routes`, { origin, destination, travel_mode: 'DRIVE' });
  }
  transcribe(blob: Blob): Observable<{text:string}> {
    const form = new FormData(); form.append('file', blob, 'recording.webm');
    return this.http.post<{text:string}>(`${this.base}/api/speech/transcribe`, form);
  }
}
