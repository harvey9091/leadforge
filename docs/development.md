# Development Guide

## Conventions

### File structure

- **Pages**: `src/features/<area>/<area>-page.tsx` — one file per route view.
- **Components**: `src/components/<category>/<name>.tsx` — grouped by purpose.
- **Layout**: `src/components/layout/` — sidebar, topbar, command palette, shell.
- **Common**: `src/components/common/` — reusable presentational components (StatCard, PageHeader, EmptyState, etc.).
- **Server**: `src/server/` — backend layer (services, repositories, utils, config). Never imported by client components.
- **Hooks**: `src/hooks/` — custom React hooks.
- **Types**: `src/types/index.ts` — client-facing type definitions (mirror of Prisma models).

### Naming

- **Components**: PascalCase (`StatCard`, `DataTable`).
- **Files**: kebab-case (`stat-card.tsx`, `use-hash-route.ts`).
- **Hooks**: `use-*` prefix.
- **Routes**: hash-based (`#/dashboard`, `#/leads`). Route IDs are PascalCase (`dashboard`, `settings.profile`).
- **API endpoints**: kebab-case (`/api/v1/audit-logs`).

### TypeScript

- Strict mode, no `any`.
- All function parameters and return types are explicit on public APIs.
- Use `unknown` instead of `any` for untrusted input.
- Zod schemas are the source of truth for request shapes — infer types from them.

### Styling

- Use Tailwind utility classes directly in components.
- Use the design tokens (`bg-background`, `text-foreground`, `border-border`, etc.) — never raw hex colors.
- Spacing is on a 4px grid: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px), `gap-8` (32px).
- Typography sizes are intentional:
  - Page title: `text-[22px] font-semibold tracking-tight`
  - Section title: `text-[14px] font-semibold`
  - Body: `text-[13px]` or `text-[13.5px]`
  - Caption: `text-[11.5px]` or `text-[12px]`
  - Label: `text-[10.5px] uppercase tracking-wide font-medium`

### Animation

- Use Framer Motion for layout transitions and list staggers.
- Duration: 150–220ms.
- Easing: `[0.4, 0, 0.2, 1]` (Material's standard ease) for most transitions.
- No spring physics, no bounce.
- Page transitions: fade + 4px Y translate, 180ms.
- Stagger delays: `i * 0.04` (40ms per item, capped at 0.3s).

## Commands

```bash
# Development
bun run dev              # Start dev server on http://localhost:3001
bun run lint             # ESLint check
bun run db:push          # Sync Prisma schema to database
bun run db:generate      # Regenerate Prisma client (after schema changes)
bun run db:seed          # Insert demo data

# Testing
bunx vitest run          # Run unit tests once
bunx vitest              # Watch mode
bunx vitest --coverage   # With coverage report
bunx playwright test     # E2E tests
bunx playwright test --ui  # E2E with UI

# Production build
bun run build            # Build the Next.js standalone output
```

## Database

### Schema

The canonical schema lives at [`prisma/schema.prisma`](../prisma/schema.prisma). The runtime app uses SQLite (dev constraint) but the schema is written to be 1:1 portable to PostgreSQL — no SQLite-specific types are used.

### Migrations

Phase 1 uses `prisma db push` (schema-first) instead of `prisma migrate` (migration-first). This is fine for development. Phase 2 will switch to `prisma migrate` for production deployments so we have an auditable migration history.

### Adding a new entity

1. Add the model to `prisma/schema.prisma`.
2. Run `bun run db:push` to sync.
3. Add the TypeScript type to `src/types/index.ts` (mirror for client use).
4. Create a repository in `src/server/repositories/<name>.repository.ts`.
5. Create API routes in `src/app/api/v1/<name>/route.ts`.

## API

### Conventions

- All endpoints live under `/api/v1/`.
- All responses use the envelope `{ data: T }` (success) or `{ error: { code, message, requestId } }` (failure).
- Every response includes an `X-Request-Id` header.
- Pagination uses `page` + `pageSize` query params, returns `{ data, pagination: { page, pageSize, total, totalPages, hasMore } }`.
- Sorting uses `sort=field:asc|desc`.
- Search uses `q=<query>`.

### Adding a new endpoint

1. Create `src/app/api/v1/<resource>/route.ts`.
2. Use the helpers in `src/server/utils/api.ts`:
   - `getRequestContext(req)` — extracts request ID, IP, user agent.
   - `readJson(req)` — parses the JSON body safely.
   - `validate(schema, data)` — validates against Zod.
   - `apiSuccess(data, { requestId })` — success envelope.
   - `apiError(err, requestId)` — error envelope (handles `AppError` subclasses).
3. Throw `AppError` subclasses for expected failures — they auto-map to the right HTTP status.
4. Add the endpoint to the OpenAPI spec at `src/app/api/docs/route.ts`.

## Authentication

### Flow

1. **Register** (`POST /api/v1/auth/register`): creates user, hashes password (PBKDF2), issues JWT access token (15min) + opaque refresh token (30d). Tokens are set as httpOnly cookies.
2. **Login** (`POST /api/v1/auth/login`): verifies credentials, issues tokens.
3. **API calls**: client includes the access token in `Authorization: Bearer <token>`.
4. **Token expiry**: client calls `POST /api/v1/auth/refresh` to get a new pair. The old refresh token is revoked (rotation).
5. **Logout** (`POST /api/v1/auth/logout`): revokes the refresh token, clears cookies.

### Roles

- **ADMIN**: first user created. Can manage users, API keys, system config.
- **USER**: default role. Can manage leads, campaigns, own profile.

Roles are checked via the `role` field on the JWT payload.

## Routing

The host environment only exposes a single Next.js route (`/`). Internal navigation uses **hash-based routing**:

- `#/dashboard`, `#/leads`, `#/companies`, etc.
- The `useHashRoute` hook reads `window.location.hash` and resolves it to a `RouteMeta`.
- The root `src/app/page.tsx` is the router — it reads the current route and renders the matching view.

When Phase 2 deploys via Docker Compose with a real reverse proxy, this can be migrated to Next.js App Router multi-route navigation without touching the view components.

## Component patterns

### Data fetching

Use TanStack Query:

```tsx
const { data, isLoading } = useQuery({
  queryKey: ["companies", { page, search }],
  queryFn: () => apiClient.get("/companies", { page, search }),
});
```

### Forms

Use React Hook Form + Zod:

```tsx
const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
  defaultValues: { email: "", password: "" },
});
```

### Tables

Use the `DataTable` component:

```tsx
<DataTable
  columns={columns}
  data={data}
  page={page}
  pageSize={pageSize}
  total={total}
  onPageChange={setPage}
  search={search}
  onSearchChange={setSearch}
  enableSelection
  onSelectionChange={setSelected}
/>
```

## Debugging

### Dev server logs

```bash
tail -f dev.log
```

### Database inspection

```bash
# SQLite (dev)
sqlite3 db/custom.db ".tables"
sqlite3 db/custom.db "SELECT * FROM User LIMIT 5;"

# PostgreSQL (Docker)
docker compose exec postgres psql -U leadforge leadforge -c "SELECT * FROM \"User\" LIMIT 5;"
```

### Browser

The Next.js Dev Tools (bottom-right corner) show component render times and route info. The React DevTools browser extension is recommended for inspecting the component tree.
