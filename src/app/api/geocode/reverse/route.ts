import { NextRequest, NextResponse } from "next/server";
import { reverseGeocodeTomTom } from "@/lib/geocoding/tomtom";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required." },
      { status: 400 }
    );
  }

  try {
    const address = await reverseGeocodeTomTom(lat, lng);
    if (!address) {
      return NextResponse.json(
        { error: "Could not look up this location." },
        { status: 404 }
      );
    }
    return NextResponse.json({ address });
  } catch {
    return NextResponse.json(
      { error: "Geocoding service unavailable." },
      { status: 503 }
    );
  }
}
