import { Component, OnInit, OnDestroy } from '@angular/core';
import { FleetDataService } from '../services/fleet-data.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

const STORAGE_KEY = 'fleetTrackingState'; // Key for localStorage

@Component({
  selector: 'app-fleet-tracking',
  standalone: true, 
  imports: [CommonModule, FormsModule, DatePipe], 
  templateUrl: './fleet-tracking.html',
  styleUrl: './fleet-tracking.scss',
})
export class FleetTracking implements OnInit, OnDestroy {
  trips: any[] = [];
  events: any[] = [];
  simulationSpeed = 1;
  isPlaying = false;
  
  // Initial time set to the first event in the JSON
  currentTime = new Date('2025-11-03T10:00:00.000Z'); 
  
  private intervalRef: any;
  private allEvents: any[] = [];
  private nextEventIndex = 0;

  constructor(private fleetService: FleetDataService) {}

  ngOnInit(): void {
    // 1. Attempt to load saved state first
    if (!this.loadState()) {
      // 2. If no saved state, load initial data
      this.fleetService.getInitialData().subscribe(data => {
        this.trips = data.trips.map((t: any) => ({ ...t }));
        
        this.allEvents = data.events as any[];
        this.allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        if (this.allEvents.length > 0) {
          this.currentTime = new Date(this.allEvents[0].timestamp);
        }
        
        this.events = [];
        this.nextEventIndex = 0;
        
        // Load initial events up to the start time (first event)
        this.processEventsUpToTime(this.currentTime);
      });
    }
  }

  ngOnDestroy(): void {
    this.stopInterval();
    // Save state one last time when leaving the component
    this.saveState(); 
  }

  // --- STATE PERSISTENCE LOGIC ---
  private saveState() {
    try {
      const state = {
        trips: this.trips,
        events: this.events,
        currentTime: this.currentTime.toISOString(),
        nextEventIndex: this.nextEventIndex,
        allEvents: this.allEvents,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Could not save state to local storage", e);
    }
  }

  private loadState(): boolean {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        
        // Check if all necessary data exists (safety check)
        if (state.trips && state.allEvents) {
          this.trips = state.trips;
          this.events = state.events;
          this.currentTime = new Date(state.currentTime);
          this.nextEventIndex = state.nextEventIndex;
          this.allEvents = state.allEvents;
          return true; // State loaded successfully
        }
      }
      return false; // No state found or incomplete state
    } catch (e) {
      console.error("Could not load state from local storage", e);
      return false;
    }
  }
  
  private clearState() {
     localStorage.removeItem(STORAGE_KEY);
  }
  // -------------------------------


  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) this.startInterval();
    else this.stopInterval();
  }

  startInterval() {
    this.intervalRef = setInterval(() => {
      this.currentTime = new Date(this.currentTime.getTime() + 60000 * this.simulationSpeed);
      this.processEventsUpToTime(this.currentTime);
      
      if (this.nextEventIndex >= this.allEvents.length) {
        this.stopInterval();
        this.isPlaying = false;
      }
      
      // Save state after every step
      this.saveState(); 
    }, 1000); // Update every 1 second
  }

  stopInterval() {
    if (this.intervalRef) { 
      clearInterval(this.intervalRef); 
      this.intervalRef = null; 
      // Save state when paused
      this.saveState(); 
    }
  }

  resetSimulation() {
    this.stopInterval();
    this.clearState(); // Clear stored state on reset
    this.simulationSpeed = 1;
    this.isPlaying = false;
    
    this.fleetService.getInitialData().subscribe(d => {
      this.trips = d.trips.map((t:any) => ({...t}));
      this.events = [];
      this.allEvents = d.events as any[];
      this.allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      this.nextEventIndex = 0;
      if (this.allEvents.length > 0) {
        this.currentTime = new Date(this.allEvents[0].timestamp);
      } else {
        this.currentTime = new Date('2025-11-03T10:00:00.000Z');
      }
      this.processEventsUpToTime(this.currentTime);
      // Save initial state after reset
      this.saveState(); 
    });
  }

  // processEventsUpToTime and applyEvent remain the same...
  // ... (omitted for brevity, assume they are the same as before)
  
  processEventsUpToTime(time: Date) {
    let newEvents: any[] = [];
    
    while (this.nextEventIndex < this.allEvents.length) {
      const ev = this.allEvents[this.nextEventIndex];
      if (new Date(ev.timestamp).getTime() <= time.getTime()) {
        this.applyEvent(ev);
        newEvents.push(ev);
        this.nextEventIndex++;
      } else {
        break;
      }
    }

    if (newEvents.length) {
      this.events = [...this.events, ...newEvents]; 
    }
  }

  applyEvent(ev: any) {
    this.trips = this.trips.map(trip => {
      if (trip.id !== ev.trip_id) return trip;
      const t = { ...trip };
      switch (ev.event_type) {
        case 'trip_started':
          t.status = 'in_progress';
          break;
        case 'location_ping':
        case 'vehicle_telemetry':
          if (ev.distance_travelled_km) {
            t.completedDistance = ev.distance_travelled_km;
            t.progress = +( (ev.distance_travelled_km / t.totalDistance) * 100 ).toFixed(1);
          }
          if (ev.movement?.speed_kmh !== undefined) t.currentSpeed = ev.movement.speed_kmh;
          if (ev.location) t.lastLocation = ev.location;
          if (ev.telemetry?.fuel_level_percent !== undefined) t.fuelLevel = ev.telemetry.fuel_level_percent;
          break;
        case 'vehicle_stopped':
          t.currentSpeed = 0;
          t.alerts = [...(t.alerts||[]), { type: 'info', message: 'Vehicle stopped' }];
          break;
        case 'vehicle_moving':
          t.alerts = (t.alerts || []).filter((a:any) => a.message !== 'Vehicle stopped');
          t.currentSpeed = ev.movement?.speed_kmh || t.currentSpeed;
          break;
        case 'speed_violation':
          t.alerts = [...(t.alerts||[]), { type: 'warning', message: `Speed violation: ${ev.movement?.speed_kmh} km/h (limit ${ev.speed_limit_kmh})` }];
          if (ev.distance_travelled_km) { t.completedDistance = ev.distance_travelled_km; t.progress = +( (ev.distance_travelled_km / t.totalDistance) * 100 ).toFixed(1); }
          break;
        case 'signal_lost':
          t.alerts = [...(t.alerts||[]), { type: 'error', message: 'GPS signal lost' }];
          break;
        case 'signal_recovered':
          t.alerts = (t.alerts || []).filter((a:any) => a.message !== 'GPS signal lost');
          break;
        case 'fuel_level_low':
          t.fuelLevel = ev.fuel_level_percent ?? t.fuelLevel;
          t.alerts = [...(t.alerts||[]), { type: 'warning', message: 'Low fuel level' }];
          break;
        case 'refueling_started':
          t.alerts = [...(t.alerts||[]), { type: 'info', message: 'Refueling in progress' }];
          break;
        case 'refueling_completed':
          t.fuelLevel = ev.fuel_level_after_refuel ?? t.fuelLevel;
          t.alerts = (t.alerts || []).filter((a:any) => !a.message?.toLowerCase().includes('fuel') && a.message !== 'Refueling in progress');
          break;
        case 'device_error':
          t.alerts = [...(t.alerts||[]), { type: 'error', message: `Device error: ${ev.error_type}` }];
          break;
        case 'trip_cancelled':
          t.status = 'cancelled';
          t.completedDistance = ev.distance_completed_km ?? t.completedDistance;
          t.progress = +( ((ev.distance_completed_km ?? t.completedDistance) / t.totalDistance) * 100 ).toFixed(1);
          t.currentSpeed = 0;
          break;
        case 'trip_completed':
          t.status = 'completed';
          t.progress = 100;
          t.completedDistance = ev.total_distance_km ?? t.totalDistance;
          t.currentSpeed = 0;
          t.alerts = []; 
          break;
      }
      return t;
    });
  }
  
  // Helper Functions (getStatusColor, getAlertColor, fleetMetrics) remain the same...
  // ... (omitted for brevity, assume they are the same as before)
  
  getStatusColor(status: string) {
    switch (status) {
      case 'in_progress': return 'bg-blue-600'; 
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'scheduled': return 'bg-yellow-600'; 
      default: return 'bg-gray-500';
    }
  }

  getAlertColor(type: string) {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-800 border-l-red-500';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-l-yellow-500';
      case 'info': return 'bg-blue-100 text-blue-800 border-l-blue-500';
      default: return 'bg-gray-100 text-gray-800 border-l-gray-500';
    }
  }

  get fleetMetrics() {
    const activeTrips = this.trips.filter(t => t.status === 'in_progress');
    const completed = this.trips.filter(t => t.status === 'completed').length;
    const total = this.trips.length;
    
    const avgProgress = activeTrips.length ? Math.round(activeTrips.reduce((a,b) => a + (b.progress||0), 0) / activeTrips.length) : 0;
    const totalAlerts = this.trips.reduce((acc, t) => acc + (t.alerts?.length || 0), 0);
    
    const progressOver50 = activeTrips.filter(t => (t.progress || 0) >= 50).length;
    const progressOver80 = activeTrips.filter(t => (t.progress || 0) >= 80).length;
    
    return { 
        active: activeTrips.length, 
        completed, 
        total, 
        avgProgress, 
        totalAlerts,
        progressOver50,
        progressOver80
    };
  }
}