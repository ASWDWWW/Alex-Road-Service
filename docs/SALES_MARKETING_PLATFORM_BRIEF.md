# RoadReady Fleet Service Platform — Sales & Marketing Brief

**Audience:** Marketing and sales team  
**Purpose:** Explain the RoadReady Fleet Service Platform and the custom website + operations system LaunchPage can build exclusively for a roadside service, repair, mechanic, towing, or fleet maintenance company.

| | |
|--|--|
| **Demo website** | [https://launchpage-alex-roadservice.web.app/](https://launchpage-alex-roadservice.web.app/) |
| **Demo / LaunchPage contact** | [launchpagestudios@gmail.com](mailto:launchpagestudios@gmail.com) · **(908) 230-6948** |

## Table of contents

- [Demo environment](#demo-environment-use-this-for-walkthroughs)
  - [Operations platform roles](#operations-platform--roles-explained)
  - [Staff walkthrough sign-in accounts](#staff-walkthrough-sign-in-accounts)
  - [Stripe test checkout information](#stripe-test-checkout-information)
- [One-sentence pitch](#one-sentence-pitch)
- [Elevator pitches](#elevator-pitches-use-by-audience)
  - [Fleet managers and owner-operators](#for-fleet-managers--owner-operators-service-sales)
  - [Partners, vendors, and investors](#for-partners--vendors--investors-platform--business)
  - [Brand taglines](#short-taglines-already-on-the-brand)
- [Who we serve](#who-we-serve)
- [What LaunchPage offers each company](#what-launchpage-offers-each-company)
  - [Domain and launch options](#domain-and-launch-options)
- [The complete offer](#the-complete-offer-two-connected-layers)
- [Features list](#features-list)
  - [Website and lead generation](#website-and-lead-generation)
  - [Staff access and daily workspace](#staff-access-and-daily-workspace)
  - [Customer and service operations](#customer-and-service-operations)
  - [Billing, inventory, and reporting](#billing-inventory-and-reporting)
  - [Team operations](#team-operations)
  - [Company customization and launch](#company-customization-and-launch)
- [Layer 1 — Custom public-facing website](#layer-1--custom-public-facing-website)
  - [Pages and sales talking points](#pages-and-what-to-say-about-them)
  - [Services we market](#services-we-market)
  - [Customer-facing process](#customer-facing-how-it-works)
  - [Payment options](#payment-options-we-advertise)
- [Layer 2 — Custom operations platform](#layer-2--custom-operations-platform)
  - [Platform modules](#modules-what-each-does)
  - [Platform-wide capabilities](#platform-wide-capabilities)
  - [Security and customer confidence](#security-and-customer-confidence)
  - [Feature selection and customization](#feature-selection-and-customization)
  - [Current platform boundaries](#current-platform-boundaries)
  - [End-to-end journey](#end-to-end-journey-lead--paid-invoice)
- [Competitive and positioning angles](#competitive--positioning-angles)
  - [Against a phone-only local shop](#against-a-phone-only-local-shop)
  - [Against generic auto repair software](#against-generic-auto-repair-software)
  - [Proof points](#proof-points-you-can-use-carefully)
- [Objection handling](#objection-handling-quick)
- [Demo guidance](#demo-guidance-internal)
- [Messaging do’s and don’ts](#messaging-dos-and-donts)
  - [Do](#do)
  - [Don’t](#dont)
- [Suggested one-pagers](#suggested-one-pagers-copy-blocks-you-can-reuse)
  - [Block A — Service one-pager opener](#block-a--service-one-pager-opener)
  - [Block B — Platform differentiator](#block-b--platform-differentiator-for-decks)
  - [Block C — Fleet account CTA](#block-c--fleet-account-cta)
  - [Block D — Demo access](#block-d--demo-access-sales--partners)
- [Summary for the sales team](#summary-for-the-sales-team)

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
| **Administrator** | Shop owner / manager | Full operations: customers, trucks, estimates, work orders, invoices, payments, inventory, leads, schedule, messaging, reports, **Settings**, write-offs, refunds, and employee management | — (full company access) |
| **Office Staff** | Front office / billing | Day-to-day operations: customers, trucks, estimates, work orders, invoices, Stripe payments, inventory, leads, schedule, messaging, and reports | Settings, write-offs, refunds, and protected administrator actions |
| **Technician** | Bay / roadside techs | Dashboard, customer/truck reference, **assigned work orders**, inventory visibility, personal schedule, and staff messaging | Creating or managing invoices, estimates, payments, leads, reports, settings, customers, trucks, or job assignments |

### Staff walkthrough sign-in accounts

| Role | Email | Password |
|------|-------|----------|
| **Administrator** | `admin@alexroadservice.com` | `Password123` |
| **Office Staff** | `office@alexroadservice.com` | `Password123` |
| **Technician** | `tech@alexroadservice.com` | `Password123` |

> **Demo credentials only:** These shared passwords are for sales walkthroughs. Every client deployment must use unique staff accounts and secure passwords; never reuse these credentials for a live company.

**Quick tip for walkthroughs:** Use the role accounts above to demonstrate the permissions seen by an administrator, office employee, or technician.

### Stripe test checkout information

Use this information only when Stripe is in **Test mode**. These card numbers do not charge real money and must never be used for a live payment.

**Test customer and billing details**

| Field | Test value |
|-------|------------|
| Email | `stripe-test@alexroadservice.com` |
| Name on card | `RoadReady Test Customer` |
| Country | `United States` |
| Address | `406 Smith St` |
| City | `Keasbey` |
| State | `NJ` |
| ZIP code | `08832` |

**Three successful test cards**

| Card | Card number | Expiration | CVC |
|------|-------------|------------|-----|
| **Visa** | `4242 4242 4242 4242` | `12/34` | `123` |
| **Mastercard** | `5555 5555 5555 4444` | `12/34` | `123` |
| **American Express** | `3782 822463 10005` | `12/34` | `1234` |

To test a payment, sign in with the **Administrator** or **Office Staff** account, open an unpaid invoice, select **Pay with Stripe**, and enter one of the cards above. Confirm the invoice and Payments records update after checkout.

**Suggested demo path by role**

1. **Office** — “this is how the front desk runs estimates, WOs, and billing.”  
2. **Admin** — “owner controls Settings, write-offs, and full visibility.”  
3. **Technician** — “this is the limited view a technician sees for assigned work, inventory, scheduling, and messaging.”

---

## One-sentence pitch

LaunchPage builds a company its own branded website and private operations platform, tailored to its staff, services, workflows, and domain—from customer lead to completed job, invoice, payment, and reporting.

---

## Elevator pitches (use by audience)

### For fleet managers & owner-operators (service sales)

> We’re a commercial truck and trailer repair shop in Keasbey, NJ. We offer 24/7 emergency roadside repair and full in-shop diesel service — plus fleet accounts with organized work orders, estimates, and invoicing so your trucks get back on the road and your paperwork stays clean.

### For partners / vendors / investors (platform + business)

> RoadReady is the working demonstration of a two-part company system: a public marketing website that captures demand and a private staff platform that manages customers, vehicles, estimates, work orders, invoices, inventory, schedules, staff communication, reporting, and Stripe payments. LaunchPage can build a dedicated version around another company’s brand and workflow.

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
| **Roadside service companies** | Fast lead intake, job assignment, status visibility, customer records, and billing | Connected service-request website, work orders, technician assignments, invoices, payments, and reports |
| **Mobile mechanics** | A simple way to manage customers, vehicles, field jobs, schedules, photos, and payments | Mobile-friendly staff workflow, assigned work, service history, media, scheduling, and Stripe Checkout |
| **Auto, diesel, truck, and trailer repair shops** | Organized estimates, repair orders, labor/parts tracking, inventory, invoicing, and staff access | Complete estimate → work order → invoice workflow with role-based access and operational reporting |
| **Towing and recovery companies** | Centralized service requests, customer/vehicle details, assignments, job records, and billing | Custom lead forms, job statuses, staff scheduling, documentation, invoices, and payment records |
| **Fleet maintenance providers** | Unit history, preventive-maintenance visibility, recurring customer records, and account reporting | Vehicle registry, PM alerts, service history, customer accounts, invoices, and performance reports |
| **Growing independent service businesses** | Replace scattered paper, spreadsheets, and disconnected tools without buying unnecessary modules | A private branded platform that can keep, remove, rename, or modify features around the company’s workflow |

---

## What LaunchPage offers each company

This is a **custom company build**, not a shared off-the-shelf workspace. RoadReady is the demonstration and reference platform. For each client, LaunchPage can tailor the system around that company’s:

- Name, logo, colors, contact information, locations, services, and marketing content
- Staff roles, access levels, terminology, forms, statuses, rates, taxes, and payment terms
- Customer, asset, job, inventory, billing, reporting, and scheduling workflows
- Required modules—features can be retained, removed, simplified, renamed, or expanded for the company
- Private company workspace, staff accounts, operational records, optional Stripe payments, and launch support

The final scope is agreed with the company before implementation. Features that are not useful do not need to appear in its platform, and requested workflow changes can be estimated as part of its custom build.

### Domain and launch options

LaunchPage can:

1. Help the company select and register a new domain name.
2. Connect the completed website to a domain the company already owns.
3. Launch on a temporary preview address while the company’s domain connection is pending.
4. Configure the public website and staff login under the agreed company domain structure.

Domain registration, renewal, website operation, email service, and third-party subscription costs should be confirmed in the client proposal. Connecting an existing domain requires authorization from the domain owner.

---

## The complete offer (two connected layers)

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

Together, that is the full offer: **a company-owned brand experience + a private operations system shaped around how its team works**.

---

## Features list

The following list consolidates the customer-facing and staff-facing capabilities available in the RoadReady reference platform. A client can select which features to keep, remove, rename, simplify, or adapt for its company.

### Website and lead generation

- Branded, mobile-friendly public website
- Home, About, Services, Emergency, Commercial, Contact, Reviews, Financing, Privacy, and Terms pages
- Company services, service area, contact details, business hours, calls-to-action, and custom marketing content
- Tap-to-call and email actions
- Request Service / contact form connected to the staff Leads inbox
- Search-friendly page titles, descriptions, business information, and page structure
- Social-proof and review content with links to external review pages
- Public website navigation plus a separate staff-login entry
- **All-language translation** — accessible globe language switcher on the public website and staff ops platform; translates the full interface into 100+ languages (included for every package)
- New domain assistance, existing-domain connection, and temporary preview address

### Staff access and daily workspace

- Individual email/password staff accounts
- Password reset and active-account checks
- Administrator, Office Staff, and Technician access levels
- Role-based navigation and action permissions
- Staff account disabling and archiving
- Dashboard KPIs for open jobs, revenue, invoices due, and low inventory
- Dashboard alerts for overdue invoices, PM-due vehicles, inventory shortages, and pending estimates
- Recent work-order activity and navigation badges
- Global search plus module-level search and filters
- Staff profile and avatar management
- Responsive navigation for desktop, tablet, and mobile use
- **Multi-language UI** — same language preference as the public site; staff can run the full ops platform in any supported language

### Customer and service operations

**Leads**

- Website inquiry inbox
- New, Contacted, Closed, and Converted lead statuses
- Lead details, notes, phone/email actions, attachments, search, filters, and CSV export
- Convert a qualified lead into a customer record

**Customers**

- Create, view, edit, search, filter, deactivate, and export customers
- Fleet and owner-operator account types
- Contact information, notes, logo/images, linked vehicles, recent work, invoices, and payments
- Customer service history, lifetime net spend, and last-service summary

**Vehicles and equipment**

- Create, view, edit, search, filter, and export vehicle/unit records
- VIN, year, make, model, mileage, status, customer, and preventive-maintenance dates
- **VIN lookup and vehicle decoding**
- PM-due calculations and alerts
- Vehicle photos, service history, customer linkage, and new-work-order shortcut
- Client-specific option to rename vehicles as trucks, units, equipment, assets, or another business term

**Estimates**

- Create, view, print, search, filter, and export estimates
- Draft, Sent, Approved, and Declined status tracking
- Internal estimate approval/decline controls
- Customer, vehicle, labor, parts, notes, and media details
- Convert an approved estimate into a work order

**Work orders**

- Create, view, edit, search, filter, print, and export work orders
- Open, In Progress, and Completed job statuses
- Assign one or more technicians
- Technician view limited to assigned work
- Customer, vehicle, service, labor, parts, notes, and job details
- Job photo and video attachments
- Completed-work controls and invoice generation

### Billing, inventory, and reporting

**Invoices**

- Generate an invoice from a completed work order
- Sequential invoice numbers, issue dates, due dates, totals, and balances
- Unpaid, Partially Paid, Paid, Overdue, and Written Off status tracking
- Partial- and full-payment balance updates
- Automatic overdue identification
- Printable invoice view and CSV export
- Administrator write-off controls

**Stripe payments**

- Staff-initiated Stripe-hosted Checkout
- Partial or full card payments
- Payment history and transaction records
- Printable receipts and CSV payment export
- Administrator full or partial refunds
- Invoice balance and status updates after payment or refund
- The platform does not store the customer’s full card number

**Inventory**

- Part/SKU records, categories, quantities, reorder minimums, costs, sale prices, suppliers, and notes
- Part photos and stock-status visibility
- Search, filters, stock adjustments, and transaction history
- Low-stock and out-of-stock alerts
- Reorder-list CSV export
- Safeguards against negative stock quantities

**Reports and exports**

- Preset and custom date ranges
- Net revenue, completed jobs, average job value, and collection rate
- Revenue by service, top customers, technician output, and accounts-receivable aging
- Monthly labor, parts, and work-order summaries
- Downloadable CSV reports and chart images
- CSV exports for customers, vehicles, estimates, work orders, invoices, payments, leads, inventory reorders, and activity records
- Printable estimates, work orders, invoices, receipts, and summaries

### Team operations

**Employees**

- Staff directory, profiles, roles, contact information, and emergency contacts
- Weekly hours, certifications, documents, and profile images
- Staff-account creation and secure password setup/reset
- Onboarding checklist
- Archive, restore, disable-access, and permanent-delete controls for authorized management

**Scheduling**

- Day, week, and month calendar views
- Employee filters and weekly shift visibility
- Assigned work-order overlays
- Meetings, lunches, time off, training, shop duty, all-day events, and custom schedule blocks
- Personal schedule blocks and manager-controlled team scheduling
- Schedule-change notifications

**Messaging and notifications**

- Direct staff messages
- Group conversations and shop-wide channel
- Conversation naming, attachments, unread counts, and read status
- In-app notifications for assignments, work orders, estimates, overdue invoices, inventory shortages, and schedule updates
- Mark individual or all notifications as read

**Media and records**

- Photos and files attached to leads, customers, vehicles, work orders, inventory, messages, and employee records
- Job photos and videos retained with the related work record
- Searchable operational records and management activity exports

### Company customization and launch

- Company name, logo, colors, contact details, locations, services, and website content
- Labor rate, parts markup, tax rate, payment terms, and document presentation
- Role names, permissions, navigation, fields, forms, statuses, and terminology
- Optional modules based on the company’s needs
- Custom lead intake, customer/asset records, job workflow, scheduling, billing, reports, and exports
- Stripe payment option can be included or removed
- New domain assistance or connection to a domain the company already owns
- Company-specific staff accounts and private workspace

Features outside this list should only be presented as proposed custom work after they are included in an agreed client scope.

---

## Layer 1 — Custom public-facing website

**Role:** Marketing, trust, local SEO, calls-to-action, and lead capture. Page names, content, services, forms, and calls-to-action can be changed for the client’s industry and goals.

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
| **Fleet account billing** | Itemized invoice and account history; payment terms are subject to company approval |
| **Card payment** | Staff can initiate secure Stripe-hosted checkout for an invoice |
| **Invoice tracking** | Itemized invoice with due date, balance, overdue status, and payment history |

> **Note for sales:** Third-party financing partners are described as in progress — do not promise a live financing product until ownership confirms a partner is live.

---

## Layer 2 — Custom operations platform

**Role:** A private staff system configured for the client’s operations. The RoadReady reference build uses Administrator, Office Staff, and Technician roles; client role names and permissions can be adapted during the custom build.

**Access:** Staff sign in via [Staff Login](https://launchpage-alex-roadservice.web.app/login.html) on the demo site. Roles control what each person can see and do — see **Demo environment** above for credentials and a full role breakdown.

### Modules (what each does)

| Module | What it does | Why it matters in a sales conversation |
|--------|--------------|----------------------------------------|
| **Dashboard** | KPIs for open jobs, revenue, invoices due, low stock, recent work, PM due, pending estimates, and operational alerts | “We run the shop from a live board, not scattered notes.” |
| **Leads** | Website inquiry inbox, status tracking, notes, media, search/filter, CSV export, and conversion to a customer | “Web requests land straight in our ops system.” |
| **Customers** | Fleet/owner-operator profiles, search/filter, notes, media, linked assets/jobs/invoices/payments, activity totals, deactivation, and CSV export | “Every account has a real profile and history.” |
| **Trucks** | Unit registry, VIN lookup, mileage, PM dates/alerts, service history, photos, customer linkage, search/filter, and CSV export | “We track your units—not just the last job.” |
| **Estimates** | Create, print, track status, approve/decline internally, and convert to work order | “Transparent quotes before work proceeds.” |
| **Work Orders** | Open/in-progress/completed lifecycle, one or more technician assignments, labor/parts totals, photos/videos, print view, and invoice creation | “Jobs are tracked from open to complete.” |
| **Invoices** | Generate from completed work, track balances/overdue status, print, write off, and open staff-initiated Stripe Checkout | “Clean billing and collection.” |
| **Payments** | Stripe Checkout, partial/full payment status, payment ledger, receipts, CSV export, and administrator refunds | “Secure card payments with an audit trail.” |
| **Inventory** | Parts/SKU records, categories, quantities, cost/sale price, suppliers, photos, stock adjustments/history, shortage alerts, and reorder CSV | “Parts visibility so jobs don’t stall.” |
| **Schedule** | Day/week/month staff calendar, shifts, job assignments, meetings, time off, training, and custom schedule blocks | “The team can see work and availability in one calendar.” |
| **Messages** | Direct, group, and shop-wide staff conversations with attachments, unread counts, and read status | “Staff communication stays connected to the operation.” |
| **Employees** | Staff accounts/profiles, roles, emergency contacts, weekly hours, onboarding, certifications, documents, password setup, access disabling, and archive/delete controls | “Owners can manage the people who use the platform.” |
| **Notifications** | In-app alerts for assignments, overdue invoices, estimates, inventory shortages, and schedule updates | “Important operational changes are visible without checking every screen.” |
| **Media** | Photos and files attached to customers, vehicles, leads, jobs, inventory, messages, and employee records | “Supporting records stay with the related work.” |
| **Reports** | Date filters, net revenue, completed jobs, average job, collection rate, service mix, top customers, technician output, AR aging, monthly summaries, charts, and CSV/PNG export | “We can measure performance and fleet spend.” |
| **Exports & print views** | CSV exports plus printable estimates, work orders, invoices, receipts, charts, and audit records | “The company can take its operational records into meetings or other workflows.” |
| **Settings** | Company identity, contact details, logo, labor rate, parts markup, tax, payment terms, and activity-record export | “Administrators control core company configuration.” |

### Platform-wide capabilities

- Secure email/password sign-in, password reset, active-account checks, and role-based access
- Global search, module-level search/filtering, responsive staff navigation, badges, and in-app alerts
- Protected company records and media
- Scheduled overdue-invoice updates, inventory safeguards, and lead-retention cleanup

### Security and customer confidence

The platform is designed so company and customer information is available only to authorized staff. Security is built around practical controls owners can understand and manage:

| Protection | How it helps the company |
|------------|--------------------------|
| **Individual staff accounts** | Each employee receives a separate sign-in instead of sharing one company password. |
| **Role-based access** | Administrators, office employees, and technicians see only the screens and actions required for their responsibilities. |
| **Account status controls** | Authorized management can disable or archive staff access when a person leaves the company or no longer needs the platform. |
| **Protected records and files** | Customer, vehicle, employee, job, invoice, payment, message, and uploaded-file access requires an authorized account. |
| **Restricted financial controls** | Sensitive actions such as refunds, write-offs, company settings, and employee management are limited to approved roles. |
| **Secure card checkout** | Card details are entered through Stripe-hosted Checkout. The platform tracks the payment result and transaction record without storing the customer’s full card number. |
| **Activity and payment records** | Operational exports, payment history, invoice balances, refund status, and activity records help management review important actions. |
| **Password recovery** | Staff can use a secure password-reset process instead of having passwords manually shared with them. |
| **Private company workspace** | Each client receives a company-specific platform and staff-access plan based on the agreed project scope. |

**Customer assurance statement:**  
> Your company receives a private, role-based staff platform. Each employee signs in with an individual account, sensitive management actions are restricted, company records and files require authorized access, and card information is handled through Stripe-hosted Checkout.

For a live launch, the company should require unique passwords, provide access only to current staff, promptly disable former employees, and periodically review role assignments. Sales representatives should not promise that any system is “unhackable” or claim a specific regulatory certification unless that certification has been separately verified for the client’s completed build.

### Feature selection and customization

| Capability area | What a client can keep, remove, or modify |
|-----------------|-------------------------------------------|
| **Website** | Choose pages, service categories, lead forms, calls-to-action, content, imagery, navigation, and branding |
| **Roles & permissions** | Rename roles, adjust navigation and actions, limit sensitive billing/settings access, and create the agreed staff structure |
| **Customers & assets** | Change fields and terminology for fleets, vehicles, equipment, properties, projects, or another company-specific record type |
| **Lead intake** | Modify form fields, statuses, assignment steps, qualification flow, and conversion process |
| **Estimates, jobs & invoices** | Adapt document fields, statuses, numbering, taxes, labor/parts presentation, approval flow, and print layout |
| **Payments** | Enable Stripe where required or remove online card collection from the agreed build |
| **Inventory** | Keep parts tracking, adjust fields/categories/thresholds, or omit inventory for companies that do not stock items |
| **Scheduling** | Tailor event types, staff views, shift information, job overlays, and manager controls |
| **Employees & messaging** | Select employee records, onboarding fields, documents, staff channels, and access controls |
| **Dashboard & reports** | Prioritize the KPIs, alerts, date ranges, reports, charts, and exports important to management |
| **Branding & configuration** | Apply company identity, logo, contact information, rates, taxes, terms, and document presentation |

LaunchPage handles agreed customizations for the client; the current demo does not provide a self-service page builder, theme editor, or domain-management screen.

### Current platform boundaries

Set accurate expectations during sales conversations. The current reference platform does **not** include a customer portal, customer e-signatures, automatic estimate/invoice email or SMS delivery, payroll/time clock, GPS dispatch, QuickBooks sync, public appointment booking, external calendar sync, purchase ordering, or live financing. These should only be promised if added to the signed scope.

### End-to-end journey (lead → paid invoice)

This is the strongest platform story for demos and sophisticated buyers:

1. Customer calls or submits **Request Service** on the website  
2. Request appears as a **Lead** in the ops platform  
3. Office creates/updates **Customer** and **Truck** records  
4. Optional **Estimate** → staff updates status/approval → converts it to a **Work Order**  
5. **Work Order** moves Open → In Progress → Completed while parts stock is tracked in **Inventory**  
6. Shop creates an **Invoice** from the work order  
7. Staff opens **Stripe-hosted Checkout** and the payer completes card payment  
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
- Secure staff-initiated Stripe Checkout  
- Fleet unit history and PM visibility  

### Against generic auto repair software

- Built around **commercial truck / diesel / roadside** workflows  
- Public site and shop system are **connected** (website leads → ops inbox)  
- Payments via **Stripe Checkout** (staff can open secure hosted checkout for an invoice)  
- Custom build can remove irrelevant modules and adapt terminology, roles, fields, and workflows for the client

### Proof points you can use carefully

| Claim type | Guidance |
|------------|----------|
| Address, phone, email | Safe — use freely |
| Service menu (roadside + shop + PM) | Safe — matches the approved service offering |
| Stripe invoicing / digital WO–estimate–invoice flow | Safe — describe as how the shop platform works |
| “15+ years,” “500+ trucks,” “98% satisfaction,” “60 min response,” “3 mobile units,” “tri-state” | **Marketing claims** — only use if ownership has approved them as current and accurate |
| Google rating on Reviews page | Confirm current Google Business rating before citing a number |

---

## Objection handling (quick)

| Objection | Response direction |
|-----------|-------------------|
| “We already have a preferred shop.” | We’re the local Keasbey / Woodbridge heavy-duty option for overflow, roadside, and fleet PM — easy to add as a backup that can become primary. |
| “Roadside shops are disorganized.” | Every job can run through digital work orders, estimates, invoices, payment records, and reports—the same operational discipline expected from larger shops. |
| “We need payment terms / fleet billing.” | Fleet accounts, itemized invoices, due dates, balances, and payment history are supported; the company defines which payment terms it offers. |
| “Can drivers just call when they’re down?” | Yes — phone is primary for emergencies; the website backs it up with tap-to-call and Request Service when they’re not on the line. |
| “Do you only do roadside?” | No — roadside **and** full commercial in-shop Class 6–8 diesel / trailer service. |

---

## Demo guidance (internal)

| Audience | Show | Sign in as |
|----------|------|------------|
| **Fleet prospect** | [Demo home](https://launchpage-alex-roadservice.web.app/) → Emergency + Commercial / Services + Financing + “how it works” | Website only (no login) |
| **Company prospect / decision-maker** | Website → lead → customer/asset → estimate → work order → invoice → payment, then review customization and domain options | **Office** |
| **Internal training / role tour** | Dashboard KPIs, then compare Admin and Office navigation and permissions | Walk both operations accounts |
| **Platform / LaunchPage questions** | Full ops + Settings | Contact **(908) 230-6948** / **launchpagestudios@gmail.com** |

**Demo site bookmark:** [https://launchpage-alex-roadservice.web.app/](https://launchpage-alex-roadservice.web.app/)  
**Login bookmark:** [https://launchpage-alex-roadservice.web.app/login.html](https://launchpage-alex-roadservice.web.app/login.html)

Credentials are listed in **Demo environment** at the top of this document. Keep them in sales/internal materials only—do not post passwords on a public website or in customer email campaigns.

---

## Messaging do’s and don’ts

### Do

- Lead with **fleet uptime** and **local commercial capability**  
- Always give **phone first** for emergencies **(732) 938-0713**  
- For **platform demos**, send people to [launchpage-alex-roadservice.web.app](https://launchpage-alex-roadservice.web.app/) and LaunchPage at **(908) 230-6948** / **launchpagestudios@gmail.com**  
- Mention **shop + roadside** together when relevant  
- Explain that RoadReady is the reference build and the client receives a platform tailored solely to its company  
- Ask which modules the company wants to keep, remove, rename, or modify  
- Ask whether the company needs a new domain or wants LaunchPage to connect an existing domain  

### Don’t

- Promise live third-party financing until a partner is confirmed  
- Publish staff passwords on the public site or in mass customer communications  
- Confuse LaunchPage demo contact with the shop’s repair dispatch line  
- Overstate coverage (e.g. “tri-state”) unless ownership confirms the claim  
- Describe the ops platform as a customer self-serve portal — it is **staff-facing** today  
- Invent integrations we don’t have yet (e.g. QuickBooks sync, SMS dispatch, customer portal) as live features  
- Describe customization as an instant self-service setting; client changes are designed and implemented to the agreed scope  

---

## Suggested one-pagers (copy blocks you can reuse)

### Block A — Service one-pager opener

RoadReady keeps commercial fleets moving with 24/7 emergency roadside repair and full in-shop Class 6–8 diesel and trailer service—from brakes and air systems to hydraulics, electrical, DOT inspections, and preventive maintenance. Call (732) 938-0713 to request service.

### Block B — Platform differentiator (for decks)

LaunchPage can build a dedicated website and private operations platform solely for your company. Start with the capabilities your team needs, remove what it does not, and tailor the branding, roles, records, job workflow, scheduling, billing, reports, and documents around your operation. Walk through the working RoadReady reference platform at https://launchpage-alex-roadservice.web.app/.

### Block C — Fleet account CTA

Ask about a fleet account for organized service records, itemized invoices, and company-approved payment terms. Call (732) 938-0713 or email info@alexroadservice.com.

### Block D — Demo access (sales / partners)

Preview the RoadReady reference website and operations platform at https://launchpage-alex-roadservice.web.app/. Staff login: /login.html. LaunchPage can build a company-specific version and provide a new domain or connect a domain the company already owns. For demo access or platform questions, contact launchpagestudios@gmail.com or (908) 230-6948.

---

## Summary for the sales team

| We sell | How to describe it |
|---------|-------------------|
| **The service** | 24/7 roadside + commercial truck/trailer shop repair in Keasbey, NJ |
| **The experience** | Fast response, clear process, fleet-friendly billing options |
| **The platform** | A custom public website + private staff system built solely around the client company |
| **The flexibility** | Keep, remove, rename, or modify modules and workflows during the agreed custom build |
| **The domain** | Launch with a new domain or connect a domain the company already owns |
| **The proof** | [Demo site](https://launchpage-alex-roadservice.web.app/), Google reviews page, digital estimates/work orders/invoices, and staff-initiated Stripe Checkout |
| **Demo help** | launchpagestudios@gmail.com · (908) 230-6948 |

**Bottom line:** RoadReady demonstrates the complete roadside service, mechanic, and fleet operations experience. LaunchPage can use that proven foundation to build a branded website and private operations platform solely for another company, with the features, workflow, staff access, and domain setup defined for that client.
