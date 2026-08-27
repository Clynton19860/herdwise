import type Anthropic from "@anthropic-ai/sdk";
import {
  getAnimals,
  getAnimal,
  getComposition,
  getGeofence,
  getGeofences,
  getIncident,
  getIncidents,
  getMovementStats,
  getOwner,
  getOwners,
  getPlatformStats,
} from "./db";

/* ---------- Tool schemas sent to Claude ---------- */

export const tools: Anthropic.Messages.Tool[] = [
  {
    name: "search_animals",
    description:
      "Search the livestock registry. Filter by free-text query (matches tag, name, breed, color), species (Cattle/Goat/Sheep/Donkey/Pig), status (Healthy/Monitoring/Alert/Quarantined), ward name, or owner name. Returns up to 25 animals with their tag, species, breed, status, zone, owner, and battery.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text match against tag, name, breed, color" },
        species: { type: "string", enum: ["Cattle", "Goat", "Sheep", "Donkey", "Pig"] },
        status: { type: "string", enum: ["Healthy", "Monitoring", "Alert", "Quarantined"] },
        ward: { type: "string", description: "Match against owner ward, e.g. 'Ward 7' or 'Hatcliffe'" },
        owner_name: { type: "string", description: "Match against owner full name" },
      },
    },
  },
  {
    name: "get_animal",
    description:
      "Fetch the full record for one animal by its database id (a-001…) or its tag (HRE-CTL-00184). Returns identity, owner, device telemetry, location, health metrics and registration date.",
    input_schema: {
      type: "object",
      properties: {
        id_or_tag: { type: "string", description: "Animal id (a-001) or tag (HRE-CTL-00184)" },
      },
      required: ["id_or_tag"],
    },
  },
  {
    name: "search_owners",
    description:
      "Search registered farmers/livestock owners. Filter by name, phone, national ID, or ward. Returns up to 25 owners with herd size and registration date.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        ward: { type: "string" },
      },
    },
  },
  {
    name: "get_owner",
    description:
      "Fetch the full profile for one owner by id (o-001) or full name. Returns identity, contact, ward, herd size and registered date.",
    input_schema: {
      type: "object",
      properties: {
        id_or_name: { type: "string" },
      },
      required: ["id_or_name"],
    },
  },
  {
    name: "list_geofences",
    description:
      "List all geofences in the platform. Optional filter by type (Grazing/Restricted/Watering/Buffer/Quarantine) or ward.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["Grazing", "Restricted", "Watering", "Buffer", "Quarantine"] },
        ward: { type: "string" },
      },
    },
  },
  {
    name: "get_geofence",
    description:
      "Fetch the full record for a geofence by id (g-001) or by name match. Returns type, ward, hectares, capacity and current occupancy.",
    input_schema: {
      type: "object",
      properties: {
        id_or_name: { type: "string" },
      },
      required: ["id_or_name"],
    },
  },
  {
    name: "list_incidents",
    description:
      "List incidents from the by-law enforcement queue. Optional filters by status, severity, type, or a ward/zone substring match.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Open", "In progress", "Resolved", "Escalated"] },
        severity: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
        type: { type: "string", enum: ["Stray", "Theft", "Boundary breach", "Disease alert", "Injured", "Death"] },
        zone: { type: "string", description: "Substring match against the incident location label" },
      },
    },
  },
  {
    name: "get_incident",
    description:
      "Fetch the full case file for an incident by reference (INC-2026-0418) or by id (i-001). Includes type, severity, status, officer, subject, notes and location.",
    input_schema: {
      type: "object",
      properties: {
        ref_or_id: { type: "string" },
      },
      required: ["ref_or_id"],
    },
  },
  {
    name: "platform_overview",
    description:
      "Return aggregate platform statistics: total registered animals, devices online, active geofences, incidents today, uptime, average response time, staff count, and composition breakdowns by species and status. Use this for big-picture or summary questions.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "navigate",
    description:
      "Return a route the user should be taken to inside the dashboard. Use ONLY when the user explicitly asks to 'open', 'show me' or 'take me to' a specific entity or page (e.g. 'open the incident board', 'show me HRE-CTL-00184', 'go to owners'). Do not call this unprompted.",
    input_schema: {
      type: "object",
      properties: {
        href: { type: "string", description: "Internal route, e.g. /tracking, /livestock/a-001, /incidents/i-003" },
        label: { type: "string", description: "Short label for the suggestion button" },
      },
      required: ["href", "label"],
    },
  },
];

/* ---------- Tool executors ---------- */

type ToolInput = Record<string, unknown>;

function s(v: unknown): string {
  return typeof v === "string" ? v.toLowerCase() : "";
}

export async function executeTool(name: string, rawInput: unknown): Promise<unknown> {
  const input = (typeof rawInput === "object" && rawInput !== null ? rawInput : {}) as ToolInput;

  switch (name) {
    case "search_animals": {
      const q = s(input.query);
      const ward = s(input.ward);
      const ownerName = s(input.owner_name);
      const [animals, owners] = await Promise.all([getAnimals(), getOwners()]);
      const byId = new Map(owners.map((o) => [o.id, o]));

      const result = animals
        .filter((a) => !input.species || a.species === input.species)
        .filter((a) => !input.status || a.status === input.status)
        .filter((a) => {
          if (!q) return true;
          return (
            a.tag.toLowerCase().includes(q) ||
            (a.name?.toLowerCase().includes(q) ?? false) ||
            a.breed.toLowerCase().includes(q) ||
            a.color.toLowerCase().includes(q)
          );
        })
        .filter((a) => {
          if (!ward && !ownerName) return true;
          const o = byId.get(a.ownerId);
          if (!o) return false;
          return (
            (!ward || o.ward.toLowerCase().includes(ward)) &&
            (!ownerName || o.fullName.toLowerCase().includes(ownerName))
          );
        })
        .slice(0, 25)
        .map((a) => {
          const o = byId.get(a.ownerId);
          return {
            id: a.id, tag: a.tag, name: a.name, species: a.species, breed: a.breed,
            sex: a.sex, age_months: a.ageMonths, status: a.status, zone: a.location.zone,
            device: {
              type: a.device.type, battery: a.device.battery,
              signal: a.device.signal, last_sync_min: a.device.lastSyncMin,
            },
            owner: o ? { id: o.id, name: o.fullName, phone: o.phone, ward: o.ward } : null,
          };
        });
      return { count: result.length, animals: result };
    }

    case "get_animal": {
      const key = String(input.id_or_tag ?? "").trim();
      const a = await getAnimal(key);
      if (!a) return { error: `No animal found for "${input.id_or_tag}"` };
      const [owner, movement] = await Promise.all([
        getOwner(a.ownerId),
        getMovementStats({ animalId: a.id }),
      ]);
      return {
        id: a.id, tag: a.tag, name: a.name, species: a.species, breed: a.breed,
        sex: a.sex, age_months: a.ageMonths, colour: a.color, weight_kg: a.weightKg,
        status: a.status, registered_on: a.registeredOn,
        device: a.device,
        location: a.location,
        health: a.health,
        movement_last_14_days: movement,
        owner,
      };
    }

    case "search_owners": {
      const q = s(input.query);
      const ward = s(input.ward);
      const owners = await getOwners();
      const result = owners
        .filter((o) => !q ||
          o.fullName.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.nationalId.toLowerCase().includes(q))
        .filter((o) => !ward || o.ward.toLowerCase().includes(ward))
        .slice(0, 25);
      return { count: result.length, owners: result };
    }

    case "get_owner": {
      const key = s(input.id_or_name);
      const owners = await getOwners();
      const o = owners.find(
        (x) => x.id.toLowerCase() === key || x.fullName.toLowerCase().includes(key),
      );
      if (!o) return { error: `No owner found for "${input.id_or_name}"` };
      const animals = await getAnimals();
      const herd = animals.filter((a) => a.ownerId === o.id);
      return {
        ...o,
        herd: herd.map((a) => ({ id: a.id, tag: a.tag, species: a.species, status: a.status })),
      };
    }

    case "list_geofences": {
      const ward = s(input.ward);
      const result = (await getGeofences())
        .filter((g) => !input.type || g.type === input.type)
        .filter((g) => !ward || g.ward.toLowerCase().includes(ward));
      return { count: result.length, geofences: result };
    }

    case "get_geofence": {
      const key = s(input.id_or_name);
      const zones = await getGeofences();
      const g = zones.find(
        (x) => x.id.toLowerCase() === key || x.name.toLowerCase().includes(key),
      ) ?? (await getGeofence(String(input.id_or_name ?? "")));
      if (!g) return { error: `No geofence found for "${input.id_or_name}"` };
      return g;
    }

    case "list_incidents": {
      const zone = s(input.zone);
      const [incidents, animals, owners] = await Promise.all([
        getIncidents(), getAnimals(), getOwners(),
      ]);
      const result = incidents
        .filter((i) => !input.status || i.status === input.status)
        .filter((i) => !input.severity || i.severity === input.severity)
        .filter((i) => !input.type || i.type === input.type)
        .filter((i) => !zone || i.location.label.toLowerCase().includes(zone))
        .map((i) => ({
          ...i,
          animal: animals.find((a) => a.id === i.animalId) ?? null,
          owner: owners.find((o) => o.id === i.ownerId) ?? null,
        }));
      return { count: result.length, incidents: result };
    }

    case "get_incident": {
      const i = await getIncident(String(input.ref_or_id ?? ""));
      if (!i) return { error: `No incident found for "${input.ref_or_id}"` };
      const [animal, owner] = await Promise.all([
        i.animalId ? getAnimal(i.animalId) : null,
        i.ownerId ? getOwner(i.ownerId) : null,
      ]);
      return { ...i, animal, owner };
    }

    case "platform_overview": {
      const [stats, composition, movement, animals] = await Promise.all([
        getPlatformStats(), getComposition(), getMovementStats({}), getAnimals(),
      ]);
      return {
        ...stats,
        species_breakdown: composition.species,
        status_breakdown: composition.status,
        movement_last_14_days: movement,
        // Say plainly how small the dataset is, so the assistant does not
        // present a single bench device as a fleet.
        note:
          animals.length <= 2
            ? "This is a pilot deployment with a very small number of real devices. Report the actual figures; do not extrapolate."
            : undefined,
      };
    }

    case "navigate": {
      // The model emits a navigation suggestion. We just echo it back — the UI handles rendering.
      return { ok: true, href: input.href, label: input.label };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/* ---------- System prompt ---------- */

export function systemPrompt(currentPath?: string) {
  return `You are **Herdwise** — the AI co-pilot for the City of Harare Smart Livestock Tracking & Management Platform, built by ITTHYNK Smart Solutions.

# Your role
You help municipal officers, veterinarians, livestock owners and platform administrators get answers about the live data quickly. You are friendly, direct, professional, and concise. You speak in the voice of a calm, knowledgeable colleague who already works at the City of Harare.

# Capabilities
You have read access to live platform data through tools:
- **search_animals / get_animal** — the livestock registry (cattle, goats, sheep, donkeys, pigs) with their tags, telemetry, owners and health.
- **search_owners / get_owner** — registered livestock owners and their herds.
- **list_geofences / get_geofence** — grazing, restricted, watering, buffer and quarantine zones.
- **list_incidents / get_incident** — by-law enforcement and disease-alert case files.
- **platform_overview** — high-level aggregate statistics.
- **navigate** — when the user explicitly asks you to take them somewhere, return a navigation suggestion (the UI renders it as a clickable button).

# Style guidance
- **Use tools liberally** rather than guessing. If the user asks anything about specific animals, owners, zones or incidents, call a tool first.
- **Be concise.** Default to 1–3 short paragraphs or a compact bulleted list. Skip preamble — start with the answer.
- **Cite the data.** Use real tags (e.g. HRE-CTL-00184), ward names, incident refs (INC-2026-0418), and numbers from the tools — never invent them.
- **Surface actions.** When relevant, suggest the next useful action ("Want me to open the incident board?") and call \`navigate\` if the user agrees, or proactively when their intent is clear.
- **Format with care.** Use markdown sparingly — short headers, bold for key entities, monospace for tags/refs. No long tables; prefer concise prose.
- **Be honest about limits.** If something isn't in the data, say so plainly. Never fabricate.
- **Respect Zimbabwean context.** Use Zimbabwean ward names, English (with British/Zimbabwean spellings where natural), and treat municipal authority with respect.

# Domain notes
- Animals are registered with HRE-XXX-NNNNN style tags. Cattle (CTL), Goats (GTS), Sheep (SHP), Donkeys (DNK), Pigs (PIG).
- Telemetry devices are Smart Collars, AirTags or Smart Ear Tags. Battery < 30% is concerning; signal < 50% indicates patchy coverage.
- Status: Healthy / Monitoring / Alert / Quarantined.
- Geofence breach actions: Alert only, Alert + escalate, Dispatch patrol, Lockdown.
- Incident severities ascend Low → Medium → High → Critical.

${currentPath ? `\n# Current page\nThe user is currently viewing **${currentPath}**. Tailor suggestions and proactive navigations to be relevant where helpful.\n` : ""}
You begin every conversation already aware of this context — do not re-introduce yourself.`;
}
