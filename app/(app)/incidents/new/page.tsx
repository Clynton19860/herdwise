import { getAnimals, getGeofences, getOwners } from "@/lib/db";
import { ReportIncidentForm } from "./report-form";

export default async function ReportIncidentPage() {
  const [animals, owners, zones] = await Promise.all([
    getAnimals(), getOwners(), getGeofences(),
  ]);
  return <ReportIncidentForm animals={animals} owners={owners} zones={zones} />;
}
