# API Reference

All endpoints are versioned under `/api/v1/`. All responses use the envelope:

```json
// Success
{ "data": <T> }

// Error
{ "error": { "code": "<ERROR_CODE>", "message": "<human readable>", "requestId": "<uuid>" } }
```

Every response includes an `X-Request-Id` header for traceability.

Interactive OpenAPI docs are available at `/api/docs` once the app is running.

## Authentication

| Method | Path                | Description                            |
| ------ | ------------------- | -------------------------------------- |
| POST   | `/auth/register`    | Create a new account                   |
| POST   | `/auth/login`       | Sign in with email + password          |
| POST   | `/auth/refresh`     | Rotate access + refresh tokens         |
| POST   | `/auth/logout`      | Revoke refresh token                   |
| GET    | `/auth/me`          | Get the current user                   |

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "SecurePassword1"
}
```

**Response 200**:
```json
{
  "data": {
    "user": { "id": "ck...", "email": "ada@example.com", "role": "USER" },
    "accessToken": "eyJ...",
    "refreshToken": "abc...",
    "expiresIn": 900
  }
}
```

Sets httpOnly cookies: `lf_session` (access, 15min), `lf_refresh` (refresh, 30d).

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "ada@example.com", "password": "SecurePassword1" }
```

### Refresh

```http
POST /api/v1/auth/refresh
Cookie: lf_refresh=<token>
```

Rotates the refresh token (the old one is revoked). Returns a new access + refresh pair.

### Logout

```http
POST /api/v1/auth/logout
Cookie: lf_refresh=<token>
```

### Me

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

## Companies

| Method | Path           | Description                              |
| ------ | -------------- | ---------------------------------------- |
| GET    | `/companies`   | List companies (paginated, filterable)   |

### List companies

```http
GET /api/v1/companies?page=1&pageSize=20&q=linear&status=QUALIFIED&sort=score:desc
```

**Query params**:
- `page` (default 1)
- `pageSize` (default 20, max 100)
- `q` — search across name + domain
- `status` — `NEW` | `QUALIFIED` | `CONTACTED` | `RESPONDED` | `MEETING_BOOKED` | `CLOSED_WON` | `CLOSED_LOST`
- `stage` — `PRE_SEED` | `SEED` | `SERIES_A` | `SERIES_B` | `SERIES_C_PLUS` | `BOOTSTRAPPED` | `ACQUIRED` | `PUBLIC`
- `grade` — `A` | `B` | `C` | `D` | `F`
- `industry` — free text
- `sort` — `field:asc|desc` (default `createdAt:desc`)

**Response 200**:
```json
{
  "data": {
    "data": [
      {
        "id": "ck...",
        "name": "Linear",
        "domain": "linear.app",
        "industry": "Developer Tools",
        "grade": "A",
        "score": 92,
        "status": "QUALIFIED",
        "stage": "SERIES_B",
        "technologies": ["Next.js", "TypeScript"],
        "tags": ["saas", "b2b"],
        "createdAt": "2026-07-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 60,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

## People

| Method | Path       | Description                          |
| ------ | ---------- | ------------------------------------ |
| GET    | `/people`  | List people (paginated, filterable)  |

```http
GET /api/v1/people?page=1&pageSize=20&q=ada&verified=true
```

## Campaigns

| Method | Path           | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/campaigns`   | List campaigns                       |

## Jobs

| Method | Path     | Description                                       |
| ------ | -------- | ------------------------------------------------- |
| GET    | `/jobs`  | List background jobs (queue mirror)               |

## Stats

| Method | Path              | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| GET    | `/stats/overview`  | Aggregated KPIs + distributions for dashboard |

## Audit Logs

| Method | Path             | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| GET    | `/audit-logs`     | List audit log entries (admin only)          |

## System

| Method | Path      | Description                                              |
| ------ | --------- | -------------------------------------------------------- |
| GET    | `/health` | Liveness + readiness probe (used by Docker healthchecks) |

**Response 200**:
```json
{
  "data": {
    "status": "healthy",
    "version": "1.0.0-phase1",
    "timestamp": "2026-07-11T00:00:00Z",
    "uptime": 3600,
    "services": {
      "database": { "status": "up", "latencyMs": 3 },
      "redis": { "status": "pending", "details": "Not wired in Phase 1" },
      "rabbitmq": { "status": "pending", "details": "Not wired in Phase 1" }
    }
  }
}
```

## Error codes

| Code                | HTTP | Meaning                              |
| ------------------- | ---- | ------------------------------------ |
| `VALIDATION_ERROR`  | 400  | Zod validation failed                |
| `INVALID_JSON`      | 400  | Request body is not valid JSON       |
| `AUTH_ERROR`        | 401  | Not authenticated / bad credentials  |
| `FORBIDDEN`         | 403  | Authenticated but insufficient role  |
| `NOT_FOUND`         | 404  | Resource not found                   |
| `CONFLICT`          | 409  | Duplicate resource                   |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests                   |
| `INTERNAL_ERROR`    | 500  | Unexpected server error              |
| `NETWORK_ERROR`     | 0    | Client-side network failure          |

## Rate limits

| Endpoint group | Window  | Max requests |
| -------------- | ------- | ------------ |
| Auth           | 15 min  | 10 per IP    |
| API            | 1 min   | 120 per user |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) will be added in Phase 2.
