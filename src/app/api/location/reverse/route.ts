import { NextResponse, type NextRequest } from "next/server";

import { requireApiPermission } from "@/lib/server/api";

function coordinateFromSearch(searchParams: URLSearchParams, key: "lat" | "lng") {
  const value = Number(searchParams.get(key));
  const max = key === "lat" ? 90 : 180;

  if (!Number.isFinite(value) || Math.abs(value) > max) {
    return null;
  }

  return value;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function compactPlaceName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) return "Open in Google Maps";

  const parts = name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 4).join(", ") || "Open in Google Maps";
}

export async function GET(request: NextRequest) {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  const lat = coordinateFromSearch(request.nextUrl.searchParams, "lat");
  const lng = coordinateFromSearch(request.nextUrl.searchParams, "lng");

  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      addressdetails: "1",
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      cache: "force-cache",
      headers: {
        "User-Agent": "Akaal Team Management attendance location lookup",
      },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as { display_name?: string; name?: string };
    const label = compactPlaceName(data.name || data.display_name);

    return NextResponse.json({
      data: {
        label,
        url: mapsUrl(lat, lng),
      },
    });
  } catch {
    return NextResponse.json({
      data: {
        label: "Open in Google Maps",
        url: mapsUrl(lat, lng),
      },
    });
  }
}
