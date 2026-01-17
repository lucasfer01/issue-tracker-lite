# Issue Tracker Lite — README

Una guía completa del flujo de las apps (API + Web), arquitectura, setup y referencia rápida para desarrollar y evaluar este proyecto.

## Visión General

- Monorepo PNPM con dos apps y un paquete compartido:
  - `apps/api`: API REST en Node.js + Express + TypeScript + Prisma (Postgres)
  - `apps/web`: SPA en React + Vite + TypeScript + React Query
  - `packages/shared`: Tipos compartidos (DTOs básicos)
- Autenticación con JWT (access 15m + refresh 7d) en cookies `httpOnly`.
- RBAC por proyecto: roles `OWNER`, `MAINTAINER`, `REPORTER`.
- Paginación estable por cursor en listas de issues.
- Auditoría básica de cambios de issue via `issue_events`.

## Arquitectura y Flujo End-to-End

1) Login (Web → API)
   - La pantalla `Login` envía `POST /auth/login` con email+password.
   - La API valida credenciales, firma `access_token` y `refresh_token` y los setea como cookies `httpOnly`.
   - En éxito, la Web redirige a `/projects`.

2) Proyectos (Web → API)
   - La pantalla `Projects` llama `GET /projects` para listar los proyectos del usuario (según membresías).
   - Puede crear un proyecto con `POST /projects` (el creador queda como `OWNER`).
   - Para entrar a un proyecto, navega a `/projects/:projectId/issues`.

3) Issues List (Web → API)
   - La pantalla `IssuesList` llama `GET /projects/:projectId/issues` con filtros `status`, `q` y `cursor`.
   - La API responde `{ items, nextCursor }`; si `nextCursor` existe, el botón “Load more” pide la siguiente página.

4) Issue Detail (Web → API)
   - La pantalla `IssueDetail` llama `GET /issues/:issueId` y `GET /issues/:issueId/comments`.
   - Cambios de `status` o `assignee` requieren rol `OWNER`/`MAINTAINER` y se envían con `PATCH /issues/:issueId` usando `version` para optimistic locking.
   - Los comentarios se crean con `POST /issues/:issueId/comments`.

5) Refresh / Logout
   - `POST /auth/refresh` rota el refresh token: invalida el anterior, emite uno nuevo y un nuevo access.
   - `POST /auth/logout` invalida el refresh de la cookie y limpia cookies.

## Modelo de Datos (Prisma / Postgres)

Entidades principales (ver `apps/api/prisma/schema.prisma`):
- `users`: email único, nombre, `passwordHash`.
- `projects`: `key` único, `ownerId`.
- `project_members`: relación usuario–proyecto + `role`.
- `issues`: por proyecto, con `number` secuencial, `status`, `priority`, `assigneeId?`, `reporterId`, `version`.
- `comments`: por `issue`, con `authorId` y cuerpo.
- `issue_events`: auditoría (`ISSUE_CREATED`, `STATUS_CHANGED`, etc.).
- `project_counters`: genera `number` por proyecto de forma atómica.
- `refresh_tokens`: hash del refresh + expiración y revocación.

Índices relevantes para queries:
- `issues(projectId, createdAt DESC, id DESC)` y variantes por `status` para cursor estable.
- `comments(issueId, createdAt)` para detalle.

## Backend (API) — Rutas y Comportamiento

- Autenticación (`apps/api/src/routes/auth.ts`):
  - `POST /auth/login`: valida credenciales (bcrypt), setea cookies `access_token` (15m) y `refresh_token` (7d), persiste hash del refresh.
  - `POST /auth/refresh`: verifica refresh, revoca el actual, emite nuevos tokens y actualiza cookies.
  - `POST /auth/logout`: revoca el refresh de la cookie (si corresponde) y limpia cookies.
  - Rate limit en `/auth/login` (10 req/min).

- Usuario actual:
  - `GET /me`: requiere auth; devuelve `{ id, email, name }`.

- Proyectos (`apps/api/src/routes/projects.ts`):
  - `GET /projects`: lista proyectos de membresía del usuario.
  - `POST /projects`: crea proyecto y asigna `OWNER` (en transacción), inicializa `project_counters`.
  - `GET /projects/:projectId`: requiere ser miembro; devuelve datos del proyecto.
  - `POST /projects/:projectId/members`: solo `OWNER`; agrega miembro por email y rol.

- Issues (`apps/api/src/routes/issues.ts`):
  - `GET /projects/:projectId/issues`: requiere membresía; filtros `status`, `assigneeId`, `q`; `limit` (≤50); orden estable `createdAt DESC, id DESC`; cursor base64 `{createdAt}|{id}`.
  - `POST /projects/:projectId/issues`: solo `OWNER/MAINTAINER`; genera `number` atómico y crea evento `ISSUE_CREATED`.
  - `GET /issues/:issueId`: requiere membresía del proyecto dueño del issue.
  - `PATCH /issues/:issueId`: requiere `version` (optimistic locking); cambios en `status`/`assignee` requieren rol elevado; crea eventos apropiados.

- Comentarios (`apps/api/src/routes/comments.ts`):
  - `GET /issues/:issueId/comments`: lista comentarios del issue.
  - `POST /issues/:issueId/comments`: requiere membresía; crea comentario y evento `COMMENT_ADDED`.

- Errores (formato unificado):
  - `{ "error": { "code": "STRING_CODE", "message": "...", "details": ... } }`
  - Códigos HTTP: 400 (validación), 401 (no autenticado), 403 (permiso), 404 (no existe), 409 (conflicto), 500 (interno).

## Frontend (Web) — Pantallas y Flujos

- `Login` (`apps/web/src/pages/Login.tsx`):
  - Form simple; `api.login(email, password)`; en éxito, `navigate('/projects')`.

- `Projects` (`apps/web/src/pages/Projects.tsx`):
  - Usa React Query para `api.myProjects()`.
  - Crear proyecto con `api.createProject(key, name)` y refresca la lista.
  - Navega a `/projects/:projectId/issues`.

- `IssuesList` (`apps/web/src/pages/IssuesList.tsx`):
  - Query key incluye `projectId`, `status`, `q`, `cursor`.
  - “Load more” setea `cursor` con `nextCursor` devuelto.

- `IssueDetail` (`apps/web/src/pages/IssueDetail.tsx`):
  - Muestra datos del issue; permite cambiar `status` enviando `version` actual.
  - Lista y crea comentarios; invalida queries al mutar.

- Cliente API (`apps/web/src/api/client.ts`):
  - `fetch` con `credentials: 'include'` y `BASE_URL = VITE_API_URL || http://localhost:4000`.
  - Si la respuesta es `401`, lanza error. Existe `api.onUnauthorized` para enganchar lógica de refresh si se desea.

## Setup (Windows / PowerShell)

Prerrequisitos: Node.js 18+, PNPM 9, Docker Desktop.

1) Levantar Postgres (Docker Compose en raíz):

```powershell
docker compose up -d
```

2) Instalar dependencias (monorepo):

```powershell
pnpm -w install
```

3) Variables de entorno (crear `apps/api/.env`):

```dotenv
# apps/api/.env
DATABASE_URL="postgresql://issue:issue@localhost:5432/issue_tracker?schema=public"
JWT_ACCESS_SECRET="dev-access-secret-change-me"
JWT_REFRESH_SECRET="dev-refresh-secret-change-me"
PORT="4000"
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"
```

4) Prisma client + migraciones + seed:

```powershell
cd apps/api; pnpm prisma:generate; pnpm prisma:migrate; pnpm prisma:seed; cd ../..
```

5) Correr API y Web en dev:

```powershell
pnpm dev:api
pnpm dev:web
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

Credenciales de seed:
- `owner@example.com` / `password123`
- `reporter@example.com` / `password123`

## Referencia Rápida de API (cURL)

Nota: las rutas autenticadas usan cookies; puedes probar en Postman o desde la Web.

- Login:

```powershell
curl -i -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"owner@example.com","password":"password123"}'
```

- Mis proyectos:

```powershell
curl -i http://localhost:4000/projects
```

- Crear proyecto:

```powershell
curl -i -X POST http://localhost:4000/projects -H "Content-Type: application/json" -d '{"key":"DEMO2","name":"Nuevo Proyecto"}'
```

- Listar issues con cursor:

```powershell
curl -i "http://localhost:4000/projects/<projectId>/issues?status=OPEN&limit=10"
```

- Detalle de issue:

```powershell
curl -i http://localhost:4000/issues/<issueId>
```

- Cambiar status (optimistic locking):

```powershell
curl -i -X PATCH http://localhost:4000/issues/<issueId> -H "Content-Type: application/json" -d '{"version":1,"status":"IN_PROGRESS"}'
```

- Comentarios:

```powershell
curl -i http://localhost:4000/issues/<issueId>/comments
curl -i -X POST http://localhost:4000/issues/<issueId>/comments -H "Content-Type: application/json" -d '{"body":"Comentario"}'
```

- Refresh / Logout:

```powershell
curl -i -X POST http://localhost:4000/auth/refresh
curl -i -X POST http://localhost:4000/auth/logout
```

## Testing y Lint

- Backend tests (Vitest + Supertest):

```powershell
pnpm -C apps/api test
```

- Lint y typecheck:

```powershell
pnpm run lint
pnpm run typecheck
```

## Seguridad y Errores

- Middlewares: `helmet`, `cors` con `CORS_ORIGIN`, `cookie-parser`, `pino-http` para logs, rate limit en login.
- Formato de error consistente y sin filtrar stack al cliente.
- Cookies `httpOnly`, `sameSite=lax`, `secure` en producción.

## Paginación por Cursor (Detalles)

- Orden estable: `createdAt DESC, id DESC`.
- Cursor: `base64("{createdAtISO}|{id}")`.
- Al pedir la página siguiente, usar `nextCursor` tal cual fue devuelto.

## RBAC (Permisos por Proyecto)

- `REPORTER`: ver y comentar.
- `MAINTAINER`: crear issues, cambiar `status`/`assignee`.
- `OWNER`: todo, incluyendo agregar miembros.

## Troubleshooting

- `Invalid environment variables`: revisa `apps/api/.env` y los valores requeridos en `apps/api/src/env.ts`.
- `Prisma migrate` falla: confirma que Docker Postgres está arriba (`docker compose ps`) y `DATABASE_URL` apunta a `issue_tracker`.
- `CORS` bloquea llamadas: verifica `CORS_ORIGIN` en `.env` y que la Web corre en `http://localhost:5173`.
- `401 UNAUTHENTICATED`: asegúrate de haber hecho login; las llamadas del cliente incluyen `credentials: 'include'`.

## Trade-offs y Decisiones

- Refresh token con rotación y persistencia del hash para revocación puntual.
- Generación de `number` por proyecto vía `project_counters` y SQL `UPDATE ... RETURNING` dentro de transacción.
- Optimistic locking en `PATCH /issues/:issueId` usando `version` + `updateMany` atómico.
- Búsqueda `q` por `contains` insensible (FTS opcional a futuro).
- `api.onUnauthorized` disponible para implementar refresh automático en el cliente si se requiere.

---
