# Alex Road Service — Sales & Marketing Platform Brief

**Audience:** Marketing and sales team  
**Purpose:** Explain what we offer — the public website and the operations platform — so you can describe the business clearly to prospects, partners, and internal stakeholders.

| | |
|--|--|
| **Demo website** | [https://launchpage-alex-roadservice.web.app/](https://launchpage-alex-roadservice.web.app/) |
| **Production website** | [https://alexroadservice.com/](https://alexroadservice.com/) |
| **Demo / LaunchPage contact** | [launchpagestudios@gmail.com](mailto:launchpagestudios@gmail.com) · **(908) 230-6948** |

---

## Demo environment (use this for walkthroughs)

**Live demo site:** [https://launchpage-alex-roadservice.web.app/](https://launchpage-alex-roadservice.web.app/)  
**Staff login:** [https://launchpage-alex-roadservice.web.app/login.html](https://launchpage-alex-roadservice.web.app/login.html)

**Demo questions / platform support (LaunchPage):**

- Email: **launchpagestudios@gmail.com**
- Phone: **(908) 230-6948**

> Shop customer inquiries (real repairs) still use the business line **(732) 938-0713** and **info@alexroadservice.com**. Use the LaunchPage contacts above for demo access, platform questions, and sales walkthroughs of this build.

### Operations platform — roles explained

Staff access is role-based. Sign in at `/login.html`, then explore the modules each role can see.

| Role | Who it’s for | What they can do | What they cannot do |
|------|--------------|------------------|---------------------|
| **Administrator** | Shop owner / manager | Full shop ops: customers, trucks, estimates, work orders, invoices, payments, inventory, leads, reports, **Settings** (rates, tax, terms, shop info), write-offs, refunds, user bootstrap | — (full shop access) |
| **Office Staff** | Front office / billing | Day-to-day ops: customers, trucks, estimates, work orders, invoices, Stripe payments, inventory, leads, reports | Settings, write-offs, refunds, deactivating customers |
| **Technician** | Bay / roadside techs | Dashboard, view customers & trucks, **assigned work orders**, view inventory | Create/edit invoices, estimates, payments, leads, reports, settings; cannot create customers/trucks or assign jobs |
| **Developer** | Platform / LaunchPage | Same breadth as admin for demos and support, plus Settings and user management (superuser for the product) | — (intended for platform ops, not daily shop use) |
| **Demo Mode** | Sales demos only | Full UI with **sample data** that resets on each sign-in; payments are simulated (no real Stripe charge); data stays in the browser and does **not** sync to Firestore | Not a real staff account — do not use for production work |

### Sign-in credentials (demo / staging)

| Role | Email | Password |
|------|-------|----------|
| **Developer** | `developer@alexroadservice.com` | `ChangeMe-Dev-2026!` |
| **Administrator** | `admin@alexroadservice.com` | `password` |
| **Office Staff** | `office@alexroadservice.com` | `password` |
| **Technician** | `tech@alexroadservice.com` | `password` |
| **Demo Mode** (sandbox) | `demo@alexroadservice.com` | `Demo2026!` |

**Quick tip for demos:** Use **Try Demo Account** on the login page (or the Demo Mode credentials) for a safe full-platform tour with sample fleets, work orders, and invoices. Switch to **Admin / Office / Technician** accounts when you want to show how permissions differ in a real shop.

**Suggested demo path by role**

1. **Demo Mode** — full journey with rich sample data (lead → WO → invoice → simulated payment).  
2. **Office** — “this is how the front desk runs estimates, WOs, and billing.”  
3. **Technician** — “this is the limited view a tech sees on the floor.”  
4. **Admin** — “owner controls Settings, write-offs, and full visibility.”

---

## One-sentence pitch

Alex Road Service is a Keasbey, NJ commercial truck and trailer repair shop that keeps fleets moving with **24/7 roadside response**, **in-shop Class 6–8 diesel service**, and a **modern digital platform** that takes a job from website lead to paid invoice.

---

## Elevator pitches (use by audience)

### For fleet managers & owner-operators (service sales)

> We’re a commercial truck and trailer repair shop in Keasbey, NJ. We offer 24/7 emergency roadside repair and full in-shop diesel service — plus fleet accounts with organized work orders, estimates, and invoicing so your trucks get back on the road and your paperwork stays clean.

### For partners / vendors / investors (platform + business)

> Alex Road Service runs a dual offering: a public marketing site that captures service demand, and an internal shop operations platform that manages customers, trucks, work orders, estimates, invoices, inventory, and Stripe payments end to end.

### Short taglines already on the brand

| Line | Best use |
|------|----------|
| **We Keep Your Fleet Moving** | Primary brand / homepage |
| **Built for the Road. Built to Last.** | About / brand story |
| **Broken Down? We're On the Way.** | Emergency / roadside |
| **Keep commercial vehicles moving** | General service messaging |

---

## Who we serve

| Segment | What they need | What we emphasize |
|---------|----------------|-------------------|
| **Fleet managers / dispatchers** | Fast turnaround, account billing, unit history | Fleet accounts, Net-30 language, priority scheduling, consolidated invoices |
| **Owner-operators** | Get back on the road, flexible payment | Roadside + shop, card / invoice pay-later options |
| **Commercial accounts** (dry van, reefer, mixer, drayage, etc.) | Reliable local heavy-duty partner | Class 6–8 capability, PM programs, service records |

**Geography to lead with:** Keasbey / Woodbridge, NJ and nearby communities (Edison, Perth Amboy, Sayreville, Carteret, Metuchen, Rahway, Linden, New Brunswick). Shop address: **406 Smith St, Keasbey, NJ 08832**.

**Business contact (customer-facing / production):**

- Phone: **(732) 938-0713**
- Email: **info@alexroadservice.com**
- Web: **https://alexroadservice.com/**

**Demo / platform contact (LaunchPage — for this staging site):**

- Phone: **(908) 230-6948**
- Email: **launchpagestudios@gmail.com**
- Demo site: **https://launchpage-alex-roadservice.web.app/**

---

## What we are offering (two layers)

Think of the product as **two connected layers**:

```
┌─────────────────────────────────────────────────────────┐
│  PUBLIC WEBSITE (customer-facing)                       │
│  Attract → educate → call / request service             │
└───────────────────────────┬─────────────────────────────┘
                            │ leads & demand
┌───────────────────────────▼─────────────────────────────┐
│  OPERATIONS PLATFORM (staff-facing)                     │
│  Lead → customer/truck → estimate → work order →        │
│  invoice → Stripe payment → reports                     │
└─────────────────────────────────────────────────────────┘
```

1. **Public website** — How customers find us, understand services, and request help.  
2. **Operations platform** — How the shop runs jobs, billing, inventory, and reporting professionally.

Together, that is the full offer: **service capability + modern shop operations**.

---

## Layer 1 — Public-facing website

**Role:** Marketing, trust, local SEO, emergency call-to-action, and lead capture.

### Pages and what to say about them

| Page | URL path | Sales talking point |
|------|----------|---------------------|
| **Home** | `/` | Brand story: 24/7 response, fleet focus, clear Call / Request Service CTAs |
| **About** | `/about.html` | Who we are, values, service area, shop location |
| **Services** | `/services.html` | Full catalog + quote request |
| **Emergency** | `/emergency.html` | 24/7 roadside — tap-to-call, on-site repair types |
| **Commercial** | `/commercial.html` | In-shop Class 6–8 diesel, OEM platforms, fleet PM |
| **Contact** | `/contact.html` | Request Service form (feeds shop leads inbox) |
| **Reviews** | `/reviews.html` | Social proof / Google reviews |
| **Financing** | `/financing.html` | Fleet billing, card, invoice / pay later |
| **Staff login** | `/login.html` | Gateway to the operations platform (not for customers) |

### Services we market

Use these as the service menu in decks and outreach:

- Emergency roadside / onsite repair  
- Commercial truck repair (Class 6–8)  
- Diesel engine service  
- Trailer repair  
- Hydraulic systems  
- Electrical systems  
- Air systems  
- Brakes  
- Transmission  
- DOT inspections  
- Preventive maintenance / fleet PM programs  
- Jump starts, fuel delivery, line fabrication (air / hydraulic / fuel)

### Customer-facing “how it works”

1. **Call** or submit Request Service  
2. **Dispatch** — we mobilize or schedule shop time  
3. **Repair** — onsite or in-shop  
4. **Back on the road** — with a service record

### Payment options we advertise

| Option | Message |
|--------|---------|
| **Fleet account billing** | Consolidated invoicing; Net-30 available for qualified fleets |
| **Card payment** | Secure online payment link or in-person card |
| **Invoice & pay later** | Itemized invoice with secure pay link |

> **Note for sales:** Third-party financing partners are described as in progress — do not promise a live financing product until ownership confirms a partner is live.

---

## Layer 2 — Operations platform (shop OS)

**Role:** Internal tool for Admin, Office, and Technician staff (plus Developer for platform support). This is what makes us look and operate like a professional commercial shop — not a clipboard operation.

**Access:** Staff sign in via [Staff Login](https://launchpage-alex-roadservice.web.app/login.html) on the demo site. Roles control what each person can see and do — see **Demo environment** above for credentials and a full role breakdown.

### Modules (what each does)

| Module | What it does | Why it matters in a sales conversation |
|--------|--------------|----------------------------------------|
| **Dashboard** | Live KPIs: open jobs, revenue, invoices due, low stock, alerts | “We run the shop from a live board, not scattered notes.” |
| **Leads** | Inbox of website contact submissions | “Web requests land straight in our ops system.” |
| **Customers** | Fleet / owner-op accounts, history, search/export | “Every account has a real profile and history.” |
| **Trucks** | Unit registry (VIN, make/model, mileage, PM status) | “We track your units — not just the last job.” |
| **Estimates** | Create, send, approve/decline, convert to work order | “Transparent quotes before work proceeds.” |
| **Work Orders** | Job lifecycle, tech assignment, labor/parts | “Jobs are tracked from open to complete.” |
| **Invoices** | AR tracking, overdue detection, Stripe pay links | “Clean billing and collection.” |
| **Payments** | Stripe Checkout payment history | “Secure card payments with an audit trail.” |
| **Inventory** | Parts stock, low-stock alerts, reorder export | “Parts visibility so jobs don’t stall.” |
| **Reports** | Revenue, service mix, tech output, AR aging, CSV | “We can measure performance and fleet spend.” |
| **Settings** | Shop rates, tax, payment terms, shop info | Admin-controlled shop configuration |

### End-to-end journey (lead → paid invoice)

This is the strongest platform story for demos and sophisticated buyers:

1. Customer calls or submits **Request Service** on the website  
2. Request appears as a **Lead** in the ops platform  
3. Office creates/updates **Customer** and **Truck** records  
4. Optional **Estimate** → sent → approved → converted to a **Work Order**  
5. **Work Order** moves Open → In Progress → Completed (parts can pull from **Inventory**)  
6. Shop creates an **Invoice** from the work order  
7. Customer pays via **Stripe** secure checkout link  
8. Payment updates invoice status; **Dashboard / Reports** reflect revenue and AR

```text
Call / Web Form → Lead → Customer + Truck → Estimate (optional)
        → Work Order → Invoice → Stripe Payment → Reports
```

---

## Competitive / positioning angles

### Against a “phone-only” local shop

- Always-on website with emergency and commercial landing pages  
- Digital estimates, work orders, and invoices  
- Secure online payment links  
- Fleet unit history and PM visibility  

### Against generic auto repair software

- Built around **commercial truck / diesel / roadside** workflows  
- Public site and shop system are **connected** (website leads → ops inbox)  
- Payments via **Stripe Checkout** (customer pays on a secure hosted page)

### Proof points you can use carefully

| Claim type | Guidance |
|------------|----------|
| Address, phone, email, domain | Safe — use freely |
| Service menu (roadside + shop + PM) | Safe — matches the live site |
| Stripe invoicing / digital WO–estimate–invoice flow | Safe — describe as how the shop platform works |
| “15+ years,” “500+ trucks,” “98% satisfaction,” “60 min response,” “3 mobile units,” “tri-state” | **Marketing claims on the site** — only use if ownership has approved them as current and accurate |
| Google rating on Reviews page | Confirm current Google Business rating before citing a number |

---

## Objection handling (quick)

| Objection | Response direction |
|-----------|-------------------|
| “We already have a preferred shop.” | We’re the local Keasbey / Woodbridge heavy-duty option for overflow, roadside, and fleet PM — easy to add as a backup that can become primary. |
| “Roadside shops are disorganized.” | Every job can run through digital work orders, estimates, and invoices with payment links — same professionalism as larger shops. |
| “We need Net terms / fleet billing.” | Fleet accounts with consolidated invoicing and Net-30 language for qualified accounts; per-unit breakdowns available. |
| “Can drivers just call when they’re down?” | Yes — phone is primary for emergencies; the website backs it up with tap-to-call and Request Service when they’re not on the line. |
| “Do you only do roadside?” | No — roadside **and** full commercial in-shop Class 6–8 diesel / trailer service. |

---

## Demo guidance (internal)

| Audience | Show | Sign in as |
|----------|------|------------|
| **Fleet prospect** | [Demo home](https://launchpage-alex-roadservice.web.app/) → Emergency + Commercial / Services + Financing + “how it works” | Website only (no login) |
| **Sophisticated buyer / partner** | Contact form → Leads → Customer/Truck → Estimate → Work Order → Invoice → payment story | **Demo Mode** or **Office** |
| **Internal training / role tour** | Dashboard KPIs, then compare nav: Admin vs Office vs Technician | Walk all three role accounts |
| **Platform / LaunchPage questions** | Full ops + Settings | **Developer** or contact **(908) 230-6948** / **launchpagestudios@gmail.com** |

**Demo site bookmark:** [https://launchpage-alex-roadservice.web.app/](https://launchpage-alex-roadservice.web.app/)  
**Login bookmark:** [https://launchpage-alex-roadservice.web.app/login.html](https://launchpage-alex-roadservice.web.app/login.html)

Credentials are listed in **Demo environment** at the top of this doc (and mirrored in `Development Docs/STAFF_CREDENTIALS.md`). Keep them in sales/internal materials only — do not post passwords on the public website or in customer email blasts.

---

## Messaging do’s and don’ts

### Do

- Lead with **fleet uptime** and **local commercial capability**  
- Always give **phone first** for emergencies **(732) 938-0713**  
- For **platform demos**, send people to [launchpage-alex-roadservice.web.app](https://launchpage-alex-roadservice.web.app/) and LaunchPage at **(908) 230-6948** / **launchpagestudios@gmail.com**  
- Mention **shop + roadside** together when relevant  
- Describe the platform as **how we run a professional commercial shop**  
- Point people to the live production site for real service: **alexroadservice.com**  

### Don’t

- Promise live third-party financing until a partner is confirmed  
- Publish staff passwords on the public site or in mass customer communications  
- Confuse LaunchPage demo contact with the shop’s repair dispatch line  
- Overstate coverage (e.g. “tri-state”) unless ownership confirms the claim  
- Describe the ops platform as a customer self-serve portal — it is **staff-facing** today  
- Invent integrations we don’t have yet (e.g. QuickBooks sync, SMS dispatch, customer portal) as live features  

---

## Suggested one-pagers (copy blocks you can reuse)

### Block A — Service one-pager opener

Alex Road Service keeps commercial fleets moving from our shop at 406 Smith St, Keasbey, NJ. We provide 24/7 emergency roadside repair and full in-shop Class 6–8 diesel and trailer service — from brakes and air systems to hydraulics, electrical, DOT inspections, and preventive maintenance. Call (732) 938-0713 or request service at alexroadservice.com.

### Block B — Platform differentiator (for decks)

Behind the service bay is a connected digital platform: website leads feed our shop system; we manage customers and trucks, estimates, work orders, inventory, invoices, and secure Stripe payments — so every job is documented from first call to paid invoice. Walk the live demo at https://launchpage-alex-roadservice.web.app/.

### Block C — Fleet account CTA

Open a fleet account for consolidated invoicing, per-unit billing breakdowns, and payment terms designed for commercial operations. Call (732) 938-0713 or contact us at alexroadservice.com/contact.html.

### Block D — Demo access (sales / partners)

Preview the Alex Road Service website and operations platform at https://launchpage-alex-roadservice.web.app/. Staff login: /login.html. For demo access or platform questions, contact LaunchPage at launchpagestudios@gmail.com or (908) 230-6948.

---

## Related internal docs

| Doc | When to use it |
|-----|----------------|
| `README.md` | High-level product summary |
| `docs/IMPLEMENTATION_PLAN.md` | Roadmap / what’s built vs planned (internal only) |
| `docs/RUNBOOK.md` | Ops procedures |
| `docs/STRIPE_SETUP.md` | Payment capability detail (technical) |
| `Development Docs/STAFF_CREDENTIALS.md` | Full credential list (mirrors the Demo environment section above) |

---

## Summary for the sales team

| We sell | How to describe it |
|---------|-------------------|
| **The service** | 24/7 roadside + commercial truck/trailer shop repair in Keasbey, NJ |
| **The experience** | Fast response, clear process, fleet-friendly billing options |
| **The platform** | Public website that captures demand + staff ops system that runs lead → job → invoice → payment |
| **The proof** | [Demo site](https://launchpage-alex-roadservice.web.app/), Google reviews page, digital estimates/WOs/invoices, Stripe payment links |
| **Demo help** | launchpagestudios@gmail.com · (908) 230-6948 |

**Bottom line:** We are not just a repair phone number. We are a commercial truck service business with a public brand site and a full shop operations platform built to keep fleets moving — and to run the business professionally behind the scenes.
)
