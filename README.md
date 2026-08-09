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
3. **Google** — set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`
   - Redirect URI: `http://localhost:3000/api/auth/google/callback`
4. First account (email or Google) becomes **Super Admin**

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

1. Create a Supabase project
2. Run migrations in `supabase/migrations/` (SQL editor or CLI), in order:
   - `001_initial_schema.sql` — schema, RLS, triggers
   - `002_seed_data.sql` — categories, products, inventory, rewards
   - `003_harden_auth_roles.sql` — force CUSTOMER on signup; admin-only role changes
   - `004_maintenance_and_role_fix.sql` — maintenance setting + service-role role updates
3. Set env vars (local `.env.local` and Vercel project settings):

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AUTH_SESSION_SECRET=long-random-secret
NEXT_PUBLIC_DEMO_MODE=false
```

### Deploy on Vercel

Local `.data/accounts.json` **does not work** on Vercel (ephemeral filesystem). You must configure Supabase as above.

1. Push the repo and import it in Vercel
2. Add the env vars from the previous section
3. Deploy
4. Register the first user — they become **SUPER_ADMIN** automatically when no admins exist yet

Without Supabase env vars, auth falls back to `.data/` which is only for local development.
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
