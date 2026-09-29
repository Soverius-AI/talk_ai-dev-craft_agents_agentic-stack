import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
bootstrapApplication(App).catch(console.error);
if ('serviceWorker' in navigator && !location.search.includes('no-sw')) {
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
