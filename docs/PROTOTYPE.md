# HapyJo Ltd – UI/UX Prototype (Mock-Only)

This document describes the current **prototype** phase of the HapyJo Ltd Android app.

## Scope

- **Phase 0 (Foundation):** Supabase, OTP, and RLS are **deferred**. The prototype uses **mock authentication** (email/password, no OTP) and **mock data** only.
- All data is held in **in-memory state** (React state and `MockAppStoreContext`). Nothing is persisted to a real database in this phase.
- Permissions and visibility are enforced in the UI and in `lib/rbac.ts`; there is no backend RLS.

## What Works in the Prototype

- **Auth:** Mock login with demo users (one per PRD role). No real Supabase auth yet.
- **Sites & budget:** List sites, allocate budget (Head Supervisor). Data from mock store.
- **Vehicles:** List trucks and machines by site; add truck/machine; filter by type.
- **Site assignments:** Head Supervisor assigns Assistant Supervisor, Surveyor, drivers, and vehicles to a site (Site detail screen).
- **Expenses:** Assistant Supervisor adds general expenses and fuel entries; site spent and vehicle fuel balance update.
- **Trips & machine sessions:** Drivers start/end trips (truck) or work sessions (machine); distance/hours and fuel consumed are computed; vehicle fuel balance updates.
- **Mid-shift refuel:** During an active trip/session, driver can add fuel (litres, optional cost); vehicle balance and optional fuel expense updated.
- **Surveys:** Surveyor submits Before/After survey (paste CSV); parser computes work volume; Assistant Supervisor approves. Approved surveys feed revenue.
- **Cost, revenue, profit:** Management dashboards (Admin, Owner, Head Supervisor, Accountant) show work volume, expenses, revenue (volume × contract rate), and profit. Owner can set contract rate (RWF per unit volume).
- **Vehicle fuel summary:** Reports tab shows per-vehicle total filled, cost, km/hours, remaining fuel.
- **Issues:** Drivers and Assistant Supervisor can raise issues (description); Head Supervisor and Owner see the list.
- **i18n:** English and Kinyarwanda; language selector in Settings; tab labels and Settings strings use translation keys.

## Next Steps (Post-Prototype)

- Integrate **Supabase** for auth (including OTP if required), database, and RLS.
- Replace `MockAppStoreContext` and in-memory state with Supabase tables and real-time or fetch-based data.
- Add persistence for locale (e.g. AsyncStorage) and optionally sync user preferences to backend.
