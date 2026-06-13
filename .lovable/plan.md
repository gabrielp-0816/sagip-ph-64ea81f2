# SAGIP — Build Plan

SAGIP is a large system (auth, donations, fund requests, disaster management, admin console, reporting, real-time notifications). To ship something solid rather than a shallow demo of everything, I'll build it in **phases** and confirm before each next phase. All currency in ₱ (PHP).

## Design Direction

Government portal aesthetic — clean, trustworthy, NOT AI-generic:
- Palette: deep navy `#0B2F5B` primary, white surfaces, emerald `#0F7B5C` accent (relief/positive), amber `#C97A0E` for warnings, restrained red only for critical alerts
- Typography: **Source Serif** for headings (civic/editorial feel), **Inter** for body and UI
- Layout: structured grid, generous whitespace, clear data hierarchy, subtle motion only
- All tokens defined in `src/styles.css` (oklch), no hardcoded colors in components

## Tech Stack (already provisioned)

- TanStack Start + React 19 + Tailwind v4 + shadcn
- **Lovable Cloud** (Supabase under the hood) for DB, auth, storage, realtime — I'll enable it in Phase 1
- Realtime updates via Supabase Realtime channels (equivalent to WebSockets)
- Server functions (`createServerFn`) for fund approvals, releases, audit logging

## Phase 1 — Foundation (this round)

1. Enable Lovable Cloud
2. Design system: tokens, fonts, shadcn variants (`hero`, `gov`, `relief` buttons; card variants)
3. **Landing page** (`/`): hero, services overview, active disasters preview, transparency stats, contact, footer
4. **Auth pages** (`/auth`, `/auth/signup`, `/reset-password`):
   - Email/password + Google sign-in
   - Signup with full personal info, ID upload (storage bucket), 18+ validation, strong password (zod schema)
   - `profiles` table + `user_roles` table (admin/citizen/ngo/official) with `has_role()` security definer function
5. Database schema (migrations) for all core tables: profiles, user_roles, disasters, disaster_categories, fund_allocations, fund_requests, fund_releases, donations, notifications, audit_logs, uploaded_documents — with RLS + GRANTs
6. Seed disaster categories + initial admin role assignment instructions

> **Note on default admin `admin / 1234`:** Lovable Cloud auth requires email + a real password. I'll instead seed an admin email (e.g. `admin@sagip.gov.ph`) you set the password for on first signup, then grant the `admin` role. Storing `1234` as a real password is a security risk I won't ship. Tell me if you'd prefer a different admin email.

## Phase 2 — Citizen Dashboard

- `/dashboard` shell with sidebar nav
- Fund overview cards (live totals from DB via realtime)
- Active disasters list + detail page
- Donation flow (record donation → allocation → receipt PDF later)
- Fund request submission (multi-step form + document/photo upload)
- Notifications bell + dropdown (realtime channel)
- Profile management + change password

## Phase 3 — Admin Console

- `/admin` (gated by `admin` role)
- Fund management: allocations CRUD, approve/reject/release requests
- Disaster management: create/update/close disasters
- Donation management + donor view
- User management: approve/suspend/activate, role assignment
- Audit logs viewer
- Admin notifications with priority levels

## Phase 4 — Reporting & Polish

- Automated reports (donation, allocation, response, transparency, audit)
- PDF / Excel / CSV export
- Scheduled report jobs
- Announcements + messaging between roles
- Animations pass, accessibility audit, mobile polish
- SEO: per-route metadata, sitemap.xml, robots.txt

## What I Need From You

1. **Confirm phased approach** (vs. trying to ship everything shallowly at once).
2. **Admin account**: OK to use `admin@sagip.gov.ph` with a password you set, instead of `admin/1234`?
3. **City branding**: any specific city (e.g. Quezon City, Cebu City)? Or generic "City Government of [City Name]" placeholder?
4. **Payment processing for donations**: real payments (Stripe/Paddle/PayMongo) or record-only (manual bank transfer reference) for now?

Once you confirm, I'll start Phase 1.
