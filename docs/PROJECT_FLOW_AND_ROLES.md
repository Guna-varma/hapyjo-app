# Hapyjo: End-to-End Project Flow and Roles

This document describes the **full flow from creating a project (site) to project end**, which roles are involved at each step, and whether to design at **process level** or **owner level**.

---

## 1. Terminology: “Project” = “Site”

In the app, the unit of work is a **Site**. One site = one contract/location with its own budget, team, vehicles, and revenue. So:

- **Create project** = create a **site** (Admin or Head Supervisor).
- **Project end** = site status **completed** (or inactive).

The flow below uses “site” and “project” interchangeably.

---

## 2. End-to-End Flow (Create Project → Project End)

| Step | What happens | Who does it |
|------|----------------|-------------|
| **1. Create site** | New site: name, location, start date, budget. Status = active. | **Admin** or **Head Supervisor** (Sites tab) |
| **2. Set contract rate** | Set RWF per m³ for this site (revenue = volume × rate). | **Owner** (per site) |
| **3. Get vehicles** | Vehicles are **not created in the app**. They are created on the **Umugwaneza website** and **synced** into Hapyjo (Vehicles tab → “Sync from website”). | **Head Supervisor** (sync); vehicles “belong” to company, then get assigned to sites. |
| **4. Allocate vehicles to site** | Assign trucks/machines to this site (edit vehicle → set Site). | **Head Supervisor** (Vehicles tab) |
| **5. Assign people to site** | Assign **Assistant Supervisor**, **Surveyor**, **Drivers (truck)**, **Operators (machine)** to the site. Optionally link vehicles to the site for assignment. | **Head Supervisor** (Site detail screen) |
| **6. Assign drivers/operators to vehicles** | At each site: which driver uses which truck, which operator uses which machine. | **Assistant Supervisor** only (Driver Allocation screen) |
| **7. Day-to-day work** | Drivers: start/end trips (trucks) or work sessions (machines); record fuel, distance/hours. Assistant Supervisor: add expenses (general, fuel); manage tasks; approve surveys. Surveyor: submit before/after surveys (volume in m³). | **Driver (truck)**, **Operator (machine)**, **Assistant Supervisor**, **Surveyor** |
| **8. Survey → volume → revenue** | Surveyor submits survey (e.g. CSV); app computes work volume (m³). Assistant Supervisor **approves** survey. Approved volume × site contract rate = **revenue** for that site. | **Surveyor** (submit), **Assistant Supervisor** (approve) |
| **9. Costs and reporting** | Expenses (fuel, general) update site **spent**. Accountant and Owner see **per-site** and **total** budget, spent, revenue, profit. | **Assistant Supervisor** (expenses); **Accountant** / **Owner** (view reports) |
| **10. Issues** | Drivers, operators, or Assistant Supervisor raise issues (e.g. breakdown, safety). Head Supervisor and Owner see and handle them. | **Driver**, **Operator**, **Assistant Supervisor** (raise); **Head Supervisor**, **Owner** (view/resolve) |
| **11. Project/site end** | When work is done, site status can be set to **completed** (or inactive). Financial summary remains available for reporting. | **Admin** / **Head Supervisor** (update site status when applicable) |

---

## 3. Roles: Who Does What

### Owner

- **Sets contract rate (RWF per m³) per site.** Revenue = sum over sites of (approved volume × site rate).
- Sees **financial summary**: total budget, spent, revenue, profit; can see per-site allocation.
- Sees **issues** raised by field staff.
- **Does not** create sites, assign vehicles, or approve surveys; that is process/operations.

**Where owner comes in:** After a site exists, the owner sets how much the company earns per m³ for that site. Accountant and reports then show allocation and revenue per site.

---

### Accountant

- **Read-only** access to money-related data.
- Sees **per-site allocation**: budget, spent, revenue (volume × contract rate), and totals (total budget, total spent, total revenue, profit).
- **Does not** create sites, set rates, add expenses, or approve surveys.

**Where accountant comes in:** After sites exist, expenses are logged, and surveys are approved, the accountant uses the app to view allocation and revenue per site and overall (reports / dashboard).

---

### Head Supervisor

- **Creates sites** (with Admin) and **allocates budget** to sites.
- **Allocates vehicles to sites**: syncs vehicles from Umugwaneza website, then in Vehicles tab edits each vehicle and sets its **Site**. Does **not** assign which driver/operator uses which vehicle (that is Assistant Supervisor only).
- **Assigns people to sites**: on Site detail, assigns Assistant Supervisor, Surveyor, drivers (truck), operators (machine), and optionally which vehicles are available at that site.
- Sees **reports**, **tasks**, **surveys**, **issues**; can navigate to Vehicles, Sites, Users, etc.
- Can **update site status** (e.g. to completed) when the project ends.

---

### Assistant Supervisor

- **Assigns drivers and operators to vehicles** at each site (only role that can do this in the app).
- Sees only **their assigned site(s)**.
- **Adds expenses** (general and fuel) for the site; site “spent” updates.
- **Approves surveys** submitted by the Surveyor (submitted → approved); approved surveys feed revenue (volume × contract rate).
- Manages **tasks** at the site; raises **issues**; can use **GPS/Camera** (e.g. for proof of work).

---

### Surveyor

- **Submits surveys** (e.g. before/after CSV); app computes **work volume (m³)**.
- Charge per unit = **Owner’s contract rate** for that site.
- Can add photos to surveys; sees own surveys (draft / submitted / approved).

---

### Driver (Truck) and Operator (Machine)

- **Driver (truck):** starts/ends **trips**; records distance, fuel (start/end, mid-shift refuel); can attach photo.
- **Operator (machine):** starts/ends **work sessions**; records hours, fuel consumed; mid-shift refuel.
- Both can **raise issues** (e.g. breakdown, safety).
- **GPS/Camera** for location and proof (e.g. end-of-trip photo).
- Use only the **vehicles assigned to them** at that site by the Assistant Supervisor.

**Terminology (from ROLES_STRICT_FLOW.md):** Truck → **Driver** (`driver_truck`). Machine → **Operator** (`driver_machine`). In UI/reports use “Operator” for machines, not “Driver–Machine”.

---

### Admin

- **Creates sites** (with Head Supervisor); **creates users** and can assign any role (including Owner and Admin).
- Full access to **Sites**, **Users**, **Vehicles**, **Surveys**, **Reports**, **Settings**, etc.
- Typically used for system setup and company-wide configuration.

---

## 4. Where Do Vehicles and Trucks Come From?

- **Vehicles are not created inside Hapyjo.** They are created on the **Umugwaneza website** and then **synced** into the app.
- In the app:
  1. **Head Supervisor** (or Admin): **Vehicles** tab → **Sync from website** to pull new vehicles into Hapyjo.
  2. **Edit** synced vehicles: add app-specific data (mileage, tank capacity, fuel balance, site assignment, etc.) and **assign each vehicle to a site** (or leave “Free” with no site).
- So: **vehicles and trucks** = from **Umugwaneza website** → sync into app → Head Supervisor assigns them to sites; Assistant Supervisor then assigns which driver/operator uses which vehicle at that site.

---

## 5. Other Roles (Summary)

- **Admin:** Setup (sites, users), full access; can create Owner and other roles.
- **Owner:** Contract rates per site; view financial summary and issues.
- **Accountant:** Read-only financial view (per-site allocation and totals).

Process execution (assignments, expenses, trips, surveys, issues) is done by **Head Supervisor**, **Assistant Supervisor**, **Surveyor**, **Driver**, and **Operator**.

---

## 6. Process Level vs Owner Level

**Process level** = per site (per project): budget, spent, assignments, tasks, surveys, trips/sessions, expenses, issues. This is where the work happens.

**Owner level** = company-wide view: total budget, total spent, total revenue, total profit; optionally per-site breakdown for decision-making.

**Recommendation:**

- **Use process level** for:
  - Creating and running sites (assignments, vehicles, drivers/operators, expenses, surveys, tasks, issues).
  - All operational screens (Sites, Vehicles, Tasks, Surveys, Expenses, Driver Allocation, Trips/Sessions, Issues).
- **Use owner level** for:
  - Setting **contract rate per site** (Owner).
  - Viewing **financial summary** and **reports** (Owner, Accountant, Head Supervisor): totals and per-site allocation/revenue.

The app already supports both: **process/site level** for operations (each site has its own budget, spent, team, vehicles, surveys), and **owner level** for finance (Owner and Accountant dashboards show totals and per-site allocation). So: **design and operate at process (site) level for execution; use owner level for pricing (contract rate) and financial oversight.**

---

## 7. Quick Reference: Role vs Responsibility

| Role | Create site | Set contract rate | Sync/assign vehicles to site | Assign people to site | Assign driver/operator to vehicle | Add expenses | Approve surveys | Submit surveys | Trips/sessions | Raise issues | View reports/finance |
|------|-------------|-------------------|------------------------------|------------------------|----------------------------------|--------------|-----------------|----------------|----------------|-------------|----------------------|
| Admin | ✓ | — | ✓ | ✓ (via site detail) | — | — | — | — | — | — | ✓ |
| Owner | — | ✓ | — | — | — | — | — | — | — | View | ✓ |
| Head Supervisor | ✓ | — | ✓ | ✓ | — | — | — | — | — | View | ✓ |
| Accountant | — | — | — | — | — | — | — | — | — | — | ✓ (read-only) |
| Assistant Supervisor | — | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ | — |
| Surveyor | — | — | — | — | — | — | — | ✓ | — | — | — |
| Driver (truck) | — | — | — | — | — | — | — | — | ✓ (trips) | ✓ | — |
| Operator (machine) | — | — | — | — | — | — | — | — | ✓ (sessions) | ✓ | — |

---

*Ref: `lib/rbac.ts`, `docs/ROLES_STRICT_FLOW.md`, `docs/VEHICLES_SYNC_AND_DB.md`, `types/index.ts`, and role dashboards in `components/dashboards/`.*
