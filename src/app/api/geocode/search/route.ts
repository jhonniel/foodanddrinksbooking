import { NextRequest, NextResponse } from "next/server";
import { searchGeocodeTomTom } from "@/lib/geocoding/tomtom";
import { SAMAL_MAP_CENTER } from "@/lib/delivery/samal";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const bias =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, radiusMeters: 30000 }
      : { lat: SAMAL_MAP_CENTER.lat, lng: SAMAL_MAP_CENTER.lng, radiusMeters: 30000 };

  try {
    const results = await searchGeocodeTomTom(q, bias);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Geocoding service unavailable.", results: [] },
      { status: 503 }
    );
  }
}
