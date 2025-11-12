import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, {
  ...appConfig,                   
  providers: [
    ...(appConfig.providers || []),  
    provideHttpClient()              
  ]
})
.catch((err) => console.error(err));
