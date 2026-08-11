#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
# Migrações em SQL puro (lib/db/migrations/*.sql). O `push` acima só reflete o
# schema do Drizzle: índices, backfills e ALTERs escritos à mão passariam batido.
# É idempotente — cada arquivo roda uma vez, controlado por schema_migrations.
pnpm --filter db migrate
