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

/**
 * Inverse of {@link toLatLng}: project a real coordinate back into the stylized
 * 0–100 canvas.
 *
 * The direction of travel matters. Positions are *stored* as lat/lng because
 * that is what a collar reports and what PostGIS can reason about; the canvas is
 * only a presentation space. Anything outside the Harare bounds clamps to the
 * edge rather than drawing off-canvas.
 */
export function toCanvas(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - HARARE_BOUNDS.west) / (HARARE_BOUNDS.east - HARARE_BOUNDS.west)) * 100;
  const y = ((HARARE_BOUNDS.north - lat) / (HARARE_BOUNDS.north - HARARE_BOUNDS.south)) * 100;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

export function polygonToCanvas(points: [number, number][]): [number, number][] {
  return points.map(([lat, lng]) => {
    const { x, y } = toCanvas(lat, lng);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
  });
}

/**
 * Fit a ring to its own bounding box, for a preview thumbnail.
 *
 * {@link toCanvas} projects into a fixed Harare-wide box, which is right for
 * placing things relative to the city and wrong for a preview of one shape. A
 * 0.25 ha paddock is a few hundredths of a degree across against a box spanning
 * a third of one, so every vertex rounds to the same point and the polygon has
 * no area. A shape drawn outside Harare entirely — a bench test in Johannesburg,
 * say — clamps every vertex to the same corner and disappears completely.
 *
 * A thumbnail has no business being geographically located. It answers "what
 * shape is this", so it is normalised to itself: the ring fills the frame
 * whatever its size or where on earth it sits. Aspect ratio is preserved, so a
 * long thin strip still looks like one.
 */
export function polygonToThumbnail(
  points: [number, number][],
  pad = 8,
): [number, number][] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Longitude degrees shrink with latitude; without this a field looks wider
  // than it is. At Harare's latitude the correction is about 5%.
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180) || 1;

  const w = (maxLng - minLng) * lngScale;
  const h = maxLat - minLat;
  const span = Math.max(w, h);

  // A degenerate ring — every point identical — would divide by zero. Draw it
  // as a dot in the middle rather than as nothing.
  if (span === 0) return points.map(() => [50, 50] as [number, number]);

  const inner = 100 - pad * 2;
  const offsetX = (span - w) / 2;
  const offsetY = (span - h) / 2;

  return points.map(([lat, lng]) => {
    const x = pad + ((lng - minLng) * lngScale + offsetX) / span * inner;
    // SVG y grows downward; latitude grows north, so this flips.
    const y = pad + ((maxLat - lat) + offsetY) / span * inner;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
  });
}
