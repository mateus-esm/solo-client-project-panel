---
name: Financial visibility rules for portals
description: Which financial fields installers/technicians may see, and how private file access is authorized
---

**Rule:** Installer and homologation-technician APIs must never return internal financials — `valorProposto`, `custoLogistica`, `outrosCustos`, `valorServico` (client-facing value). They only see `valorFechado`, payment status/forma, and contract status. Enforce with explicit projections/omissions in `routes/installer.ts` (`toInstallerService`) and the homologacao project-detail service select.

**Why:** Mateus explicitly required teams to see only the agreed value; a code-review round caught full-row `select()`s leaking costs.

**How to apply:** Any new endpoint or field on services/projects that reaches the installer or homologacao routers needs an explicit allow-list projection, not `select()` spread.

**Private files:** `/api/storage/objects/*` is authorization-aware: admin session → all; client session → own project documents; installer session → own team's contract/comprovante + own member photos/docs. Any NEW file-bearing column must be added to that route's ownership checks or its links 403 for the intended user.
