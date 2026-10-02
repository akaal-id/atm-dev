import { NextResponse, type NextRequest } from "next/server";

import { requireApiPermission } from "@/lib/server/api";

type NominatimPlace = { lat: string; lon: string; display_name: string };

/** Address → up to 5 candidate places in Indonesia (OpenStreetMap Nominatim). */
export async function GET(request: NextRequest) {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (query.length < 3) return NextResponse.json({ data: [] });

  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "5", countrycodes: "id", "accept-language": "id" });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": "Akaal Team Management attendance location lookup" },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(String(response.status));
    const places = (await response.json()) as NominatimPlace[];
    return NextResponse.json({
      data: places.map((place) => ({ label: place.display_name, lat: Number(place.lat), lng: Number(place.lon) })),
    });
  } catch {
    return NextResponse.json({ error: "Address search is unavailable right now. Pick the spot on the map instead." }, { status: 502 });
  }
}
