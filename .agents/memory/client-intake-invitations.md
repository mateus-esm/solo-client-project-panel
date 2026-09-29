---
name: Client intake invitations
description: Why project-specific form links must select and authorize a project during OTP login.
---

Form invitation links should identify the intended project, and OTP confirmation must verify that the email is authorized for that particular project rather than choosing the first associated project.

**Why:** Multiple projects can share a client or additional-access email. A generic link to the form silently opens the first matching project, so the recipient could submit electrical-project information under the wrong one.

**How to apply:** When adding other project-specific client invitations, carry project identity through authentication, validate membership on the server, and keep the form behind the existing client login.