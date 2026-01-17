ACTUÁ COMO SENIOR FULLSTACK ENGINEER. Quiero que construyas una app “Issue Tracker Lite” fullstack profesional (nivel entrevista) con Postgres + Node.js/Express + React. Priorizá ejecución y calidad pragmática (no over-engineering), con buen manejo de trade-offs, errores, validación, seguridad básica y performance razonable.

========================
1) STACK / ESTRUCTURA
========================
- Monorepo (recomendado) con pnpm workspaces:
  - apps/api (Node.js + Express + TypeScript)
  - apps/web (React + TypeScript + Vite)
  - packages/shared (tipos DTO compartidos opcional)
- DB: Postgres
- ORM: Prisma (rápido para entregar) PERO mantené queries críticas claras (y si hace falta, SQL raw puntual).
- Validación: Zod (backend) + zod en frontend si ayuda.
- Fetching/caching: React Query (TanStack Query).
- Routing: React Router.
- Tests backend: Jest o Vitest + Supertest (mínimo 2–4 tests).
- Lint/format: Biome o ESLint/Prettier (simple).

========================
2) REQUERIMIENTOS FUNCIONALES (MVP)
========================
A) Autenticación
- Login con email + password.
- Password hashed (bcrypt).
- Auth basada en JWT:
  - Access token corto (ej 15m).
  - Refresh token (ej 7d) con rotación y persistencia en DB (hash del refresh).
  - Guardar tokens en cookies httpOnly (recomendado) para SPA.
- Endpoints:
  - POST /auth/login
  - POST /auth/refresh
  - POST /auth/logout
  - GET /me

B) Proyectos + Permisos (RBAC simple)
- Un usuario puede tener múltiples proyectos.
- Membresía por proyecto con roles:
  - OWNER, MAINTAINER, REPORTER
- Reglas:
  - Ver issues: cualquier miembro del proyecto.
  - Crear issue: MAINTAINER o OWNER.
  - Cambiar status/assignee: MAINTAINER o OWNER.
  - Comentar: cualquier miembro.
- Endpoints:
  - GET /projects (mis proyectos)
  - POST /projects (crea proyecto, creador=OWNER)
  - GET /projects/:projectId
  - POST /projects/:projectId/members (solo OWNER; agrega miembros por email + role)

C) Issues
- Un issue pertenece a un proyecto.
- Campos: title, description, status, priority, assignee, reporter, timestamps.
- Status: OPEN | IN_PROGRESS | BLOCKED | DONE
- Priority: LOW | MEDIUM | HIGH | URGENT
- Endpoints:
  - GET /projects/:projectId/issues
    - filtros: status, assigneeId, q (search en title/description)
    - orden: created_at desc (o updated_at desc)
    - paginación: cursor (NO offset) para estabilidad
    - query params: ?limit=20&cursor=<opaque>
    - response: { items: Issue[], nextCursor: string | null }
  - POST /projects/:projectId/issues
  - GET /issues/:issueId (detalle)
  - PATCH /issues/:issueId
    - permitir update parcial: status, title, description, priority, assigneeId (nullable)
    - usar optimistic locking con campo version (incremental) o updatedAt check.
  - POST /issues/:issueId/comments
  - GET /issues/:issueId/comments

D) Auditoría básica (muy de entrevista)
- Registrar eventos importantes en issue_events:
  - ISSUE_CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, ISSUE_UPDATED, COMMENT_ADDED
- Guardar: actorId, issueId, type, payload (jsonb), createdAt.
- Crear eventos dentro de la misma transacción cuando corresponda.

========================
3) MODELO DE DATOS (Postgres)
========================
Entidades mínimas:
- users(id, email UNIQUE, name, password_hash, created_at)
- projects(id, key UNIQUE, name, created_at, owner_id FK users)
- project_members(project_id FK, user_id FK, role, created_at, UNIQUE(project_id, user_id))
- issues(
    id,
    project_id FK,
    number (secuencial por proyecto),
    title,
    description,
    status,
    priority,
    assignee_id FK users NULL,
    reporter_id FK users,
    created_at,
    updated_at,
    closed_at NULL,
    version INT default 1,
    UNIQUE(project_id, number)
  )
- comments(id, issue_id FK, author_id FK, body, created_at)
- issue_events(id, issue_id FK, actor_id FK, type, payload jsonb, created_at)

Generación del “number” por proyecto:
- Opción A (simple y consistente): tabla project_counters(project_id PK, next_number INT)
  - En transacción: SELECT FOR UPDATE counter, usar next_number, incrementar.
- Opción B: MAX(number)+1 con lock (menos ideal). Preferir A.

Índices (sí o sí, justificados por queries):
- issues(project_id, created_at DESC, id DESC)  -> lista con cursor
- issues(project_id, status, created_at DESC, id DESC) -> filtros por status
- issues(assignee_id, status) -> “mis issues”
- comments(issue_id, created_at) -> detalle
Nice to have:
- Full-text search (tsvector) sobre title/description + GIN index.

========================
4) API QUALITY (Contrato, errores, seguridad, logging)
========================
- Formato de error unificado SIEMPRE:
  { "error": { "code": "STRING_CODE", "message": "human readable", "details": [...]? } }
- Status codes:
  - 400 validation
  - 401 no autenticado
  - 403 no autorizado (permiso)
  - 404 no existe
  - 409 conflicto (unique, optimistic lock)
  - 500 error interno (sin filtrar stack al cliente)
- Middlewares:
  - auth (lee cookie, valida JWT)
  - requireProjectRole(minRole)
  - requestId + logging (pino/pino-http)
- Seguridad básica:
  - helmet
  - cors restrictivo (CORS_ORIGIN)
  - rate limit en /auth/login
- Env vars:
  - DATABASE_URL
  - JWT_ACCESS_SECRET
  - JWT_REFRESH_SECRET
  - PORT
  - CORS_ORIGIN
  - NODE_ENV

========================
5) FRONTEND (React) — PANTALLAS Y FLUJOS
========================
Pantallas mínimas:
1) /login
- form email/password
- on success -> /projects

2) /projects
- lista de proyectos del usuario
- botón “Create project”
- entrar a proyecto -> /projects/:projectId/issues

3) /projects/:projectId/issues
- lista con filtros (status, assignee, search q)
- paginación cursor (Load more)
- botón “Create issue”

4) /issues/:issueId
- detalle del issue
- cambiar status / assignee (si role permite)
- comments list + add comment

Estrategia de fetching/cache (React Query):
- query keys incluyen projectId + filtros + cursor
- mutations invalidan queries relevantes (issues list y issue detail)
- manejar 401 global: si API devuelve 401 -> redirect /login

UI/UX:
- Mostrar estados: loading/error/empty
- Mensajes claros para 400/401/403/409
- Estilo simple pero prolijo (Tailwind opcional)

========================
6) TESTS (mínimo 2–4)
========================
Backend (Supertest):
- (1) login ok + /me ok
- (2) permiso: REPORTER no puede PATCH status => 403
- (3) validación: create issue sin title => 400
- (4) paginación cursor: crea N issues y verifica nextCursor y no duplicados (opcional)

Frontend (opcional):
- test de render states o de login flow (si hay tiempo)

========================
7) ORDEN DE IMPLEMENTACIÓN (commits)
========================
Commit 1: scaffold repo + tooling + env example + docker-compose Postgres
Commit 2: prisma schema + migrations + seed (1 owner, 1 project, issues)
Commit 3: auth (login/refresh/logout/me) + cookies httpOnly + rate limit
Commit 4: projects + members + RBAC middleware
Commit 5: issues CRUD + cursor pagination + índices + eventos auditoría
Commit 6: comments + events endpoints (si los exponés)
Commit 7: web scaffold + routing + login + auth handling
Commit 8: projects UI + issues list UI (filtros + load more)
Commit 9: issue detail UI + edit + comments
Commit 10: tests + README final + polish

========================
8) CRITERIOS DE ACEPTACIÓN (definición de “terminado”)
========================
- Puedo loguearme y ver mis proyectos.
- Puedo crear proyecto y agregar miembro.
- Puedo listar issues con filtros y cursor pagination estable.
- Puedo crear issue, actualizar status/assignee (según rol), y comentar.
- Los errores son consistentes (formato + status codes).
- Hay al menos 2–4 tests backend pasando.
- README explica setup (DB, env vars, comandos).

IMPORTANTE:
- No inventes endpoints extra innecesarios.
- No metas arquitectura compleja (DDD extremo) salvo que sea liviana.
- En cada módulo: typing fuerte, funciones chicas, nombres claros, logs útiles.
- Si algo es ambiguo, elegí una decisión razonable y documentala en README (“Trade-offs / Assumptions”).

Ahora: generá el código completo siguiendo esto, con archivos y estructura lista para correr.

========================
Setup & Run (Windows/PowerShell)
========================

- Prerrequisitos: Node.js 18+, pnpm 9, Docker.
- Variables de entorno: crear `.env` en `apps/api` (puedes copiar de `.env.example`).

1) Levantar Postgres (Docker):

```powershell
docker compose up -d
```

2) Instalar dependencias (monorepo):

```powershell
pnpm -w install
```

3) Generar Prisma client + migraciones + seed:

```powershell
cd apps/api; pnpm prisma:generate; pnpm prisma:migrate; pnpm prisma:seed; cd ../..
```

4) Correr API y Web en dev:

```powershell
pnpm dev:api
pnpm dev:web
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

Credenciales seed:
- owner@example.com / password123
- reporter@example.com / password123

========================
Comandos útiles
========================
- Tests backend:

```powershell
cd apps/api; pnpm test
```

- Prisma (desde `apps/api`):

```powershell
pnpm prisma:migrate
pnpm prisma:seed
```

========================
Trade-offs / Assumptions
========================
- Refresh token: JWT firmado + persistencia hash en DB con rotación en `/auth/refresh`.
- Paginación cursor: Orden estable por `created_at DESC, id DESC`; cursor es base64 `createdAt|id`.
- Optimistic locking: `PATCH /issues/:issueId` usa `updateMany` con `version` para atomicidad; si no coincide => 409.
- Generación de `number` de issue: SQL raw con `UPDATE ... RETURNING`, atómico dentro de transacción.
- Búsqueda `q`: `ILIKE` sobre `title/description` por simplicidad (FTS opcional a futuro).
- Cookies: `httpOnly`, `sameSite=lax`; `secure` según `NODE_ENV`.
