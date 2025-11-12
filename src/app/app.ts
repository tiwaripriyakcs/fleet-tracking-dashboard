import { Component, signal } from '@angular/core';
import { Route } from 'lucide-angular';
import { FleetTracking } from "./fleet-tracking/fleet-tracking";

@Component({
  selector: 'app-root',
  imports: [FleetTracking],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('fleet-dashboard');
}
