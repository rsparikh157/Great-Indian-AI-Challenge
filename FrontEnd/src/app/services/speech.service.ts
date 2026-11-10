import { Injectable } from '@angular/core';

declare global {
  interface Window { SpeechRecognition?: any; webkitSpeechRecognition?: any; }
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  speak(text: string, lang = 'en-IN'): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'gu' ? 'gu-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
  listenOnce(onText: (text: string) => void, onError: (message: string) => void, language = 'en-IN'): boolean {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { onError('Browser speech recognition is unavailable. Use the microphone upload/Gnani integration or type your request.'); return false; }
    const recognition = new Recognition();
    recognition.lang = language; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => onText(event.results[0][0].transcript);
    recognition.onerror = (event: any) => onError(`Speech recognition error: ${event.error}`);
    recognition.start(); return true;
  }
}
