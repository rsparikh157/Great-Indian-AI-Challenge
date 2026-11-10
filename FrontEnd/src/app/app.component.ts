import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './services/api.service';
import { SpeechService } from './services/speech.service';
import { MapsService } from './services/maps.service';
import { InterpretResult, PlaceResult, RouteResult } from './models/location.models';

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule, HttpClientModule], templateUrl: './app.component.html' })
export class AppComponent {
  private api = inject(ApiService); private speech = inject(SpeechService); private maps = inject(MapsService);
  @ViewChild('mapElement') mapElement?: ElementRef<HTMLDivElement>;
  query = signal(''); language = signal('auto'); busy = signal(false); listening = signal(false);
  error = signal(''); transcript = signal(''); interpretation = signal<InterpretResult | null>(null);
  places = signal<PlaceResult[]>([]); selected = signal<PlaceResult | null>(null);
  route = signal<RouteResult | null>(null); currentPosition = signal<{lat:number;lng:number} | null>(null);
  status = signal('Ready when you are'); accessible = signal(false); emergencyMessage = signal('');

  async locateMe(): Promise<void> {
    if (!navigator.geolocation) { this.error.set('Geolocation is not supported by this browser.'); return; }
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(p => {
      this.currentPosition.set({ lat: p.coords.latitude, lng: p.coords.longitude });
      this.status.set('Your current location is available.');
      this.refreshMap(); resolve();
    }, e => { this.error.set(`Location permission/error: ${e.message}`); resolve(); }, { enableHighAccuracy: true, timeout: 10000 }));
  }
  async startGnaniVoice(): Promise<void> {
    this.error.set('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { this.error.set('Audio recording is not supported in this browser.'); return; }
    try {
      this.listening.set(true); this.status.set('Recording audio for speech recognition…');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { stream.getTracks().forEach(t => t.stop()); this.listening.set(false); this.error.set('Audio recording failed.'); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const result = await firstValueFrom(this.api.transcribe(blob));
          this.query.set(result.text); this.transcript.set(result.text); this.listening.set(false);
          await this.findDestination();
        } catch (e: any) { this.listening.set(false); this.error.set(e?.error?.detail || e?.message || 'Gnani transcription failed. Check the configured API contract.'); }
      };
      recorder.start();
      window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 6000);
    } catch (e: any) { this.listening.set(false); this.error.set(`Microphone access failed: ${e.message}`); }
  }
  startVoice(): void {
    this.error.set(''); this.listening.set(true); this.status.set('Listening… speak naturally.');
    const lang = this.language() === 'auto' ? 'en-IN' : this.language() === 'gu' ? 'gu-IN' : 'hi-IN';
    const started = this.speech.listenOnce(text => { this.listening.set(false); this.query.set(text); this.transcript.set(text); void this.findDestination(); }, msg => { this.listening.set(false); this.error.set(msg); this.status.set('Try typing your destination.'); }, lang);
    if (!started) this.listening.set(false);
  }
  async findDestination(): Promise<void> {
    const text = this.query().trim(); if (text.length < 2) { this.error.set('Please speak or type a destination.'); return; }
    this.busy.set(true); this.error.set(''); this.places.set([]); this.selected.set(null); this.route.set(null);
    try {
      const interpreted = await firstValueFrom(this.api.interpret(text, this.language() === 'auto' ? undefined : this.language()));
      this.interpretation.set(interpreted);
      const d = interpreted.destination;
      const searchQuery = [d.name, d.category, d.landmark, d.city].filter(Boolean).join(' ');
      if (!searchQuery.trim()) throw new Error(interpreted.clarification_question || 'I could not identify a destination. Please add a place name or landmark.');
      const result = await firstValueFrom(this.api.searchPlaces(searchQuery, this.currentPosition() || undefined, interpreted.language));
      this.places.set(result.places);
      if (!result.places.length) throw new Error('No matching places found. Try adding a city or nearby landmark.');
      this.status.set(`Found ${result.places.length} possible destination(s). Select the correct one.`);
      this.speech.speak(`I found ${result.places.length} possible destinations. Please select the correct place.`, interpreted.language);
    } catch (e: any) { this.error.set(e?.error?.detail || e?.message || 'Search failed.'); this.status.set('Please try again.'); }
    finally { this.busy.set(false); }
  }
  async choosePlace(place: PlaceResult): Promise<void> {
    this.selected.set(place); this.status.set(`Selected ${place.name}.`); this.speech.speak(`You selected ${place.name}. ${place.address}`, this.interpretation()?.language || 'en');
    await this.refreshMap();
  }
  async refreshMap(): Promise<void> {
    setTimeout(async () => {
      if (!this.mapElement?.nativeElement) return;
      const center = this.currentPosition() || (this.selected() ? { lat: this.selected()!.lat, lng: this.selected()!.lng } : { lat: 23.0225, lng: 72.5714 });
      try { await this.maps.render(this.mapElement.nativeElement, center, this.selected() ? {lat:this.selected()!.lat,lng:this.selected()!.lng} : undefined); }
      catch (e: any) { this.error.set(e.message); }
    }, 0);
  }
  async startNavigation(): Promise<void> {
    const place = this.selected(); if (!place) return;
    if (!this.currentPosition()) await this.locateMe();
    const origin = this.currentPosition();
    if (!origin) { this.error.set('Allow location access to calculate a route. You can still open the destination in Google Maps.'); return; }
    this.busy.set(true);
    try { this.route.set(await firstValueFrom(this.api.getRoute(origin, {lat:place.lat,lng:place.lng}))); this.status.set('Route calculated.'); }
    catch (e:any) { this.error.set(e?.error?.detail || e.message || 'Could not calculate route.'); }
    finally { this.busy.set(false); }
  }
  openGoogleMaps(): void {
    const p = this.selected(); if (!p) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&destination_place_id=${encodeURIComponent(p.place_id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  async shareEmergency(): Promise<void> {
    this.emergencyMessage.set('');
    if (!this.currentPosition()) await this.locateMe();
    const p = this.currentPosition(); if (!p) { this.error.set('Current location unavailable. Please enable location permission.'); return; }
    const url = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
    const text = `I may need help. My current location: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'PataBatao emergency location', text, url }); this.emergencyMessage.set('Location share sheet opened.'); }
      catch { this.emergencyMessage.set('Sharing cancelled or unavailable.'); }
    } else {
      await navigator.clipboard.writeText(text); this.emergencyMessage.set('Location message copied. Send it to your emergency contact.');
    }
  }
  speakStatus(): void { this.speech.speak(this.selected() ? `${this.selected()!.name}. ${this.selected()!.address}` : this.status(), this.interpretation()?.language || 'en'); }
  reset(): void { this.query.set(''); this.transcript.set(''); this.interpretation.set(null); this.places.set([]); this.selected.set(null); this.route.set(null); this.error.set(''); this.status.set('Ready when you are'); }
}
