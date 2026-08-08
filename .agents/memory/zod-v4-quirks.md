---
name: Zod v4 quirks
description: Zod v4 API differences that break intuitive schemas
---
- `z.record(enumSchema, valueSchema)` in Zod v4 requires ALL enum keys to be present (exhaustive). For sparse maps keyed by an enum, use `z.partialRecord(enumSchema, valueSchema)`.
**Why:** PATCH bodies with partial maps (e.g. per-stage dates) fail validation with "expected string, received undefined" for every missing key.
**How to apply:** any schema validating an object keyed by an enum where not all keys are required.
