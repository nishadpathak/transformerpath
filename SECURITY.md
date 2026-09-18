# Security Policy — TransformerPath

## Security Architecture

### 1. Separation of Public Artifact and Admin Surfaces
Administrative tooling (`admin.html`, `admin/`, `_private/`) is strictly excluded from public production releases (`dist/`). Automated build scripts (`build-dist.js`) and CI gates prevent administrative files from being served publicly until comprehensive server-side JWT authorization and role verification are deployed.

### 2. Identity and Row Level Security (RLS)
- All user data stored in Supabase PostgreSQL is protected by Row Level Security.
- Policies restrict reads and writes to `auth.uid() = user_id`.
- Organization members access organization data based on validated `organization_members` relationships.
- Unauthenticated requests cannot read or modify private profile, progress, or saved design records.

### 3. Payment and Entitlement Security
- Payment processing occurs strictly through Stripe Checkout with server-side session generation (`functions/create-checkout.js`).
- Entitlements are never granted in the client browser or stored in writable cookies/localStorage.
- Stripe webhook events (`functions/stripe-webhook.js`) verify cryptographic signatures against `STRIPE_WEBHOOK_SECRET` before granting entitlements in Supabase.
- Webhook events are deduplicated idempotently using `webhook_events` transaction logs to prevent double-granting.

### 4. Secret Management
- API secret keys (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`) are stored exclusively in Netlify environment variables and are never checked into git or bundled into client JS.
- Public client keys (`SUPABASE_ANON_KEY`) only permit operations authorized by active RLS policies.

## Reporting a Vulnerability

If you discover a security vulnerability in TransformerPath:
1. Please do not open a public issue.
2. Email security concerns to: `security@transformerpath.com` (or contact the repository maintainers directly).
3. We will acknowledge receipt within 24 hours and provide a remediation timeline.
