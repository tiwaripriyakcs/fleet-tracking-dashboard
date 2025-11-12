import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, {
  ...appConfig,                   // spread your existing app config
  providers: [
    ...(appConfig.providers || []),  // keep existing providers
    provideHttpClient()              // ✅ add HttpClient provider here
  ]
})
.catch((err) => console.error(err));
