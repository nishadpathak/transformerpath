# Workspace accounts — what to enter

Stage 1 sign-in reads two public values at build time (`scripts/write-supabase-config.js`) and, if those are empty in the built file, from `GET /.netlify/functions/supabase-public-config`. Until both are set to a real public client key, https://transformerpath.com/workspace shows **Accounts are being set up** and does not show a signed-in header.

The project host previously committed in `supabase-config.js` (`rpzpgfstrxeevhkizxsx.supabase.co`) does not resolve in DNS. Create or choose a live Supabase project. Do not reuse that host.

Do not paste the service-role or secret key into any of the variables below. This stage does not need it. Do not create, rotate, or print keys into the repo, a pull request, or a log.

After saving the Netlify variables, start a new production deploy so the build rewrites `supabase-config.js`.

## 1. Supabase project URL and public key

In the Supabase dashboard open **Project Settings → API**.

| Netlify variable | Value to paste |
| --- | --- |
| `SUPABASE_URL` | **Project URL**, exactly `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | The **anon** public key if the dashboard shows a JWT whose role is `anon` (it starts with `eyJ`) |
| `SUPABASE_PUBLISHABLE_KEY` | The **publishable** key if the dashboard shows `sb_publishable_...` |

Set `SUPABASE_URL` and one public key. If both public keys are set, the site uses `SUPABASE_ANON_KEY`. A value that is a secret key (`sb_secret_...`) or a JWT with role `service_role` is ignored and the page stays on **Accounts are being set up**.

## 2. Netlify environment variables and scopes

Site: `transformerpath`. **Site configuration → Environment variables.** Add the names from section 1.

- **Scopes:** Builds, Functions, and Runtime (all scopes). The build writes the browser file. The function answers when that file is still empty.
- **Deploy contexts:** Production, Deploy Previews, and Branch deploys.

`SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are not part of this stage. If they already exist for payments, leave them on Functions only. Never mark them as available to the browser bundle.

Check which names the running deploy can see, without values:

`GET https://transformerpath.com/.netlify/functions/supabase-public-config?probe=1`

The JSON `present` object is booleans for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The same line is printed in the Netlify build log as `[supabase-public-config] configured=...` with `set` or `missing` beside each name.

`GET https://transformerpath.com/.netlify/functions/supabase-public-config` returns `configured: true` only when the URL and a public key are both accepted. That response includes the public key on purpose. The probe URL does not.

## 3. Supabase Auth

**Authentication → URL configuration**

- **Site URL:** `https://transformerpath.com`
- **Redirect URLs** — add each of these:

```
https://transformerpath.com/workspace.html
https://transformerpath.com/workspace
https://deploy-preview-*--transformerpath.netlify.app/workspace.html
https://deploy-preview-*--transformerpath.netlify.app/**
https://*--transformerpath.netlify.app/workspace.html
https://*--transformerpath.netlify.app/**
```

**Authentication → Providers**

- **Email:** enabled. Magic link is the sign-in method (`signInWithOtp`). Leave email signup allowed so the first link can create the user.
- **Google:** enabled. Paste the Google client ID and client secret from section 4 into the Google provider. Those stay in Supabase, not in Netlify and not in git.

## 4. Google Cloud OAuth client

In Google Cloud Console, create an OAuth client of type **Web application**.

**Authorized JavaScript origins**

- `https://transformerpath.com`

Google does not accept a wildcard origin. Add a deploy-preview origin only when you need Google sign-in on that exact preview, for example `https://deploy-preview-123--transformerpath.netlify.app`.

**Authorized redirect URI** — one line, using the same project ref as `SUPABASE_URL`:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

## 5. Apply the migration

The SQL file is `supabase/migrations/20261015000000_workspace_auth_designs.sql`. It creates `profiles` (`display_name`, `public_name`, `company`, `role`), `saved_designs`, and `design_versions`, and turns on row-level security so a user can only see their own rows. `public_name` is kept equal to `display_name` so it stays compatible with the Learner Profile schema. `profiles.role` is the person's job, not `account_roles.role`.

Either paste that file into the Supabase **SQL Editor** and run it, or from a machine logged into the Supabase CLI:

```
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`<project-ref>` is the subdomain of `SUPABASE_URL`. The CLI will ask you to log in. Do not put the database password or the service-role key in the repo.

Until this SQL has been applied, sign-in can succeed and saving a design will show the database error instead of an empty list.
