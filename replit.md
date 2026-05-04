# Workspace — Portal do Cliente Solo Energia

## Overview

Portal do Cliente da Solo Energia: um dashboard dark mode para clientes acompanharem o progresso da instalação do sistema fotovoltaico. Desenvolvido em React + Vite (frontend), Express 5 (backend API), PostgreSQL + Drizzle ORM (banco de dados). Integra com o ERP Jestor via webhooks e envia notificações por WhatsApp (Evolution API) e e-mail (Resend).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (for API server)

## Brand Identity

- Primary orange: `#FF481E` (hsl 14 100% 56%)
- Dark background: `#141414` (hsl 0 0% 8%)
- Light neutral: `#E3E2DD`
- Gradient: orange → yellow
- Font: Neue Montreal Bold (loaded from `/fonts/NeueMontreal-Bold.otf`)
- Always dark mode

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── jestor.ts       # Jestor API client + phase mapper
│   │       │   ├── notifications.ts # WhatsApp (Evolution) + Email (Resend)
│   │       │   └── logger.ts
│   │       └── routes/
│   │           ├── webhooks.ts     # POST /api/webhooks/jestor/project (unified)
│   │           └── projects.ts     # CRUD + GET /api/jestor/sync/:jestorId
│   └── solo-energia/               # React + Vite frontend (served at /)
├── lib/
│   ├── api-spec/                   # OpenAPI spec + Orval codegen config
│   ├── api-client-react/           # Generated React Query hooks
│   ├── api-zod/                    # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           └── projects.ts         # projects, documents, notifications tables
└── scripts/
```

## 7-Phase Pipeline

| Step | Name | Jestor status_projeto (mapped) |
|------|------|-------------------------------|
| 1 | Onboarding | "Onboarding" |
| 2 | Projeto Técnico | "Engenharia" / "Projeto Técnico" |
| 3 | Homologação | "Homologação" |
| 4 | Logística | "Logística" / "Compras" / "Entrega" |
| 5 | Execução | "Execução" / "Instalação" / "Obra" |
| 6 | Ativação | "Ativação" / "Concluído" |
| 7 | Treinamento | "Treinamento" |

## Authentication

OTP-based passwordless login (no passwords, no magic links):

1. Client POSTs their e-mail to `POST /api/auth/request-otp` → 6-digit code sent via Resend
2. Client enters code → `POST /api/auth/verify-otp` → session token issued as httpOnly cookie `solo_session`
3. Session token stored as SHA-256 hash in `sessions` table (30-day expiry)
4. OTP codes are single-use, 10-minute expiry, stored in `otp_codes` table
5. `GET /api/auth/me` — returns `{projectId, clientName, clientEmail}` for current session
6. `POST /api/auth/logout` — deletes session, clears cookie
7. All project/document/notification endpoints are protected and scoped to the session's `projectId`

Frontend auth:
- `useAuth()` hook → checks `/api/auth/me`
- `useLogout()` hook → calls logout + clears React Query cache
- `<AuthGuard>` component wraps protected routes; redirects unauthenticated users to `/login`
- Login page: `/login` — 2-step flow (email → OTP input with 6 digit boxes)

## API Endpoints

All routes under `/api`:
- `GET /api/healthz` — health check
- `POST /api/auth/request-otp` — send 6-digit OTP to email
- `POST /api/auth/verify-otp` — verify OTP, create session cookie
- `GET /api/auth/me` — get current user (requires session)
- `POST /api/auth/logout` — invalidate session
- `GET /api/projects` — list current user's project (requires session)
- `GET /api/projects/:id` — get single project (requires session, must match)
- `GET /api/documents` — list documents for session's project (requires session)
- `GET /api/notifications` — list notifications for session's project (requires session)
- `PATCH /api/notifications/:id/read` — mark notification as read (requires session)
- `GET /api/jestor/sync/:jestorId` — pull latest data from Jestor API and update portal
- `POST /api/webhooks/jestor/project` — **unified Jestor webhook** (create + update)
  - Header: `x-webhook-secret: <WEBHOOK_SECRET env var>`
- `POST /api/chat` — streaming SSE AI assistant (GPT-5.2, project-context-aware, Portuguese)
- `GET /api/scheduling` — list scheduling requests for session's project
- `POST /api/scheduling` — create scheduling request + WhatsApp notify team

## Jestor Webhook Payload

```json
{
  "jestor_id": "string (required)",
  "name": "client name",
  "client_email": "email",
  "client_phone": "phone",
  "system_power": 8.5,
  "city": "São Paulo",
  "state": "SP",
  "status_projeto": "Engenharia",
  "data_inicio_prevista": "2026-04-10",
  "data_conclusao_prevista": "2026-06-30",
  "data_de_entrega_do_equipamento": "2026-05-15",
  "valor_projeto": 45000,
  "forma_de_pagamento": "Financiamento Solar",
  "observacoes_gerais": "...",
  "tracking_code": "BR123456789",
  "tracking_carrier": "Logística Rápida"
}
```

## Jestor Lowcode Automation

Configure automações PHP no Jestor para chamar o webhook sempre que um registro mudar:

```php
<?php
$url = "https://SEU_DOMINIO/api/webhooks/jestor/project";
$data = [
  "jestor_id"             => $record["id"],
  "name"                  => $record["name"],
  "client_email"          => $record["email"],
  "client_phone"          => $record["celular"],
  "system_power"          => $record["potencia_do_sistema"],
  "city"                  => $record["cidade"],
  "state"                 => $record["estado"],
  "status_projeto"        => $record["status_projeto"],
  "data_inicio_prevista"  => $record["data_inicio_prevista"],
  "data_conclusao_prevista" => $record["data_conclusao_prevista"],
  "data_de_entrega_do_equipamento" => $record["data_de_entrega_do_equipamento"],
  "valor_projeto"         => $record["valor_projeto"],
  "forma_de_pagamento"    => $record["forma_de_pagamento"],
  "observacoes_gerais"    => $record["observacoes"],
];
Jestor::curlCall($url, "POST", json_encode($data), [
  "Content-Type: application/json",
  "x-webhook-secret: <WEBHOOK_SECRET>",
]);
?>
```

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session secret |
| `WEBHOOK_SECRET` | Secret token sent by Jestor in `x-webhook-secret` header |
| `JESTOR_API_TOKEN` | Bearer token for Jestor API |
| `JESTOR_COMPANY_SLUG` | Jestor company slug (subdomain) |
| `WHATSAPP_API_URL` | Base URL for Evolution API (e.g. `http://72.61.219.156:8081`) |
| `WHATSAPP_API_TOKEN` | Evolution API apikey |
| `RESEND_API_KEY` | Resend API key for email notifications |
| `PORTAL_URL` | Public URL of the portal (for WhatsApp/email links) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI proxy base URL (provisioned by OpenAI integration) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI proxy key (provisioned by OpenAI integration) |
| `SOLO_TEAM_PHONE` | Team WhatsApp phone number for scheduling notifications |

## AI Chat Widget

Floating orange chat button (bottom-right) appears on all authenticated pages. Uses streaming SSE from `POST /api/chat`. The assistant:
- Speaks only Portuguese (BR)
- Has full context of the client's project (name, step, city, power, activation date)
- Answers questions about the 7-phase installation process
- Gracefully handles errors without crashing

## Scheduling (Step 4 — Logística)

When `statusStep === 4`, a scheduling card appears on the dashboard allowing clients to request a visit date. On submit, the team receives a WhatsApp notification via `SOLO_TEAM_PHONE`. Uses `SOLO_TEAM_PHONE` env var (defaults to placeholder if unset).

## Database Schema

- `projects` — all Jestor fields mapped + status_step (1-7), dates, valor_projeto, forma_pagamento
- `documents` — type (pending_upload/available_download), **category** (entrada/intra_projeto), **required** (bool)
- `notifications` — timeline per project, readable via PATCH /read
- `scheduling_requests` — project agendamentos with requestedDate, notes, status (pending/confirmed/cancelled)
- `sessions` / `otp_codes` — auth tables

## Document Categories

- **entrada** — client provides: RG/CNH, Conta de Energia, IPTU, Comprovante de Residência
- **intra_projeto** — Solo Energia generates: FSA, Formulário de Rateio, ART, Projeto de Engenharia, NF

## Development Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push-force` — push DB schema changes
- `pnpm run typecheck` — full typecheck

## TypeScript & Composite Projects

Every `lib/*` package extends `tsconfig.base.json` with `composite: true`. Root `tsconfig.json` lists all lib packages as project references.
