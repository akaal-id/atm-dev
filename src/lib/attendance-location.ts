/** Shared (client + server) attendance location helpers. */

export type WorkMode = "WFO" | "WFH" | "Off-site";
export type BaseLocation = { lat: number; lng: number };
export type BaseKind = "office" | "home";

export const HOME_RADIUS_M = 500;
/** An Off-site permit must be requested at least this long before clock-in, and approved. */
export const OFFSITE_PERMIT_LEAD_HOURS = 6;

/** Company office (Skyconnection, Ragunan). Settings keys `office_lat` / `office_lng` / `office_label` override it. */
export const DEFAULT_OFFICE = {
  lat: -6.2908419,
  lng: 106.8220527,
  label: "Skyconnection, Jl. Gotong Royong I No.50, Ragunan, Pasar Minggu, Jakarta Selatan",
};

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: BaseLocation, b: BaseLocation) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export const workModeTone: Record<WorkMode, "green" | "blue" | "red"> = { WFO: "green", WFH: "blue", "Off-site": "red" };
