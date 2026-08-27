import { getOwners } from "@/lib/db";
import { RegisterAnimalForm } from "./register-form";

/**
 * The wizard is a client component, so the owner list it picks from has to be
 * fetched here and handed down rather than imported.
 */
export default async function RegisterAnimalPage() {
  const owners = await getOwners();
  return <RegisterAnimalForm owners={owners} />;
}
