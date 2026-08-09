# Island Coolers

Production-ready online ordering, delivery & loyalty platform for Island Coolers — soda flavors, iced coffee, and matcha.

## Experiences

| App | URL | Description |
|-----|-----|-------------|
| **Marketing** | `/` | Landing page |
| **Customer** | `/home` | Order, track, earn points |
| **Admin** | `/admin` | Dashboard, Kanban orders, inventory |
| **Driver** | `/driver` | Accept, navigate, deliver |

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, Recharts, TanStack Query, Zustand
- **Auth:** Real accounts (local secure store or Supabase Auth) — no demo logins or role switching
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime, RLS) when configured
- **Abstractions:** Payments (COD / GCash / Card / Online), Maps (Mapbox / Google)

## Quick start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Accounts

1. **Email signup** — `/register` (name, email, optional phone, password)
2. **Email login** — `/login`
3. First account becomes **Super Admin**

Passwords are hashed (scrypt). Sessions use httpOnly signed cookies.  
Local accounts live in `.data/accounts.json` (gitignored).

Seed all role accounts:

```bash
npm run seed:users
```

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@islandcoolers.com` | `IslandCoolers1!` |
| Admin | `ops@islandcoolers.com` | `IslandCoolers1!` |
| Manager | `manager@islandcoolers.com` | `IslandCoolers1!` |
| Staff | `staff@islandcoolers.com` | `IslandCoolers1!` |
| Driver | `juan@islandcoolers.com` | `IslandCoolers1!` |
| Customer | `maria@islandcoolers.com` | `IslandCoolers1!` |
| Customer | `carlo@islandcoolers.com` | `IslandCoolers1!` |

### Connect Supabase

Powers **login**, **Postgres catalog**, and **S3 image uploads**.

1. Create a project at [supabase.com](https://supabase.com)
2. **Project Settings → API** — copy Project URL, publishable/`anon` key, and `service_role`/secret key
3. Run `supabase/bootstrap.sql` (or migrations `001`–`004`) in the SQL editor
4. **Storage → S3** — copy Access Key ID + Secret; note your bucket name (e.g. `islandcoolersimg`)
5. Auth → Providers → Email enabled
6. Set env vars in `.env.local` **and** Vercel → Project → Settings → Environment Variables (Production + Preview):

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or legacy anon JWT
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                   # or sb_secret_...
AUTH_SESSION_SECRET=long-random-secret
NEXT_PUBLIC_DEMO_MODE=false

# S3 image uploads (required on Vercel)
S3_ENDPOINT=https://xxx.storage.supabase.co/storage/v1/s3
S3_REGION=ap-southeast-1
S3_BUCKET=islandcoolersimg
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

7. Redeploy after saving env vars. Check **Admin → Settings → Supabase** for Auth / Database / Storage.

### Deploy on Vercel

Local `.data/accounts.json` **does not work** on Vercel. Auth + DB + S3 uploads all use Supabase.

1. Push the repo and import it in Vercel (or connect the GitHub repo)
2. Add **all** env vars above for Production and Preview
3. Deploy (or Redeploy so new env vars apply)
4. Seed users: `npm run seed:supabase` locally (uses service role against the same project)

Without Supabase/S3 env vars on Vercel, login and image uploads will fail.
## Project structure

```
src/
  app/
    (customer)/     # Customer ordering app
    admin/          # Staff dashboard
    driver/         # Rider mobile app
    api/auth/       # Login, register, session, staff invites
  components/
    ui/             # shadcn primitives
    shared/         # ProductCard, StatusBadge, etc.
    customer/ admin/ driver/
  lib/
    auth/ supabase/ payments/ maps/
  services/         # Business logic layer
  stores/           # Zustand (cart, auth, orders)
  types/
supabase/migrations/
```

## Key flows

**Customer:** Browse → Customize → Cart → Checkout → Pay → Track → Earn points → Redeem

**Admin:** New order → Accept → Prepare → Ready → Assign rider → Track

**Driver:** Accept → Pick up → Navigate → Arrive → Confirm (PIN) → Delivered

## Design system

- Navy `#0B2A4A` — headings, sidebar
- Green `#176B3A` — primary CTAs
- Sky `#1FA7E1` — delivery / secondary
- Background `#F8FAFC` — surfaces

## Scripts

```bash
npm run dev      # Development
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```
