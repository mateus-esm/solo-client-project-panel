---
name: Checklist template mirror
description: Pipeline checklist templates are duplicated between backend schema and frontend; keep them in sync.
---
The ERP pipeline's checklist templates (stage groups, default typed items, field definitions) live in the shared db schema package (used by the API for seeding/side-effects) AND are mirrored in the frontend's internal-api lib (used for rendering form dialogs).

**Why:** The frontend can't import the db package directly; a reviewer flagged drift risk. Until templates are served from the API, any template change must be applied to both copies.

**How to apply:** When adding/changing checklist groups, default items, or field defs — edit both files. Consider refactoring to serve templates from an API endpoint if drift causes bugs.
