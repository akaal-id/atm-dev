import "server-only";

import { awardPointsOnce } from "@/lib/server/gamification";
import { listResource, listResourceByFieldUnscoped } from "@/lib/server/store";
import { type BaseLocation, type WorkMode, DEFAULT_OFFICE, distanceMeters, HOME_RADIUS_M, OFFSITE_PERMIT_LEAD_HOURS } from "@/lib/attendance-location";

/** Rules (settings table overrides; defaults agreed 2026-10-02). */
const DEFAULT_OFFICE_RADIUS_M = 150;
const DEFAULT_OFFSITE_PENALTY = -20;

async function settingValue(key: string) {
  const settings = await listResource("Settings");
  return settings.find((setting) => setting.setting_key === key)?.setting_value;
}

async function settingNumber(key: string, fallback: number) {
  const value = Number(await settingValue(key));
  return Number.isFinite(value) && value !== 0 ? value : fallback;
}

/** The company office everyone's WFO is measured against. */
export async function officeLocation(): Promise<BaseLocation & { label: string }> {
  const [lat, lng, label] = await Promise.all([
    settingNumber("office_lat", DEFAULT_OFFICE.lat),
    settingNumber("office_lng", DEFAULT_OFFICE.lng),
    settingValue("office_label"),
  ]);
  return { lat, lng, label: String(label || DEFAULT_OFFICE.label) };
}

export async function attendanceLocationRules() {
  const [officeRadius, offsitePenalty] = await Promise.all([
    settingNumber("office_radius_m", DEFAULT_OFFICE_RADIUS_M),
    settingNumber("offsite_penalty_points", DEFAULT_OFFSITE_PENALTY),
  ]);
  return { officeRadius, homeRadius: HOME_RADIUS_M, offsitePenalty: -Math.abs(offsitePenalty) };
}

type UserHome = { home_lat?: number | null; home_lng?: number | null };

export async function readUserHome(userId: string): Promise<BaseLocation | null> {
  const [user] = (await listResourceByFieldUnscoped("Users", "user_id", userId, { limit: 1 })) as unknown as UserHome[];
  const { home_lat: lat, home_lng: lng } = user ?? {};
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** WFO within the office radius, WFH within 500 m of home, otherwise Off-site. Null when the user has no home set. */
export async function classifyWorkMode(userId: string, lat: number, lng: number): Promise<{ mode: WorkMode; distance: number } | null> {
  const [home, office, rules] = await Promise.all([readUserHome(userId), officeLocation(), attendanceLocationRules()]);
  if (!home) return null;
  const here = { lat, lng };
  const toOffice = distanceMeters(here, office);
  const toHome = distanceMeters(here, home);
  if (toOffice <= rules.officeRadius) return { mode: "WFO", distance: Math.round(toOffice) };
  if (toHome <= rules.homeRadius) return { mode: "WFH", distance: Math.round(toHome) };
  return { mode: "Off-site", distance: Math.round(Math.min(toOffice, toHome)) };
}

/** Approved Off-site permit covering `date`, requested ≥ 6 h before clock-in. */
export async function hasValidOffsitePermit(userId: string, date: string, clockInAt: string) {
  const requests = await listResourceByFieldUnscoped("Leave_Requests", "user_id", userId);
  const deadline = new Date(clockInAt).getTime() - OFFSITE_PERMIT_LEAD_HOURS * 3_600_000;
  return requests.some(
    (request) =>
      request.request_type === "Off-site" &&
      request.status === "Approved" &&
      request.start_date <= date &&
      request.end_date >= date &&
      new Date(request.created_at).getTime() <= deadline,
  );
}

/** Deduct points once per session for working Off-site without a valid permit. */
export async function penalizeOffsiteWithoutPermit(input: { userId: string; sessionId: string; date: string; clockInAt: string }) {
  if (await hasValidOffsitePermit(input.userId, input.date, input.clockInAt)) return;
  const { offsitePenalty } = await attendanceLocationRules();
  await awardPointsOnce({
    userId: input.userId,
    sourceType: "offsite_no_permit",
    sourceId: input.sessionId,
    points: offsitePenalty,
    reason: `Off-site on ${input.date} without an approved permit (≥ ${OFFSITE_PERMIT_LEAD_HOURS} h ahead)`,
  });
}

/** Office place + WFO radius for the work-locations card. */
export async function officeForDisplay() {
  const [office, rules] = await Promise.all([officeLocation(), attendanceLocationRules()]);
  return { ...office, radius: rules.officeRadius };
}
