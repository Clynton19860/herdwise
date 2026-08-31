export type Species = "Cattle" | "Goat" | "Sheep" | "Donkey" | "Pig";
export type Sex = "Male" | "Female";
export type AnimalStatus = "Healthy" | "Monitoring" | "Alert" | "Quarantined";
export type DeviceType = "AirTag" | "Smart Collar" | "Ear Tag";

export type Owner = {
  id: string;
  fullName: string;
  nationalId: string;
  phone: string;
  ward: string;
  herdSize: number;
  registeredOn: string;
};

export type Animal = {
  id: string;
  tag: string;
  name?: string;
  species: Species;
  breed: string;
  sex: Sex;
  /** Null when unrecorded — an unknown age is not an age of zero. */
  ageMonths: number | null;
  weightKg: number | null;
  color: string;
  status: AnimalStatus;
  ownerId: string;
  device: {
    type: DeviceType;
    serial: string;
    battery: number;
    signal: number;
    lastSyncMin: number;
  };
  location: {
    /**
     * Projected x/y inside the stylized map canvas (0–100). The stored value is
     * real lat/lng in PostGIS; this is a presentation projection applied in
     * lib/db.ts via lib/geo.ts.
     */
    x: number;
    y: number;
    zone: string;
    speedKph: number;
    heading: number;
  };
  health: {
    lastVaccination: string;
    nextVaccination: string;
    /**
     * Null on HCS048 hardware, which has GPS and an accelerometer but no
     * heart-rate or temperature sensor. Populated only by Phase 2 smart
     * collars — the UI shows a dash rather than inventing a reading.
     */
    heartRateBpm: number | null;
    temperatureC: number | null;
  };
  registeredOn: string;
};

export type IncidentType =
  | "Stray"
  | "Theft"
  | "Boundary breach"
  | "Disease alert"
  | "Injured"
  | "Death";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "In progress" | "Resolved" | "Escalated";

export type Incident = {
  id: string;
  ref: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  animalId?: string;
  ownerId?: string;
  reportedAt: string;
  location: { x: number; y: number; label: string };
  officer: string;
  notes: string;
};

export type GeoZoneType =
  | "Grazing"
  | "Restricted"
  | "Watering"
  | "Buffer"
  | "Quarantine";

export type Geofence = {
  id: string;
  name: string;
  type: GeoZoneType;
  ward: string;
  /** Polygon points inside our stylized map (0–100) */
  polygon: [number, number][];
  hectares: number;
  capacity: number;
  occupancy: number;
};
