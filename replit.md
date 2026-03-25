# Workspace — Portal do Cliente Solo Energia

## Overview

Portal do Cliente da Solo Energia: um dashboard dark mode para clientes acompanharem o progresso da instalação do sistema fotovoltaico. Desenvolvido em React + Vite (frontend), Express 5 (backend API), PostgreSQL + Drizzle ORM (banco de dados).

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
│   ├── api-server/         # Express API server
│   └── solo-energia/       # React + Vite frontend (served at /)
│       └── public/
│           ├── logo-dark.png
│           ├── logo-light.png
│           └── fonts/NeueMontreal-Bold.otf
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           └── projects.ts # projects, documents, notifications tables
└── scripts/
```

## Features (MVP)

### Dashboard
- Visual stepper with 5 phases: Engenharia, Homologação, Logística, Instalação, Ativação
- Completed = green checkmark, Active = orange pulsing, Pending = gray
- Delivery tracking card with carrier + tracking code
- Quick info cards: power (kWp), city/state, estimated activation
- "Falar com Consultor" + "Ver Documentos" action buttons
- "Ativar Monitoramento Solo" CTA

### Documents
- Two sections: Pendências (upload) and Disponíveis (download)

### Notifications
- Timeline of project phase changes with unread badge

## API Endpoints

All routes under `/api`:
- `GET /api/healthz` — health check
- `GET /api/projects` — list all projects
- `GET /api/projects/:id` — get single project
- `GET /api/documents?projectId=` — list documents
- `GET /api/notifications?projectId=` — list notifications

## Database Schema

- `projects` — client projects with status_step (1-5), tracking info, location
- `documents` — pending_upload or available_download per project
- `notifications` — timeline notifications per project

## Demo Data

- Client: Lucas Oliveira, São Paulo/SP
- System: 8.5 kWp, step 3 (Logística), 60% complete
- 5 documents (3 pending, 2 downloadable)
- 5 notifications (2 unread)

## Development Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm run typecheck` — full typecheck

## TypeScript & Composite Projects

Every `lib/*` package extends `tsconfig.base.json` with `composite: true`. Root `tsconfig.json` lists all lib packages as project references.
