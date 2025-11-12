import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FleetDataService {
  // ✅ Correct public path (no "src/")
  private url = 'data/trip-data.json';

  constructor(private http: HttpClient) {}

  getInitialData(): Observable<any> {
    return this.http.get<any>(this.url);
  }
}
