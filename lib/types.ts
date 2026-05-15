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
  ageMonths: number;
  weightKg: number;
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
    /** simple x/y coordinates inside our stylized map canvas (0–100) */
    x: number;
    y: number;
    zone: string;
    speedKph: number;
    heading: number;
  };
  health: {
    lastVaccination: string;
    nextVaccination: string;
    heartRateBpm: number;
    temperatureC: number;
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
