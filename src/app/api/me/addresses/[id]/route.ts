import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileFromRequest } from "@/lib/auth/server";
import {
  deleteAddressForCustomer,
  updateAddressForCustomer,
} from "@/lib/supabase/addresses";

const writeSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  fullAddress: z.string().min(5).max(300).optional(),
  barangay: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  deliveryInstructions: z.string().max(500).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await updateAddressForCustomer(session.id, id, parsed.data);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ address: result.address });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionProfileFromRequest(_request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await deleteAddressForCustomer(session.id, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
