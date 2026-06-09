# Alex Road Service — Complete Implementation Plan

**Document version:** 2.0  
**Last updated:** June 8, 2026  
**Status:** Approved for execution (pending stakeholder sign-off)  
**Owner:** Alex Road Service (business) + development lead  
**Stack:** Static web (HTML/CSS/JS) · Firebase Hosting · Auth · Firestore · Cloud Functions · Storage

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope & Release Strategy](#2-scope--release-strategy)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Implementation Phases](#5-implementation-phases)
6. [Requirements & Acceptance Criteria](#6-requirements--acceptance-criteria)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Security & Compliance](#8-security--compliance)
9. [Testing & Quality Assurance](#9-testing--quality-assurance)
10. [DevOps, CI/CD & Operations](#10-devops-cicd--operations)
11. [Financial & Legal Correctness](#11-financial--legal-correctness)
12. [RBAC Permissions Matrix](#12-rbac-permissions-matrix)
13. [Integrations — Vendors & Failure Handling](#13-integrations--vendors--failure-handling)
14. [Project Governance](#14-project-governance)
15. [Competitive & Domain Parity Roadmap](#15-competitive--domain-parity-roadmap)
16. [Go-Live Checklist](#16-go-live-checklist)
17. [Appendices](#17-appendices)

---

## 1. Executive Summary

Alex Road Service has a **production-quality UI prototype**: a public marketing website and an internal operations platform with nine modules. All operational data is mock; authentication is client-side demo only.

This plan defines the **full path to a production-grade shop management platform** aligned with industry standards for SMB commercial truck repair operations — including requirements, NFRs, security, testing, DevOps, financial correctness, governance, and a phased domain-parity roadmap.

### Success Criteria (Program Level)

| # | Criterion | Measurable Target |
|---|-----------|-------------------|
| S1 | Staff can run daily shop operations without spreadsheets | 100% of WOs created, completed, and invoiced in-platform |
| S2 | Financial records are auditable | Every invoice/payment has `createdBy`, `updatedAt`, immutable payment log |
| S3 | Platform is available during business hours | ≥ 99.5% uptime Mon–Sat 6 AM–8 PM ET |
| S4 | Lead capture works on public site | Contact form submissions stored + email alert within 60s |
| S5 | Role separation enforced | Technician cannot modify invoice totals (verified by rules + UAT) |
| S6 | Stakeholder sign-off | Owner + Office Manager + Lead Tech approve UAT before prod cutover |

### Document Hierarchy

| Artifact | Purpose |
|----------|---------|
| **This plan** | Master delivery document |
| **PRD Backlog** (Appendix A) | User stories + Given/When/Then |
| **NFR Spec** (Section 7) | Performance, availability, retention |
| **RBAC Matrix** (Section 12) | Drives UI + Firestore rules |
| **Test Plan** (Section 9) | QA gates per phase |
| **Runbook** (Section 10) | Ops, incidents, backups |

---

## 2. Scope & Release Strategy

### In Scope — Release 1.0 (MVP Production)

- Firebase Auth (email/password) with 3 roles
- Firestore persistence for all 9 ops modules
- Contact form → Firestore + email alert
- Dashboard live KPIs
- PDF invoices (basic)
- Security rules aligned with RBAC matrix
- Staging + production environments
- UAT with real staff

### In Scope — Release 1.1 (Hardening)

- Global search, notifications, exports (CSV/PDF)
- Password reset, audit log viewer
- Error monitoring (Sentry)
- Automated CI/CD

### In Scope — Release 2.0 (Domain Expansion)

- Customer portal (estimate approval, online pay)
- Stripe payment links
- QuickBooks export/sync
- Photo documentation on every WO
- DOT inspection checklists
- VIN decode

### Out of Scope (v1)

- Native iOS/Android apps
- Multi-location / bay scheduling
- GPS dispatch / telematics
- Parts vendor API ordering (NAPA, etc.)
- Full SOC 2 certification (audit trail foundations only)

### Stakeholder Sign-Off Requirements

| Milestone | Sign-off By | Deliverable |
|-----------|-------------|-------------|
| M0 — Plan approval | Owner | This document |
| M1 — Auth + data layer | Dev lead + Owner | Staging login, seed data |
| M2 — Core workflows | Office Manager + Lead Tech | UAT scripts 1–5 pass |
| M3 — Financial module | Owner + Office Manager | UAT scripts 6–8 pass |
| M4 — Go-live | Owner | Go-live checklist 100% |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Firebase Hosting                                                 │
│  ├── Public site (/, /contact, /services, …)                     │
│  └── Ops platform (/app/*) — auth-gated                          │
├──────────────────────────────────────────────────────────────────┤
│  Firebase Auth          Staff sessions, custom claims / roles     │
│  Firestore              All operational + audit data            │
│  Cloud Storage          PDFs, WO photos, receipts               │
│  Cloud Functions        PDF gen, email, webhooks, scheduled jobs  │
│  Firebase Analytics     Public site + ops usage                   │
│  App Check              Abuse protection on client writes           │
├──────────────────────────────────────────────────────────────────┤
│  External (v1.1+)       SendGrid/Resend · Twilio · Stripe        │
└──────────────────────────────────────────────────────────────────┘
```

### Environments

| Env | Firebase Project | Purpose |
|-----|------------------|---------|
| `dev` | `alex-road-dev` | Local + feature branches |
| `staging` | `alex-road-staging` | UAT, pre-prod validation |
| `prod` | `launchpage-alex-roadservice` | Live business |

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Keep vanilla JS (v1) | Matches existing codebase; avoids rewrite |
| Real-time updates | Firestore `onSnapshot` | Dashboard/live lists within NFR targets |
| ID generation | Cloud Function counters | Sequential, gap-free invoice/WO numbers |
| Secrets | Cloud Functions env only | No API keys in client JS |
| Offline (v1) | Read cache + write queue (PWA lite) | Field techs; full offline in v2 |

---

## 4. Data Model

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | Staff profiles synced from Auth |
| `customers` | Fleet + owner-operator accounts |
| `trucks` | Units linked to customers |
| `work_orders` | Job lifecycle + line items |
| `estimates` | Pre-work quotes |
| `invoices` | Billing documents |
| `payments` | Payment records (immutable) |
| `inventory` | Parts catalog + qty |
| `inventory_transactions` | Stock audit trail |
| `contact_submissions` | Public lead form |
| `notifications` | Per-user alerts |
| `settings` | Shop config (rates, tax, prefixes) |
| `audit_log` | Sensitive action log (append-only) |
| `counters` | Sequential ID generation |

### Standard Document Fields (all financial entities)

```javascript
{
  createdAt: Timestamp,
  createdBy: string,      // uid
  updatedAt: Timestamp,
  updatedBy: string,
  version: number,        // optimistic concurrency
  deletedAt: Timestamp?,  // soft delete only
  deletedBy: string?
}
```

### Status Flows

**Work Order:** `Open` → `In Progress` → `Waiting Parts` → `In Progress` → `Completed` → `Invoiced`  
**Estimate:** `Pending` → `Sent` → `Approved` | `Declined` → (Approved) → `Work Order`  
**Invoice:** `Draft` → `Sent` → `Partially Paid` → `Paid` | `Overdue` | `Written Off`

---

## 5. Implementation Phases

| Phase | Name | Duration | Gate |
|-------|------|----------|------|
| 0 | Foundation & DevOps | 1 wk | Firebase projects + staging deploy |
| 1 | Auth & RBAC | 1 wk | UAT-AUTH pass |
| 2 | Data service layer | 1 wk | CRUD smoke tests pass |
| 3 | Customers | 0.5 wk | UAT-CUST pass |
| 4 | Trucks / Fleet | 0.5 wk | UAT-TRUCK pass |
| 5 | Work Orders | 1.5 wk | UAT-WO pass |
| 6 | Estimates | 1 wk | UAT-EST pass |
| 7 | Invoices & Payments | 1.5 wk | UAT-FIN pass |
| 8 | Inventory | 1 wk | UAT-INV pass |
| 9 | Dashboard | 1 wk | KPI accuracy verified |
| 10 | Reports & exports | 1 wk | Export files validated |
| 11 | Cross-cutting (search, notifs) | 1 wk | UAT-XCUT pass |
| 12 | Public site completion | 0.5 wk | Contact form E2E pass |
| 13 | Integrations | 1–2 wk | Email + PDF in staging |
| 14 | Security hardening & launch | 1 wk | Go-live checklist |

**Total:** ~10–12 weeks (1 FTE) · ~6 weeks (2 FTE)

---

## 6. Requirements & Acceptance Criteria

Format: **User Story** → **Acceptance Criteria (Given/When/Then)**

### Epic E1 — Authentication (Phase 1)

**US-E1-01** — Staff login  
- **Given** a registered staff user on `/login.html`  
- **When** they enter valid email/password and submit  
- **Then** they are redirected to `/app/dashboard.html` within 3 seconds  
- **And** their name and role appear in the sidebar  

**US-E1-02** — Unauthorized access blocked  
- **Given** an unauthenticated user  
- **When** they navigate to any `/app/*` URL  
- **Then** they are redirected to `/login.html`  

**US-E1-03** — Role-based nav  
- **Given** a user with role `Technician`  
- **When** the dashboard loads  
- **Then** Invoices, Payments, Reports, and Settings nav items are hidden  

**US-E1-04** — Password reset  
- **Given** a user on the login page  
- **When** they click "Forgot password?" and submit their email  
- **Then** Firebase sends a reset email within 60 seconds  

**US-E1-05** — Logout  
- **Given** an authenticated user  
- **When** they click Sign Out  
- **Then** session is cleared and they cannot access `/app/*` without re-login  

---

### Epic E2 — Customers (Phase 3)

**US-E2-01** — List customers  
- **Given** an Office or Admin user on Customers page  
- **When** the page loads  
- **Then** all active customers appear within 500ms (p95, ≤500 records)  

**US-E2-02** — Add customer  
- **Given** valid form data in the Add Customer modal  
- **When** the user clicks Save  
- **Then** a new customer document is created in Firestore  
- **And** the table updates without full page reload  
- **And** a success toast appears  

**US-E2-03** — Customer detail  
- **Given** a customer with trucks and work history  
- **When** the user opens the customer detail page  
- **Then** they see profile, linked trucks, WOs, invoices, and lifetime spend  

**US-E2-04** — Deactivate customer  
- **Given** an Admin user  
- **When** they deactivate a customer  
- **Then** `status` becomes `Inactive` and the customer is hidden from default list  
- **And** historical WOs/invoices remain accessible  

**US-E2-05** — Technician read-only  
- **Given** a Technician  
- **When** they view Customers  
- **Then** they can search and view but cannot add, edit, or deactivate  

---

### Epic E3 — Trucks / Fleet (Phase 4)

**US-E3-01** — Register truck  
- **Given** an existing customer  
- **When** Office adds a truck with unit, VIN, make, model  
- **Then** the truck is linked via `customerId` and appears on customer detail  

**US-E3-02** — PM due alert  
- **Given** a truck with `nextPM` within 30 days  
- **When** the dashboard loads  
- **Then** the truck appears in the PM alerts widget  

**US-E3-03** — New WO from truck  
- **Given** a truck detail page  
- **When** the user clicks "New WO"  
- **Then** the WO form opens with customer and truck pre-filled  

**US-E3-04** — VIN validation  
- **Given** an invalid VIN format  
- **When** the user submits the truck form  
- **Then** inline validation blocks save with a clear error message  

---

### Epic E4 — Work Orders (Phase 5)

**US-E4-01** — Create work order  
- **Given** customer, truck, service type, and description  
- **When** Office or Admin creates a WO  
- **Then** a WO is saved with status `Open` and sequential ID `WO-YYYY-NNNN`  

**US-E4-02** — Assign technician  
- **Given** an Open WO  
- **When** Admin or Office assigns a technician  
- **Then** `techId` updates and the WO appears on that tech's filtered list  

**US-E4-03** — Status update (mobile)  
- **Given** a Technician on a mobile device with connectivity  
- **When** they change WO status from `In Progress` to `Waiting Parts`  
- **Then** the change persists to Firestore within 2 seconds  
- **And** the dashboard open-WO count updates within 5 seconds  

**US-E4-04** — Line items & totals  
- **Given** labor hours and parts with quantities  
- **When** line items are saved  
- **Then** `labor`, `parts`, and `total` are calculated per shop settings (labor rate, markup)  

**US-E4-05** — Parts deduction  
- **Given** a WO marked `Completed` with parts line items linked to inventory  
- **When** completion is confirmed  
- **Then** inventory quantities decrement and `inventory_transactions` records are created  

**US-E4-06** — Concurrent edit  
- **Given** two users editing the same WO  
- **When** the second user saves with a stale `version`  
- **Then** they see a conflict message and can refresh or merge  

**US-E4-07** — WO photos  
- **Given** a Technician on a WO detail page  
- **When** they upload a photo  
- **Then** the image is stored in Cloud Storage and linked on the WO  

---

### Epic E5 — Estimates (Phase 6)

**US-E5-01** — Create estimate  
- **Given** customer, truck, and line items  
- **When** Office creates an estimate  
- **Then** it is saved with status `Pending` and ID `EST-YYYY-NNNN`  

**US-E5-02** — Send estimate  
- **Given** a Pending estimate  
- **When** Office clicks Send  
- **Then** status becomes `Sent`, PDF is generated, and email is dispatched (or queued with retry)  

**US-E5-03** — Approve / decline  
- **Given** a Sent estimate  
- **When** Office records customer approval or decline  
- **Then** status updates to `Approved` or `Declined` with `statusChangedAt` and `statusChangedBy`  

**US-E5-04** — Convert to WO  
- **Given** an Approved estimate  
- **When** Office clicks "Create WO"  
- **Then** a new WO is created with copied line items and `estimateId` reference  
- **And** estimate status becomes `Converted`  

---

### Epic E6 — Invoices & Payments (Phase 7)

**US-E6-01** — Generate invoice from WO  
- **Given** a Completed WO not yet invoiced  
- **When** Office clicks Generate Invoice  
- **Then** an invoice is created with totals from WO, due date = invoice date + payment terms (default 14 days)  

**US-E6-02** — Invoice PDF  
- **Given** a Sent invoice  
- **When** user downloads PDF  
- **Then** PDF includes shop legal name, address, NJ tax ID (if applicable), line items, terms, and sequential invoice number  

**US-E6-03** — Record payment  
- **Given** an unpaid invoice  
- **When** Office records a payment (full or partial)  
- **Then** a payment document is created (immutable)  
- **And** invoice status becomes `Partially Paid` or `Paid` accordingly  

**US-E6-04** — Overdue detection  
- **Given** an invoice past due date with balance > 0  
- **When** the daily scheduled function runs  
- **Then** status becomes `Overdue` and notifications are created for Office/Admin  

**US-E6-05** — Write-off  
- **Given** an Admin user and an overdue invoice  
- **When** they write off the balance  
- **Then** status becomes `Written Off` with reason and audit log entry  
- **And** the original payment history is unchanged  

---

### Epic E7 — Inventory (Phase 8)

**US-E7-01** — Stock status  
- **Given** a part with `qty < min`  
- **When** the inventory list loads  
- **Then** status displays `Low`; `qty === 0` displays `Out of Stock`  

**US-E7-02** — Adjust stock  
- **Given** an Admin or Office user  
- **When** they adjust quantity with reason  
- **Then** `qty` updates and an `inventory_transactions` entry is appended  

**US-E7-03** — Reorder list export  
- **Given** parts below minimum  
- **When** user exports reorder list  
- **Then** a CSV downloads with part number, description, qty, min, vendor (if set)  

---

### Epic E8 — Dashboard & Reports (Phases 9–10)

**US-E8-01** — Live KPIs  
- **Given** operational data in Firestore  
- **When** Admin opens dashboard  
- **Then** open WOs, MTD revenue, outstanding AR, and low-stock counts match query results exactly  

**US-E8-02** — Reports date range  
- **Given** a selected date range  
- **When** user applies the filter  
- **Then** charts and tables reflect only data within that range  

**US-E8-03** — Export CSV  
- **Given** a report table  
- **When** user clicks Export CSV  
- **Then** a valid CSV file downloads with headers and all visible rows  

---

### Epic E9 — Public Website (Phase 12)

**US-E9-01** — Contact form submission  
- **Given** a visitor completes the contact form  
- **When** they submit  
- **Then** data is saved to `contact_submissions` including company, truck, and location fields  
- **And** shop receives email alert within 60 seconds (p95)  

**US-E9-02** — Spam protection  
- **Given** App Check + rate limiting enabled  
- **When** a bot submits 10 forms in 1 minute  
- **Then** subsequent submissions are rejected  

---

### Epic E10 — Cross-Cutting (Phase 11)

**US-E10-01** — Global search  
- **Given** a query matching a customer name, WO ID, or invoice ID  
- **When** user types in global search  
- **Then** relevant results appear in dropdown within 300ms (client-side index)  

**US-E10-02** — Notifications  
- **Given** overdue invoices or low stock  
- **When** user opens notification bell  
- **Then** unread items are listed; marking read updates Firestore  

---

## 7. Non-Functional Requirements

### 7.1 Availability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-A1 | Ops platform uptime during business hours | ≥ 99.5% Mon–Sat 6 AM–8 PM ET |
| NFR-A2 | Public website uptime | ≥ 99.9% (Firebase Hosting SLA) |
| NFR-A3 | Planned maintenance window | Sundays 2–4 AM ET; announced 48h prior |
| NFR-A4 | RTO (Recovery Time Objective) | ≤ 4 hours for full Firestore restore |
| NFR-A5 | RPO (Recovery Point Objective) | ≤ 1 hour (Firestore PITR or hourly export) |

### 7.2 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P1 | First contentful paint (public pages) | < 1.5s on 4G mobile |
| NFR-P2 | Ops page interactive | < 2s on desktop broadband |
| NFR-P3 | List query (≤500 docs, filtered) | p95 < 500ms |
| NFR-P4 | Real-time dashboard update after WO change | < 5s to all connected clients |
| NFR-P5 | Contact form submit acknowledgment | < 3s to user |
| NFR-P6 | PDF generation | < 10s (async; user sees progress) |

### 7.3 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-S1 | Concurrent staff users | 15 (design); 50 (max without arch change) |
| NFR-S2 | Customers | 5,000 |
| NFR-S3 | Work orders / year | 3,000 |
| NFR-S4 | Inventory SKUs | 2,000 |
| NFR-S5 | Storage (photos + PDFs) | 50 GB year 1 |

### 7.4 Concurrency & Consistency

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-C1 | Optimistic locking | `version` field on WO, invoice, estimate |
| NFR-C2 | Idempotent payments | `paymentIntentId` or client-generated `idempotencyKey` |
| NFR-C3 | Sequential IDs | Cloud Function transaction on `counters` collection |
| NFR-C4 | No double-invoice | WO flag `invoiced: true` set in same transaction as invoice create |

### 7.5 Offline & Field Use

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-O1 | Read cached WO on spotty connection | Firestore persistence enabled (v1.1) |
| NFR-O2 | Queue status updates offline | Writes queued; sync within 30s of reconnect (v2) |
| NFR-O3 | Mobile-usable WO detail | Responsive; touch targets ≥ 44px (WCAG) |

### 7.6 Data Retention

| Data Type | Retention | Basis |
|-----------|-----------|-------|
| Invoices & payments | 7 years | NJ tax / IRS record-keeping |
| Work orders & estimates | 7 years | Service history / disputes |
| DOT inspection records | 14 months minimum | FMCSA §396.3(c) — retain 1 year at carrier; shop copies 7 years recommended |
| Contact form leads | 2 years | Marketing; delete on request |
| Audit log | 7 years | Financial compliance |
| Notifications | 90 days | Operational |
| Session/auth logs | 1 year | Security |
| Deleted records (soft) | Permanent tombstone | `deletedAt` only; no hard delete of financial docs |

### 7.7 Accessibility

| ID | Requirement | Standard |
|----|-------------|----------|
| NFR-AC1 | Public website | WCAG 2.1 Level AA |
| NFR-AC2 | Ops platform | WCAG 2.1 Level AA (staff-facing) |
| NFR-AC3 | Keyboard navigation | All modals, tables, nav operable without mouse |
| NFR-AC4 | Color contrast | ≥ 4.5:1 body text; status chips have text labels not color-only |

---

## 8. Security & Compliance

### 8.1 Threat Model

| Threat | Actor | Impact | Mitigation |
|--------|-------|--------|------------|
| T1 — Contact form spam | Bot | Cost, noise | App Check, rate limit (10/hr/IP), honeypot field |
| T2 — Credential stuffing | External | Account takeover | Firebase Auth rate limits, strong password policy (8+ chars), optional MFA for Admin (v1.1) |
| T3 — Unauthorized data read | Former employee | PII/financial leak | Auth required; revoke user on termination; rules enforce role |
| T4 — Invoice tampering | Malicious insider | Financial fraud | Immutable payments; invoice amount changes logged; Technician cannot edit invoices |
| T5 — XSS | Attacker | Session theft | Sanitize user input; CSP headers; no `innerHTML` with raw user data |
| T6 — API key exposure | Developer error | Abuse of paid APIs | Secrets only in Cloud Functions; Stripe webhook secret server-side |
| T7 — Firestore rule bypass | Attacker | Data breach | Rules tested in CI; deny-by-default; no client writes to `counters` or `audit_log` |
| T8 — File upload malware | User | Storage abuse | Validate MIME; max 10MB; images only for WO photos |

### 8.2 Firestore Security Rules Principles

1. **Deny by default** — all collections require `request.auth != null` except `contact_submissions` write.
2. **Role from custom claims** — `request.auth.token.role in ['admin','office','technician']`.
3. **Field-level protection** — clients cannot set `role` on `users` or `createdBy` on payments.
4. **Immutable payments** — `allow update, delete: if false` on `payments`.
5. **Audit log append-only** — create via Cloud Function only.

### 8.3 PCI-DSS Scope (Stripe)

| Item | Approach |
|------|----------|
| Card data | Never touch platform — Stripe Checkout / Payment Links only |
| SAQ type | SAQ A (card data on Stripe-hosted pages) |
| Platform stores | `stripePaymentIntentId`, amount, status — no PAN/CVV |
| Webhook verification | `stripe-signature` validated in Cloud Function |

### 8.4 Audit Trail (SOC 2 Foundations)

Log to `audit_log` (via Cloud Function) for:

- Invoice created, sent, amount changed, written off
- Payment recorded or refunded
- User role changed
- Customer/truck deleted (soft)
- Settings changed (tax rate, labor rate)
- Failed login attempts (Firebase Auth + optional export)

Each entry: `{ action, entityType, entityId, userId, timestamp, before, after, ip }`.

### 8.5 Secrets Management

| Secret | Location | Rotation |
|--------|----------|----------|
| SendGrid API key | Functions config / Secret Manager | 90 days |
| Stripe secret + webhook | Secret Manager | On compromise |
| Twilio auth | Secret Manager | 90 days |
| Firebase config (public) | Client — apiKey is public by design; protect via App Check + rules |

### 8.6 OWASP Top 10 Checklist (Web)

| Risk | Mitigation |
|------|------------|
| A01 Broken Access Control | RBAC matrix + rules + UAT |
| A02 Cryptographic Failures | HTTPS only; Firebase defaults |
| A03 Injection | Parameterized Firestore queries; no eval |
| A04 Insecure Design | Threat model above |
| A05 Security Misconfiguration | Separate prod/staging; no debug in prod |
| A06 Vulnerable Components | `npm audit` on Functions; CDN integrity hashes |
| A07 Auth Failures | Firebase Auth; session timeout 8h (office), 12h (admin) |
| A08 Data Integrity | Immutable payments; version fields |
| A09 Logging Failures | Audit log + Cloud Logging |
| A10 SSRF | Functions validate outbound URLs whitelist |

### 8.7 WCAG 2.1 (Key Items)

- Form labels and `aria-describedby` on errors
- Focus trap in modals
- Skip-to-content link on public pages
- Table headers scoped with `<th scope="col">`
- Alt text on all content images

### 8.8 DOT / Fleet Compliance

- Store DOT inspection date, inspector, result on WO when service type = DOT Inspection
- Retain inspection records per NFR retention table
- Export inspection history per truck for fleet customers (v2)

---

## 9. Testing & Quality Assurance

### 9.1 Test Pyramid

```
        ┌─────────┐
        │   E2E   │  10% — Playwright: critical paths
        ├─────────┤
        │ Integr. │  30% — Rules unit tests, Functions tests
        ├─────────┤
        │  Unit   │  60% — totals, IDs, tax, status transitions
        └─────────┘
```

### 9.2 Unit Tests

| Module | Tests |
|--------|-------|
| `utils.js` | Currency format, date parse, tax calc |
| `data-service.js` | Mock Firestore: CRUD, filters |
| ID generation | Sequential, year rollover, no duplicates |
| WO totals | Labor × rate + parts × markup |
| Invoice status | Partial payment → Partially Paid; full → Paid |
| Inventory status | qty thresholds → Low / Out of Stock |

**Tool:** Vitest (Functions) + browser-compatible test runner or Node for shared utils.

### 9.3 Integration Tests

| Area | Tests |
|------|-------|
| Firestore rules | `@firebase/rules-unit-testing` — per RBAC matrix row |
| Cloud Functions | PDF gen, email send (mocked), Stripe webhook idempotency |
| Counter transaction | Concurrent invoice create → unique sequential IDs |

### 9.4 E2E Tests (Playwright)

| ID | Flow |
|----|------|
| E2E-01 | Login as Admin → dashboard loads |
| E2E-02 | Create customer → create truck → create WO → assign tech → complete |
| E2E-03 | Approved estimate → convert to WO |
| E2E-04 | Completed WO → invoice → record payment → status Paid |
| E2E-05 | Technician cannot access Invoices (redirect or 403) |
| E2E-06 | Contact form submit → document in Firestore (emulator) |
| E2E-07 | Logout → cannot access /app |

### 9.5 UAT Scripts (Staging — Real Staff)

| Script | Role | Steps | Pass Criteria |
|--------|------|-------|---------------|
| UAT-AUTH | All | Login, wrong password, logout, reset password | All US-E1 pass |
| UAT-CUST | Office | Add customer, search, view detail, deactivate | US-E2 pass |
| UAT-TRUCK | Office | Add truck, PM alert visible, New WO | US-E3 pass |
| UAT-WO | Tech + Office | Create, assign, status changes on phone, complete | US-E4 pass |
| UAT-EST | Office | Create, send, approve, convert | US-E5 pass |
| UAT-FIN | Office + Owner | Invoice, partial pay, full pay, overdue, write-off | US-E6 pass |
| UAT-INV | Office | Add part, adjust stock, reorder CSV | US-E7 pass |
| UAT-XCUT | Admin | Search, notifications, export report | US-E10 pass |

### 9.6 Regression Strategy

| Trigger | Tests Run |
|---------|-----------|
| Every PR | Unit + rules integration |
| Merge to `main` | + E2E on staging |
| Pre-prod deploy | Full UAT script suite |
| Post-deploy smoke | E2E-01, E2E-04, E2E-06 on prod (read-only where needed) |

### 9.7 Definition of Done (Per Phase)

- [ ] All user stories for phase accepted
- [ ] Unit tests ≥ 80% coverage on new logic
- [ ] Rules tests cover all new permissions
- [ ] E2E paths for phase pass on staging
- [ ] No P0/P1 open bugs
- [ ] Accessibility spot-check (keyboard + contrast)
- [ ] Staging UAT sign-off recorded
- [ ] Runbook updated if ops behavior changed

---

## 10. DevOps, CI/CD & Operations

### 10.1 Git Branching

```
main          ← production releases only
├── staging   ← pre-prod integration
└── feature/* ← PRs → staging → main
```

- PR required for `staging` and `main`
- Squash merge preferred
- Tag releases: `v1.0.0`, `v1.1.0`

### 10.2 CI/CD Pipeline (GitHub Actions)

| Stage | On | Actions |
|-------|-----|---------|
| Lint & test | PR | `npm test` (functions), rules tests |
| Deploy staging | Merge to `staging` | `firebase deploy --project staging` |
| E2E | Post staging deploy | Playwright against staging URL |
| Deploy prod | Merge to `main` + tag | Manual approval gate → `firebase deploy --project prod` |

### 10.3 Monitoring & Alerting

| Signal | Tool | Alert |
|--------|------|-------|
| JS errors (ops) | Sentry | Email Admin on new issue |
| Function errors | Cloud Logging + alert policy | > 5 errors / 5 min |
| Failed payments / webhooks | Custom log metric | Immediate email |
| Firestore rule denials spike | Log-based metric | > 20 / hour |
| Uptime | Firebase Hosting / external ping | Downtime > 5 min |

### 10.4 Backup & Disaster Recovery

| Component | Method | Frequency |
|-----------|--------|-----------|
| Firestore | Point-in-time recovery (enable PITR) | Continuous |
| Firestore | Scheduled export to Cloud Storage | Daily |
| Storage (PDFs/photos) | Versioning + cross-region (optional) | Continuous |
| Auth users | Firebase Auth export | Weekly |

**Runbook:** `docs/RUNBOOK.md` — restore steps, contact list, escalation.

### 10.5 Incident Response

| Severity | Example | Response |
|----------|---------|----------|
| P0 | Prod down, cannot invoice | Fix within 4h; post-mortem |
| P1 | Payments failing | Fix within 8h |
| P2 | Single module broken | Fix within 2 business days |
| P3 | Cosmetic | Next sprint |

---

## 11. Financial & Legal Correctness

### 11.1 New Jersey Sales Tax

| Rule | Implementation |
|------|----------------|
| Taxable | Parts sales to customers (default taxable) |
| Labor | Generally non-taxable for repair labor in NJ — **confirm with shop accountant** |
| Tax rate | Configurable in `settings` (default 6.625% NJ state; local rates if applicable) |
| Tax-exempt fleets | `customer.taxExempt: true` + certificate on file → parts tax = 0 |
| Display | Invoice shows subtotal, tax line, total |

### 11.2 Invoice Numbering

| Rule | Implementation |
|------|----------------|
| Format | `INV-YYYY-NNNN` (e.g. `INV-2026-0011`) |
| Sequential | Cloud Function atomic counter per year |
| No gaps | Counter only increments; voided invoices keep number with status `Void` |
| No reuse | Deleted invoices are voided, never hard-deleted |
| Legal fields on PDF | Legal business name, address, phone, email, invoice #, date, due date, customer, line items, tax, total, payment terms |

### 11.3 Payment Terms & Methods

| Setting | Default |
|---------|---------|
| Payment terms | Net 14 |
| Accepted methods | Cash, Check, Card, ACH |
| Partial payments | Allowed; balance tracked on invoice |
| Overpayment | Credit balance on customer account (v1.1) or refund record |

### 11.4 Credits, Refunds & Write-Offs

| Action | Who | Behavior |
|--------|-----|----------|
| Refund | Admin | Negative payment record linked to original; audit log |
| Credit memo | Office | Applied to future invoice (v1.1) |
| Write-off | Admin | Invoice → `Written Off`; reason required; AR report updated |

### 11.5 Labor Rate & Markup Rules

| Setting | Location | Default |
|---------|----------|---------|
| Shop labor rate ($/hr) | `settings.laborRate` | TBD by owner |
| Parts markup % | `settings.partsMarkup` | TBD (e.g. 40%) |
| Emergency surcharge % | `settings.emergencyMultiplier` | Optional (e.g. 1.5× labor) |
| Minimum labor charge | `settings.minLaborCharge` | Optional |

**Calculation:**  
`laborTotal = max(hours × laborRate × emergencyMultiplier, minLaborCharge)`  
`partsTotal = sum(partPrice × qty)` where `partPrice = cost × (1 + partsMarkup)`

### 11.6 PDF as Legal Document

Required footer content:

- Payment terms and late fee policy (if any)
- "Thank you for your business"
- Shop license / EIN (if owner provides)
- Remit-to address
- Page numbers on multi-page invoices

---

## 12. RBAC Permissions Matrix

**Roles:** `Admin` · `Office` · `Technician`  
**Legend:** ✓ = allowed · ✗ = denied · R = read only · O = own records only

### Customers

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View list | ✓ | ✓ | R |
| View detail | ✓ | ✓ | R |
| Create | ✓ | ✓ | ✗ |
| Edit | ✓ | ✓ | ✗ |
| Deactivate | ✓ | ✗ | ✗ |
| Delete (hard) | ✗ | ✗ | ✗ |

### Trucks

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View list | ✓ | ✓ | R |
| Create / Edit | ✓ | ✓ | ✗ |
| Deactivate | ✓ | ✗ | ✗ |

### Work Orders

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View all | ✓ | ✓ | O |
| Create | ✓ | ✓ | ✗ |
| Edit description / line items | ✓ | ✓ | O (assigned only) |
| Change status | ✓ | ✓ | O (assigned only) |
| Assign technician | ✓ | ✓ | ✗ |
| Delete / cancel | ✓ | ✓ | ✗ |
| Upload photos | ✓ | ✓ | O |
| Generate invoice | ✓ | ✓ | ✗ |

### Estimates

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View | ✓ | ✓ | R |
| Create / Edit | ✓ | ✓ | ✗ |
| Send to customer | ✓ | ✓ | ✗ |
| Approve / Decline | ✓ | ✓ | ✗ |
| Convert to WO | ✓ | ✓ | ✗ |

### Invoices

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View | ✓ | ✓ | ✗ |
| Create from WO | ✓ | ✓ | ✗ |
| Edit amount / line items | ✓ | ✓ | ✗ |
| Send / download PDF | ✓ | ✓ | ✗ |
| Void | ✓ | ✗ | ✗ |
| Write off | ✓ | ✗ | ✗ |

### Payments

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View | ✓ | ✓ | ✗ |
| Record payment | ✓ | ✓ | ✗ |
| Refund | ✓ | ✗ | ✗ |
| Delete | ✗ | ✗ | ✗ |

### Inventory

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| View | ✓ | ✓ | R |
| Add / Edit parts | ✓ | ✓ | ✗ |
| Adjust stock | ✓ | ✓ | ✗ |
| Reorder export | ✓ | ✓ | ✗ |

### Reports & Dashboard

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| Dashboard | ✓ | ✓ | ✓ (limited widgets) |
| Financial reports | ✓ | ✓ | ✗ |
| Export | ✓ | ✓ | ✗ |

### Settings & Users

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| Shop settings | ✓ | ✗ | ✗ |
| Manage users / roles | ✓ | ✗ | ✗ |
| View audit log | ✓ | ✗ | ✗ |
| Contact submissions | ✓ | ✓ | ✗ |

### Public Site

| Action | Admin | Office | Technician |
|--------|-------|--------|------------|
| Contact form submit | Public (unauthenticated) | — | — |

---

## 13. Integrations — Vendors & Failure Handling

### 13.1 Vendor Selection Criteria

| Integration | Recommended | Criteria |
|-------------|-------------|----------|
| Email | Resend or SendGrid | Deliverability, template support, <$20/mo at volume, simple API |
| SMS | Twilio | Reliability, NJ local number, pay-as-you-go |
| Payments | Stripe | SAQ A, Payment Links, webhook docs, 2.9% + 30¢ acceptable |
| PDF | `@react-pdf/renderer` or `pdfkit` in Functions | Server-side, template control |
| Error tracking | Sentry | Free tier, source maps |
| Accounting (v2) | QuickBooks Online API | Owner already uses QBO (confirm) |

### 13.2 Email

| Scenario | Behavior |
|----------|----------|
| Send succeeds | Log `messageId`; estimate/invoice status updated |
| Send fails (5xx) | Retry 3× exponential backoff |
| Send fails permanent | Queue in `failed_emails` collection; alert Office; manual resend UI |
| Rate limit | Max 100 emails/day (configurable) |

### 13.3 SMS (Twilio)

| Scenario | Behavior |
|----------|----------|
| WO status → customer notify (opt-in) | Optional v2 |
| Send fails | Log failure; do not block WO status change |
| Cost cap | $50/month alert; $100/month hard stop without Admin override |

### 13.4 Stripe Webhooks

| Event | Handler | Idempotency |
|-------|---------|-------------|
| `checkout.session.completed` | Create payment record; mark invoice Paid | Store `event.id`; skip if processed |
| `payment_intent.payment_failed` | Log + notify Office | Same |
| Invalid signature | 400 response; alert | — |

### 13.5 VIN Decode (v2)

| Vendor | Fallback |
|--------|----------|
| NHTSA vPIC API (free) | Manual entry if API down; no block on save |

---

## 14. Project Governance

### 14.1 RACI

| Activity | Owner (Business) | Office Mgr | Lead Tech | Dev Lead |
|----------|------------------|------------|-----------|----------|
| Scope approval | A | C | C | R |
| UAT execution | I | A/R | A/R | S |
| Production deploy | A | I | I | R |
| Settings (tax, rates) | A | R | I | S |
| User provisioning | A | R | I | S |
| Incident response | A | I | I | R |
| Vendor contracts (Stripe, etc.) | A | C | I | S |

**R** = Responsible · **A** = Accountable · **C** = Consulted · **I** = Informed · **S** = Supports

### 14.2 Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Firebase cost overrun | Medium | Medium | Budget alerts; indexes reviewed; pagination |
| R2 | Data migration errors from mock | Medium | High | Seed script + validation; parallel run on staging |
| R3 | Key person dependency (single dev) | High | High | Document runbook; code review; bus factor plan |
| R4 | Staff resistance to new system | Medium | High | UAT early; train per role; parallel run 2 weeks |
| R5 | Incorrect tax/labor rules | Low | High | Accountant review before go-live |
| R6 | Scope creep (Fullbay parity) | High | Medium | v2 roadmap; change control process |
| R7 | Offline field failure | Medium | Medium | Firestore persistence v1.1; set expectations |
| R8 | Security rule misconfiguration | Low | Critical | Rules CI tests; security review before prod |

### 14.3 Budget / Firebase Cost Model (Estimate)

**Assumptions:** 8 staff users · 2,000 WOs/year · 500 customers · 50 GB storage

| Service | Est. Monthly (USD) |
|---------|-------------------|
| Hosting | $0–5 |
| Auth | $0 (free tier) |
| Firestore | $25–75 |
| Functions | $10–30 |
| Storage | $5–15 |
| SendGrid/Resend | $0–20 |
| Twilio (if used) | $0–50 |
| Sentry | $0 (free tier) |
| Stripe | Per transaction (pass-through) |
| **Total infra** | **~$50–150/mo** |

Add 20% buffer. Review at 90 days post-launch.

### 14.4 Milestone Gates

| Gate | Criteria |
|------|----------|
| G0 → G1 | Staging deploy; Auth works; rules deployed |
| G1 → G2 | All CRUD modules pass unit + integration tests |
| G2 → G3 | UAT-WO + UAT-FIN signed off |
| G3 → G4 | Security checklist complete; pen test optional |
| G4 → G5 | Go-live checklist 100%; owner sign-off |

### 14.5 Change Control (Post Go-Live)

1. Request documented in GitHub Issue
2. Impact assessed (data, financial, security)
3. Owner approves if financial or RBAC impact
4. Deploy to staging → UAT → prod during maintenance window
5. Rollback plan documented for each release

---

## 15. Competitive & Domain Parity Roadmap

Comparison baseline: **Fullbay**, **Shop-Ware**, **Tekmetric**, **Mitchell 1**

### v1.0 — Parity with Current UI (Must Have)

All modules in existing `/app/*` pages, production-persistent.

### v1.1 — Operational Maturity (Should Have)

| Feature | Priority | Notes |
|---------|----------|-------|
| Photo documentation on every WO | High | Storage + gallery on WO detail |
| Global search | High | Already in UI shell |
| Notifications | High | Already in UI shell |
| PDF exports (invoice, estimate, WO) | High | Legal correctness section |
| QuickBooks CSV export | High | Monthly journal export |
| Audit log viewer | Medium | Admin only |
| MFA for Admin | Medium | Firebase Auth |

### v2.0 — Competitive Parity (Could Have)

| Feature | Priority | Notes |
|---------|----------|-------|
| Customer portal | High | Approve estimates, view invoices, pay online |
| Stripe payment links on invoices | High | Reduces AR days |
| VIN decode (NHTSA) | Medium | Auto-fill year/make/model |
| DOT inspection checklists | High | FMCSA-aligned checklist on WO |
| Time clock on jobs | Medium | Tech labor accuracy |
| QuickBooks Online sync | Medium | Two-way if API budget allows |
| Parts vendor ordering | Low | NAPA etc. — manual reorder list v1 |
| Multi-location / bay scheduling | Low | Single shop today |
| SMS status updates | Low | Twilio opt-in |

### v3.0 — Differentiation (Future)

| Feature | Notes |
|---------|-------|
| Emergency dispatch map | Mobile units, GPS — unique to roadside focus |
| Fleet telematics integration | PM triggers from mileage |
| AI estimate assist | Firebase AI / Gemini — parts suggest from description |
| Native PWA / mobile app | Offline-first field app |

---

## 16. Go-Live Checklist

### Business & Legal

- [ ] Owner confirms labor rate, parts markup, tax settings
- [ ] Accountant reviews tax and invoice PDF sample
- [ ] Payment terms and late fee policy documented on invoices
- [ ] Privacy policy and terms pages live (not `#`)
- [ ] Demo credentials removed from README and login

### Technical

- [ ] Production Firebase config in place (no `YOUR_*` placeholders)
- [ ] Firestore rules deployed and rules tests pass
- [ ] App Check enabled
- [ ] PITR enabled on Firestore
- [ ] Daily backup export scheduled
- [ ] Cloud Functions deployed (PDF, email, counters, overdue job)
- [ ] Staging UAT scripts all pass
- [ ] E2E smoke pass on production
- [ ] Sentry (or equivalent) receiving events
- [ ] Custom domain + SSL configured
- [ ] `sitemap.xml` and `og-home.jpg` present

### Data

- [ ] Mock data migrated or fresh production seed approved
- [ ] Admin user accounts created for Owner, Office, Lead Tech
- [ ] `settings` document populated with shop info

### Training & Ops

- [ ] 1-hour training per role completed
- [ ] Runbook shared with Owner
- [ ] Incident contact list documented
- [ ] 2-week parallel run with old process (if applicable)

### Sign-Off

- [ ] Owner — Business go-live
- [ ] Office Manager — Financial workflows
- [ ] Lead Technician — WO field workflow
- [ ] Dev Lead — Technical readiness

---

## 17. Appendices

### Appendix A — Backlog Summary (Epic → Phase)

| Epic | Stories | Phase |
|------|---------|-------|
| E1 Auth | 5 | 1 |
| E2 Customers | 5 | 3 |
| E3 Trucks | 4 | 4 |
| E4 Work Orders | 7 | 5 |
| E5 Estimates | 4 | 6 |
| E6 Invoices & Payments | 5 | 7 |
| E7 Inventory | 3 | 8 |
| E8 Dashboard & Reports | 3 | 9–10 |
| E9 Public Site | 2 | 12 |
| E10 Cross-cutting | 2 | 11 |

### Appendix B — File Structure (Target)

```
Alex-Road-Service/
├── docs/
│   ├── IMPLEMENTATION_PLAN.md   ← this document
│   └── RUNBOOK.md               ← create at Phase 14
├── functions/
│   ├── src/
│   │   ├── index.ts
│   │   ├── pdf.ts
│   │   ├── email.ts
│   │   ├── stripe.ts
│   │   ├── counters.ts
│   │   └── scheduled.ts
│   ├── test/
│   └── package.json
├── tests/
│   ├── e2e/                     ← Playwright
│   └── rules/                   ← Firestore rules tests
├── firestore.rules
├── firestore.indexes.json
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
└── public/
    ├── app/js/
    │   ├── data-service.js
    │   ├── auth.js
    │   └── utils.js
    └── ...
```

### Appendix C — Glossary

| Term | Definition |
|------|------------|
| WO | Work Order — a repair job |
| PM | Preventive Maintenance |
| AR | Accounts Receivable |
| RBAC | Role-Based Access Control |
| PITR | Point-in-Time Recovery (Firestore) |
| UAT | User Acceptance Testing |

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Owner | _________________ | _________________ | ________ |
| Office Manager | _________________ | _________________ | ________ |
| Lead Technician | _________________ | _________________ | ________ |
| Dev Lead | _________________ | _________________ | ________ |

---

*End of Implementation Plan v2.0*
