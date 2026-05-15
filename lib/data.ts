import type {
  Animal,
  Geofence,
  Incident,
  Owner,
} from "./types";

export const owners: Owner[] = [
  { id: "o-001", fullName: "Tendai Mhofu", nationalId: "63-1928374-K-12", phone: "+263 77 412 8821", ward: "Ward 7 · Hatcliffe", herdSize: 24, registeredOn: "2024-02-14" },
  { id: "o-002", fullName: "Rumbidzai Chibanda", nationalId: "63-2845671-J-44", phone: "+263 71 558 0102", ward: "Ward 12 · Mabvuku", herdSize: 16, registeredOn: "2024-05-03" },
  { id: "o-003", fullName: "Farai Mutema", nationalId: "63-9182374-A-22", phone: "+263 78 211 9043", ward: "Ward 18 · Kuwadzana", herdSize: 41, registeredOn: "2023-11-22" },
  { id: "o-004", fullName: "Nyasha Kanyongo", nationalId: "63-4029384-B-11", phone: "+263 77 633 4419", ward: "Ward 4 · Borrowdale West", herdSize: 9, registeredOn: "2025-01-18" },
  { id: "o-005", fullName: "Tatenda Sibanda", nationalId: "63-8362847-D-33", phone: "+263 71 087 2231", ward: "Ward 21 · Epworth", herdSize: 33, registeredOn: "2024-08-09" },
  { id: "o-006", fullName: "Chiedza Marufu", nationalId: "63-3829100-Q-55", phone: "+263 78 904 1276", ward: "Ward 9 · Highfield", herdSize: 12, registeredOn: "2025-03-02" },
];

export const animals: Animal[] = [
  { id: "a-001", tag: "HRE-CTL-00184", name: "Mvura", species: "Cattle", breed: "Mashona", sex: "Female", ageMonths: 38, weightKg: 412, color: "Russet", status: "Healthy", ownerId: "o-001",
    device: { type: "Smart Collar", serial: "SC-X204-118", battery: 86, signal: 92, lastSyncMin: 2 },
    location: { x: 28, y: 38, zone: "Hatcliffe Grazing", speedKph: 1.8, heading: 96 },
    health: { lastVaccination: "2026-02-11", nextVaccination: "2026-08-11", heartRateBpm: 64, temperatureC: 38.6 },
    registeredOn: "2024-03-04" },
  { id: "a-002", tag: "HRE-CTL-00185", name: "Ndoro", species: "Cattle", breed: "Brahman", sex: "Male", ageMonths: 52, weightKg: 638, color: "Grey-white", status: "Healthy", ownerId: "o-001",
    device: { type: "Smart Collar", serial: "SC-X204-119", battery: 71, signal: 88, lastSyncMin: 3 },
    location: { x: 31, y: 34, zone: "Hatcliffe Grazing", speedKph: 0.4, heading: 120 },
    health: { lastVaccination: "2026-02-11", nextVaccination: "2026-08-11", heartRateBpm: 58, temperatureC: 38.4 },
    registeredOn: "2024-03-04" },
  { id: "a-003", tag: "HRE-CTL-00231", name: "Nyikadzino", species: "Cattle", breed: "Tuli", sex: "Female", ageMonths: 28, weightKg: 358, color: "Tan", status: "Monitoring", ownerId: "o-002",
    device: { type: "AirTag", serial: "AT-9F-2A11", battery: 48, signal: 64, lastSyncMin: 14 },
    location: { x: 72, y: 56, zone: "Mabvuku Buffer", speedKph: 6.2, heading: 210 },
    health: { lastVaccination: "2025-11-04", nextVaccination: "2026-05-04", heartRateBpm: 82, temperatureC: 39.4 },
    registeredOn: "2024-06-20" },
  { id: "a-004", tag: "HRE-GTS-00412", name: "Tsuro", species: "Goat", breed: "Mashona", sex: "Female", ageMonths: 22, weightKg: 38, color: "Black-white", status: "Alert", ownerId: "o-003",
    device: { type: "Ear Tag", serial: "ET-G-77241", battery: 30, signal: 41, lastSyncMin: 38 },
    location: { x: 84, y: 22, zone: "Kuwadzana Restricted", speedKph: 9.4, heading: 305 },
    health: { lastVaccination: "2025-09-18", nextVaccination: "2026-03-18", heartRateBpm: 110, temperatureC: 39.9 },
    registeredOn: "2024-09-11" },
  { id: "a-005", tag: "HRE-CTL-00267", name: "Sango", species: "Cattle", breed: "Boran", sex: "Male", ageMonths: 60, weightKg: 712, color: "Red", status: "Healthy", ownerId: "o-003",
    device: { type: "Smart Collar", serial: "SC-X204-301", battery: 92, signal: 96, lastSyncMin: 1 },
    location: { x: 22, y: 64, zone: "Kuwadzana Grazing", speedKph: 2.1, heading: 78 },
    health: { lastVaccination: "2026-01-22", nextVaccination: "2026-07-22", heartRateBpm: 56, temperatureC: 38.2 },
    registeredOn: "2023-12-01" },
  { id: "a-006", tag: "HRE-SHP-00118", name: "Nguruve", species: "Sheep", breed: "Dorper", sex: "Female", ageMonths: 19, weightKg: 54, color: "White-black", status: "Healthy", ownerId: "o-004",
    device: { type: "Ear Tag", serial: "ET-S-09122", battery: 64, signal: 78, lastSyncMin: 6 },
    location: { x: 46, y: 72, zone: "Borrowdale Watering", speedKph: 0.8, heading: 12 },
    health: { lastVaccination: "2026-01-04", nextVaccination: "2026-07-04", heartRateBpm: 72, temperatureC: 38.9 },
    registeredOn: "2025-02-09" },
  { id: "a-007", tag: "HRE-CTL-00302", name: "Mvuu", species: "Cattle", breed: "Hereford", sex: "Female", ageMonths: 44, weightKg: 482, color: "Red-white", status: "Quarantined", ownerId: "o-005",
    device: { type: "Smart Collar", serial: "SC-X204-410", battery: 81, signal: 84, lastSyncMin: 2 },
    location: { x: 58, y: 84, zone: "Epworth Quarantine", speedKph: 0.0, heading: 0 },
    health: { lastVaccination: "2026-03-01", nextVaccination: "2026-04-01", heartRateBpm: 88, temperatureC: 40.2 },
    registeredOn: "2024-04-15" },
  { id: "a-008", tag: "HRE-CTL-00318", name: "Chibhakera", species: "Cattle", breed: "Mashona", sex: "Male", ageMonths: 33, weightKg: 528, color: "Black", status: "Healthy", ownerId: "o-005",
    device: { type: "Smart Collar", serial: "SC-X204-411", battery: 77, signal: 91, lastSyncMin: 1 },
    location: { x: 52, y: 78, zone: "Epworth Grazing", speedKph: 1.4, heading: 92 },
    health: { lastVaccination: "2026-02-19", nextVaccination: "2026-08-19", heartRateBpm: 62, temperatureC: 38.5 },
    registeredOn: "2024-06-30" },
  { id: "a-009", tag: "HRE-DNK-00012", name: "Mhuru", species: "Donkey", breed: "Local", sex: "Male", ageMonths: 72, weightKg: 220, color: "Grey", status: "Healthy", ownerId: "o-006",
    device: { type: "AirTag", serial: "AT-9F-3D08", battery: 58, signal: 70, lastSyncMin: 7 },
    location: { x: 38, y: 54, zone: "Highfield Grazing", speedKph: 1.2, heading: 145 },
    health: { lastVaccination: "2025-12-12", nextVaccination: "2026-06-12", heartRateBpm: 50, temperatureC: 37.8 },
    registeredOn: "2024-07-22" },
  { id: "a-010", tag: "HRE-CTL-00355", name: "Dzimba", species: "Cattle", breed: "Nguni", sex: "Female", ageMonths: 27, weightKg: 372, color: "Mottled", status: "Monitoring", ownerId: "o-002",
    device: { type: "Smart Collar", serial: "SC-X204-512", battery: 22, signal: 55, lastSyncMin: 19 },
    location: { x: 76, y: 50, zone: "Mabvuku Grazing", speedKph: 0.6, heading: 200 },
    health: { lastVaccination: "2025-10-08", nextVaccination: "2026-04-08", heartRateBpm: 76, temperatureC: 39.2 },
    registeredOn: "2024-10-30" },
  { id: "a-011", tag: "HRE-CTL-00374", name: "Pfuma", species: "Cattle", breed: "Mashona", sex: "Female", ageMonths: 41, weightKg: 408, color: "Russet", status: "Healthy", ownerId: "o-001",
    device: { type: "Smart Collar", serial: "SC-X204-118", battery: 74, signal: 81, lastSyncMin: 4 },
    location: { x: 26, y: 42, zone: "Hatcliffe Grazing", speedKph: 1.0, heading: 60 },
    health: { lastVaccination: "2026-02-11", nextVaccination: "2026-08-11", heartRateBpm: 60, temperatureC: 38.3 },
    registeredOn: "2024-03-04" },
  { id: "a-012", tag: "HRE-GTS-00501", name: "Tsoka", species: "Goat", breed: "Boer", sex: "Male", ageMonths: 14, weightKg: 42, color: "White", status: "Healthy", ownerId: "o-006",
    device: { type: "Ear Tag", serial: "ET-G-77242", battery: 66, signal: 72, lastSyncMin: 5 },
    location: { x: 40, y: 50, zone: "Highfield Grazing", speedKph: 1.6, heading: 30 },
    health: { lastVaccination: "2026-01-15", nextVaccination: "2026-07-15", heartRateBpm: 88, temperatureC: 39.0 },
    registeredOn: "2025-04-11" },
];

export const geofences: Geofence[] = [
  { id: "g-001", name: "Hatcliffe Grazing", type: "Grazing", ward: "Ward 7", hectares: 142, capacity: 80, occupancy: 63,
    polygon: [[18,28],[36,26],[42,42],[34,50],[18,46]] },
  { id: "g-002", name: "Mabvuku Buffer", type: "Buffer", ward: "Ward 12", hectares: 88, capacity: 50, occupancy: 22,
    polygon: [[64,48],[82,46],[86,62],[70,66]] },
  { id: "g-003", name: "Kuwadzana Restricted", type: "Restricted", ward: "Ward 18", hectares: 64, capacity: 0, occupancy: 4,
    polygon: [[78,14],[92,18],[92,30],[80,32]] },
  { id: "g-004", name: "Borrowdale Watering", type: "Watering", ward: "Ward 4", hectares: 22, capacity: 30, occupancy: 18,
    polygon: [[42,66],[52,66],[54,78],[42,78]] },
  { id: "g-005", name: "Epworth Quarantine", type: "Quarantine", ward: "Ward 21", hectares: 38, capacity: 25, occupancy: 9,
    polygon: [[54,80],[64,80],[64,92],[52,92]] },
  { id: "g-006", name: "Kuwadzana Grazing", type: "Grazing", ward: "Ward 18", hectares: 178, capacity: 100, occupancy: 71,
    polygon: [[14,58],[30,58],[34,72],[18,76]] },
  { id: "g-007", name: "Highfield Grazing", type: "Grazing", ward: "Ward 9", hectares: 96, capacity: 60, occupancy: 38,
    polygon: [[34,48],[46,46],[48,58],[34,58]] },
];

export const incidents: Incident[] = [
  { id: "i-001", ref: "INC-2026-0418", type: "Boundary breach", severity: "High", status: "In progress",
    animalId: "a-004", ownerId: "o-003", reportedAt: "2026-05-15T08:14:00Z",
    location: { x: 84, y: 22, label: "Kuwadzana Restricted Zone" }, officer: "Insp. T. Moyo",
    notes: "Goat tagged HRE-GTS-00412 entered restricted municipal park boundary; owner contacted." },
  { id: "i-002", ref: "INC-2026-0417", type: "Stray", severity: "Medium", status: "Open",
    animalId: "a-010", ownerId: "o-002", reportedAt: "2026-05-15T06:42:00Z",
    location: { x: 76, y: 50, label: "Mabvuku Outer Ring" }, officer: "Unassigned",
    notes: "Stationary signal in unauthorized area for 4h; geo-fence overlap minimal." },
  { id: "i-003", ref: "INC-2026-0414", type: "Disease alert", severity: "Critical", status: "Escalated",
    animalId: "a-007", ownerId: "o-005", reportedAt: "2026-05-14T19:08:00Z",
    location: { x: 58, y: 84, label: "Epworth Quarantine" }, officer: "Dr. R. Chivasa",
    notes: "Elevated temperature (40.2°C) and elevated heart rate triggered AI anomaly model." },
  { id: "i-004", ref: "INC-2026-0411", type: "Theft", severity: "High", status: "Resolved",
    animalId: "a-005", ownerId: "o-003", reportedAt: "2026-05-12T22:31:00Z",
    location: { x: 22, y: 64, label: "Kuwadzana Grazing" }, officer: "Sgt. P. Ncube",
    notes: "Recovered after tracker signal re-acquired 6.2km away; suspect detained." },
  { id: "i-005", ref: "INC-2026-0410", type: "Injured", severity: "Medium", status: "Resolved",
    animalId: "a-003", ownerId: "o-002", reportedAt: "2026-05-11T11:02:00Z",
    location: { x: 72, y: 56, label: "Mabvuku Buffer" }, officer: "Dr. R. Chivasa",
    notes: "Minor laceration treated on-site, returned to herd." },
  { id: "i-006", ref: "INC-2026-0405", type: "Stray", severity: "Low", status: "Resolved",
    animalId: "a-009", ownerId: "o-006", reportedAt: "2026-05-09T16:55:00Z",
    location: { x: 38, y: 54, label: "Highfield Grazing" }, officer: "Insp. T. Moyo",
    notes: "Donkey wandered into roadway; redirected and owner notified by SMS." },
];

/** Aggregates for the dashboard hero numbers */
export const platformStats = {
  registered: 12_846,
  liveDevices: 11_402,
  geofencesActive: 38,
  incidentsToday: 14,
  resolvedThisWeek: 86,
  averageResponseMin: 22,
  uptime: 99.96,
  staff: 142,
};

/** 7-day spark series, generated for predictable visuals */
export const trendSeries = {
  movement:        [44, 52, 41, 58, 49, 62, 71],
  incidents:       [12, 9, 14, 8, 11, 7, 14],
  healthAnomalies: [3, 5, 4, 2, 6, 3, 4],
  registrations:   [18, 22, 19, 27, 24, 29, 33],
};

/** Activity ticker — recent events used across the app */
export const recentActivity = [
  { id: 1, when: "2m ago", text: "Smart collar SC-X204-118 reported new position", tone: "veld" as const },
  { id: 2, when: "6m ago", text: "Geofence breach alert resolved by Insp. T. Moyo", tone: "amber" as const },
  { id: 3, when: "14m ago", text: "New owner registered: Chiedza Marufu, Ward 9", tone: "violet" as const },
  { id: 4, when: "22m ago", text: "AI anomaly model flagged HRE-CTL-00302 (temp ↑)", tone: "coral" as const },
  { id: 5, when: "31m ago", text: "Vaccination scheduled for 14 animals in Ward 18", tone: "cyan" as const },
  { id: 6, when: "44m ago", text: "Patrol unit dispatched to Kuwadzana Restricted", tone: "amber" as const },
  { id: 7, when: "1h ago", text: "Daily herd report delivered to 142 farmers", tone: "veld" as const },
];

export function findOwner(id: string) {
  return owners.find((o) => o.id === id);
}
export function findAnimal(id: string) {
  return animals.find((a) => a.id === id);
}
