/**
 * Coordinate mapping between our stylized 0–100 viewBox coordinates
 * and real-world latitude/longitude inside the City of Harare.
 *
 * The stylized canvas approximates a rectangular slice of greater Harare's
 * peri-urban livestock zone. Coordinates can be mapped both ways so the
 * platform can seamlessly toggle between the stylized presentation and a
 * real OpenStreetMap basemap.
 */

/** Approximate bounding box of the City of Harare municipal footprint. */
export const HARARE_BOUNDS = {
  north: -17.65,
  south: -17.95,
  west: 30.95,
  east: 31.25,
} as const;

export const HARARE_CENTER: [number, number] = [
  (HARARE_BOUNDS.north + HARARE_BOUNDS.south) / 2,
  (HARARE_BOUNDS.east + HARARE_BOUNDS.west) / 2,
];

/** Convert a stylized [x, y] (0–100) into [lat, lng]. */
export function toLatLng(x: number, y: number): [number, number] {
  const lng =
    HARARE_BOUNDS.west + (x / 100) * (HARARE_BOUNDS.east - HARARE_BOUNDS.west);
  // y grows downward in the canvas; lat grows upward (south is smaller)
  const lat =
    HARARE_BOUNDS.north -
    (y / 100) * (HARARE_BOUNDS.north - HARARE_BOUNDS.south);
  return [lat, lng];
}

export function polygonToLatLng(points: [number, number][]) {
  return points.map(([x, y]) => toLatLng(x, y));
}
