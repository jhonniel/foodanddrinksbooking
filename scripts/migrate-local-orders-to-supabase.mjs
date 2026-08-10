/**
 * Migrate .data/orders.json → Supabase orders tables.
 * Requires SERVICE ROLE key (bypasses RLS, remaps customers/products).
 *
 * Usage: node scripts/migrate-local-orders-to-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ORDERS_FILE = path.join(ROOT, ".data", "orders.json");
const ENV_FILE = path.join(ROOT, ".env.local");

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(ENV_FILE, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!env[m[1]]) env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
  return env;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const anon =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON key in .env.local");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
        "Add it from Supabase → Project Settings → API → service_role, then re-run."
    );
    process.exit(1);
  }

  let local;
  try {
    local = JSON.parse(await fs.readFile(ORDERS_FILE, "utf8"));
  } catch {
    console.error("No .data/orders.json found — nothing to migrate.");
    process.exit(0);
  }

  const orders = Array.isArray(local.orders) ? local.orders : [];
  if (!orders.length) {
    console.log("Local orders file is empty.");
    process.exit(0);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email");
  if (profilesError) {
    console.error("Failed to load profiles:", profilesError.message);
    process.exit(1);
  }
  const profileByEmail = new Map(
    (profiles || []).map((p) => [String(p.email).toLowerCase(), p.id])
  );

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name")
    .order("sort_order");
  if (productsError || !products?.length) {
    console.error(
      "Failed to load products:",
      productsError?.message || "no products in catalog"
    );
    process.exit(1);
  }
  const productByName = new Map(
    products.map((p) => [String(p.name).toLowerCase(), p.id])
  );
  const fallbackProductId = products[0].id;

  console.log(`Migrating ${orders.length} local orders → Supabase…\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const email = (order.customer?.email || "").toLowerCase();
    const customerId =
      (email && profileByEmail.get(email)) ||
      (UUID_RE.test(order.customer_id) &&
      [...profileByEmail.values()].includes(order.customer_id)
        ? order.customer_id
        : null);

    if (!customerId) {
      console.log(
        `  SKIP  ${order.order_number} — no Supabase profile for ${email || order.customer_id}`
      );
      skipped++;
      continue;
    }

    // Skip if an order with same number already exists
    const { data: existing } = await admin
      .from("orders")
      .select("id")
      .eq("order_number", order.order_number)
      .maybeSingle();
    if (existing?.id) {
      console.log(`  SKIP  ${order.order_number} — already in Supabase`);
      skipped++;
      continue;
    }

    // Fresh created_at for still-open statuses so the 1-hour PENDING
    // auto-cancel does not immediately wipe migrated orders.
    const status = order.status || "PENDING";
    const openStatuses = new Set([
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "ARRIVED",
    ]);
    const createdAt = openStatuses.has(status)
      ? new Date().toISOString()
      : order.created_at || new Date().toISOString();

    const { data: inserted, error: orderError } = await admin
      .from("orders")
      .insert({
        customer_id: customerId,
        status,
        order_type: order.order_type || "PICKUP",
        subtotal: order.subtotal ?? 0,
        delivery_fee: order.delivery_fee ?? 0,
        discount: order.discount ?? 0,
        points_discount: order.points_discount ?? 0,
        tax: order.tax ?? 0,
        total: order.total ?? 0,
        payment_status: order.payment_status || "PENDING",
        payment_method: order.payment_method || "COD",
        delivery_address_snapshot: order.delivery_address_snapshot || null,
        delivery_instructions: order.delivery_instructions || null,
        points_earned: order.points_earned ?? 0,
        points_used: order.points_used ?? 0,
        estimated_prep_minutes: order.estimated_prep_minutes ?? 15,
        cancelled_reason: status === "CANCELLED" ? order.cancelled_reason || null : null,
        confirmed_at: order.confirmed_at || null,
        preparing_at: order.preparing_at || null,
        ready_at: order.ready_at || null,
        delivered_at: order.delivered_at || null,
        cancelled_at: status === "CANCELLED" ? order.cancelled_at || null : null,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
        // Keep readable number when possible; DB may ignore if default overrides
        order_number: order.order_number,
      })
      .select("id, order_number")
      .single();

    if (orderError || !inserted) {
      // Retry without custom order_number if unique/default conflict
      const { data: inserted2, error: err2 } = await admin
        .from("orders")
        .insert({
          customer_id: customerId,
          status: order.status || "PENDING",
          order_type: order.order_type || "PICKUP",
          subtotal: order.subtotal ?? 0,
          delivery_fee: order.delivery_fee ?? 0,
          discount: order.discount ?? 0,
          points_discount: order.points_discount ?? 0,
          tax: order.tax ?? 0,
          total: order.total ?? 0,
          payment_status: order.payment_status || "PENDING",
          payment_method: order.payment_method || "COD",
          delivery_address_snapshot: order.delivery_address_snapshot || null,
          delivery_instructions: order.delivery_instructions || null,
          points_earned: order.points_earned ?? 0,
          points_used: order.points_used ?? 0,
          estimated_prep_minutes: order.estimated_prep_minutes ?? 15,
          notes: `Migrated from local ${order.order_number}`,
          created_at: order.created_at || new Date().toISOString(),
          updated_at: order.updated_at || new Date().toISOString(),
        })
        .select("id, order_number")
        .single();

      if (err2 || !inserted2) {
        console.log(
          `  FAIL  ${order.order_number} — ${orderError?.message || err2?.message}`
        );
        failed++;
        continue;
      }

      await insertItems(admin, inserted2.id, order.items || [], productByName, fallbackProductId);
      console.log(
        `  OK    ${order.order_number} → ${inserted2.order_number} (${inserted2.id})`
      );
      ok++;
      continue;
    }

    await insertItems(admin, inserted.id, order.items || [], productByName, fallbackProductId);
    console.log(`  OK    ${order.order_number} → ${inserted.id}`);
    ok++;
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed}`);
  if (ok > 0) {
    const backup = ORDERS_FILE + ".migrated.json";
    await fs.rename(ORDERS_FILE, backup);
    await fs.writeFile(
      ORDERS_FILE,
      JSON.stringify({ orders: [], deliveries: [], orderSeq: 10255 }, null, 2),
      "utf8"
    );
    console.log(`Local file backed up to ${path.basename(backup)} and cleared.`);
  }
}

async function insertItems(admin, orderId, items, productByName, fallbackProductId) {
  for (const item of items) {
    const byName = productByName.get(String(item.product_name || "").toLowerCase());
    const productId =
      (item.product_id && UUID_RE.test(item.product_id) && item.product_id) ||
      byName ||
      fallbackProductId;

    const { data: row, error } = await admin
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: productId,
        product_name: item.product_name || "Item",
        product_image_url: item.product_image_url || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price ?? 0,
        total_price: item.total_price ?? 0,
        special_instructions: item.special_instructions || null,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.log(`    item fail: ${error?.message}`);
      continue;
    }

    const opts = item.options || [];
    if (opts.length) {
      await admin.from("order_item_options").insert(
        opts.map((o) => ({
          order_item_id: row.id,
          option_name: o.option_name || o.optionName || "Option",
          value_name: o.value_name || o.valueName || "Value",
          price_adjustment: o.price_adjustment ?? o.priceAdjustment ?? 0,
        }))
      );
    }
    const addons = item.addons || [];
    if (addons.length) {
      await admin.from("order_item_addons").insert(
        addons.map((a) => ({
          order_item_id: row.id,
          addon_name: a.addon_name || a.name || "Addon",
          price: a.price ?? 0,
          quantity: a.quantity ?? 1,
        }))
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
