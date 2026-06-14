This is a large multi-area request. I'll break it into phases so we can verify progress and so the scope stays clear. Before starting I have a few clarifying questions, then I'll proceed.

## Clarifying questions (please confirm)

1. **Super Admin (`admin` / `admin123`)** — Lovable Cloud auth requires real email/password accounts (no plain usernames), and shipping a hardcoded `admin123` credential is a serious security risk. I recommend instead seeding a real super-admin via a one-time secure flow, OR using an email like `admin@sagip.local` with a strong password you set in a secret. Confirm which you want:
   - (a) Seed `admin@sagip.local` with a password you provide privately (recommended)
   - (b) Literally use `admin` / `admin123` (insecure, only for demo)

2. **Metro Manila cities + barangays dropdown** — Do you want the full official PSGC barangay list (1,700+ barangays across 17 LGUs, large static dataset bundled into the app), or just the 17 Metro Manila cities with a free-text barangay field?

3. **Proof of payment / proof of release uploads** — OK to store in existing private storage buckets (`request-documents` for proof of release, and a new `donation-proofs` bucket for donations)?

4. **One aid request per disaster** — Should this block only *pending/approved* requests (so users can re-apply after rejection), or block entirely once any request exists for that disaster?

## Phased implementation plan

### Phase 1 — Backend / schema
- New `transactions` view or table aggregating donations + fund_releases (date, amount, category, status, direction)
- Add `proof_url` column to `fund_releases` (required on release)
- Add `proof_url` column to `donations` (required on submit)
- Add `verification_status` + `verification_notes` to `fund_requests` for background verification step before approval
- Unique partial index preventing duplicate fund_requests per (requester_id, disaster_id) based on Q4 answer
- Seed super-admin user + role per Q1
- New storage bucket `donation-proofs` (private) with RLS
- Profiles: ensure admin signup writes city/province/address

### Phase 2 — Admin side
- Overview: audit every button, wire navigation, remove dead buttons
- Disaster Campaigns: clear all default values, number inputs `type="text"` with numeric validation, no `0` defaults, no spinners
- Fund Allocation: category dropdown sourced from `disaster_categories` table, empty numerics
- Admin registration form: add Personal Information section (first/middle/last name, birth date, gender, mobile, address, city, province, ID type/number/upload) mirroring citizen signup
- Transaction History page (admin) listing donations + releases unified
- Fund release modal: required file upload for proof
- Aid request approval: require verification step + notes before approve
- UI polish: hover contrast tokens in `src/styles.css`, audit sidebar/menu hover states

### Phase 3 — Citizen side
- Dashboard: "Request Aid" button → navigate to `/request?disaster_id=...&category=...`, pre-select category from disaster on the form
- Donation form: clear all defaults (amount blank, proper phone placeholder `09XXXXXXXXX`), required proof-of-payment upload, replace "Office of DRRM" copy with SAGIP
- Request Aid form: clear pre-filled city, add Metro Manila city dropdown + dependent barangay dropdown, fix alignment, block duplicate request per disaster with friendly error
- My Requests: ensure sidebar active state highlights this route
- Signup: strict email regex (no leading/trailing punctuation, valid TLD), server-side duplicate email/mobile/ID check
- Notifications page: fix navigation trap (remove blocking modal / ensure back button + sidebar still work)

### Phase 4 — Cross-cutting
- Auth login page: password show/hide eye icon (both citizen `/auth` and `/admin-auth`)
- Sweep all `defaultValue={0}` / preset numeric/text values from forms
- Consistent SAGIP branding pass
- Verify build + visit each touched page

## Technical notes
- Numeric inputs: use `<Input type="text" inputMode="numeric" pattern="[0-9]*">` + zod `z.coerce.number().positive()` so fields start empty and don't show spinners
- Sidebar active state: use TanStack `<Link activeProps={{ className: ... }}>` and ensure `activeOptions={{ exact: false }}` where needed
- Verification + proof of release will be enforced both client-side (form) and server-side (DB NOT NULL + RLS-safe server function)
- Super admin seeded via migration calling `auth.admin` only works through a server function; I'll create a one-shot server function gated by a setup secret

Please answer Q1–Q4 so I can start with Phase 1 (the migration). Once the migration is approved, I'll execute Phases 2–4 in parallel batches.