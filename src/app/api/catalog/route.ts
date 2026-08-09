import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { fetchCatalogFromSupabase } from "@/lib/supabase/catalog";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      categories: [],
      products: [],
      inventory: [],
    });
  }

  const catalog = await fetchCatalogFromSupabase();
  if (!catalog) {
    return NextResponse.json(
      {
        configured: true,
        error: "Could not load catalog from Supabase.",
        categories: [],
        products: [],
        inventory: [],
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    configured: true,
    ...catalog,
  });
}
