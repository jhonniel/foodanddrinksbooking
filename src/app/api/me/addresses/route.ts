import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileFromRequest } from "@/lib/auth/server";
import {
  createAddressForCustomer,
  listAddressesForCustomer,
  MAX_CUSTOMER_ADDRESSES,
} from "@/lib/supabase/addresses";

const writeSchema = z.object({
  label: z.string().min(1, "Label is required").max(40),
  fullAddress: z.string().min(5, "Address is required").max(300),
  barangay: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  deliveryInstructions: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await listAddressesForCustomer(session.id);
  return NextResponse.json({
    addresses,
    max: MAX_CUSTOMER_ADDRESSES,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await createAddressForCustomer(session.id, parsed.data);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ address: result.address });
}
