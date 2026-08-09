import { NextResponse } from "next/server";
import { getProducts, getCategories } from "@/services/productService";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`products:${ip}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("q") || undefined;
  const featured = searchParams.get("featured") === "true";
  const bestSeller = searchParams.get("bestSeller") === "true";
  const sort = (searchParams.get("sort") as
    | "price_asc"
    | "price_desc"
    | "rating"
    | "popular"
    | "newest"
    | null) || undefined;

  const [products, categories] = await Promise.all([
    getProducts({
      categorySlug: category,
      search,
      featured: featured || undefined,
      bestSeller: bestSeller || undefined,
      sort,
    }),
    getCategories(),
  ]);

  return NextResponse.json(
    { products, categories },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(limited.remaining),
      },
    }
  );
}
