import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare global { interface Window { google?: any; } }

@Injectable({ providedIn: 'root' })
export class MapsService {
  private loading?: Promise<void>;
  load(): Promise<void> {
    if (window.google?.maps) return Promise.resolve();
    if (this.loading) return this.loading;
    const key = environment.googleMapsBrowserKey;
    if (!key || key.startsWith('YOUR_')) return Promise.reject(new Error('Add your website-restricted Google Maps browser key in src/environments/environment.ts.'));
    this.loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true; script.defer = true;
      script.onload = () => resolve(); script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load. Check key restrictions and API enablement.'));
      document.head.appendChild(script);
    });
    return this.loading;
  }
  async render(element: HTMLElement, center: {lat:number; lng:number}, destination?: {lat:number; lng:number}): Promise<void> {
    await this.load();
    const map = new window.google.maps.Map(element, { center, zoom: 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
    new window.google.maps.Marker({ map, position: destination || center, title: destination ? 'Selected destination' : 'Your location' });
    if (destination) new window.google.maps.Marker({ map, position: center, title: 'Starting point', icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
  }
}
