---
name: User operates in production
description: How to debug "não aparece/não funciona" reports from this user
---

The user (Mateus) uses the **published production app** for real daily work (37+ projects, Jestor import history), while the dev DB has only 2-3 test projects.

**Why:** Several "bug" reports turned out to be prod-data-scale issues invisible in dev (e.g. a 37-item project dropdown without search; Jestor-only checklists blocking seeding).

**How to apply:** When the user reports something missing or broken, check the **production DB** (read-only, `environment: "production"`) and prod deployment logs first — do not assume dev data reproduces it. Remember fixes only reach them after they click Publish; say so explicitly.
