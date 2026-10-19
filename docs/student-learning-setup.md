# Student access — what to enter

This is the setup after workspace accounts. Complete `docs/workspace-setup.md` first. Do not create a Stripe coupon, price, promotion code, or Payment Link until the amounts below are approved. Leaving the flag off is the shipped state.

## 1. Apply the database migration

In the Supabase SQL editor, run `supabase/migrations/20261015120000_student_access_progress.sql` after `20261015000000_workspace_auth_designs.sql`.

That migration adds:

- `profiles.signup_role` (`student`, `engineer`, or `company`). This is the account kind. `profiles.role` stays the job title.
- `profiles.student_badge` and `profiles.student_badge_source`. The browser cannot set the badge. A university email sets it only when `signup_role` is `student`.
- `learning_progress` for published Design Engineer Track sections. The only stored sections are Level 1: `l1m1` through `l1m8`. Levels 2–4 have no published section list, so they cannot be marked complete.
- `student_id_reviews` for a JPEG, PNG, WebP, or PDF up to 4 MB. The file is in the row, not in Storage. The owner can read their own row. Another signed-in user cannot.

A university email is the domain's last label `edu` (`mit.edu`, `foo.bar.edu`), or the label `edu` or `ac` immediately before a two-letter country code (`unimelb.edu.au`, `school.edu.cn`, `cam.ac.uk`, `wits.ac.za`). `gmail.com`, `edu.com`, a bare `.ac` such as `island.ac`, and `.ca` / `.de` / `.fr` do not qualify. An engineer with a `.edu` address does not get the badge.

## 2. Add yourself as the review admin

Sign in once on `/workspace` so `auth.users` has your row. Then run, with that user's id:

```sql
insert into public.workspace_admins (user_id)
values ('<auth.users id>');
```

There is no seed admin. Authenticated users cannot insert this table. `/admin/student-reviews` lists pending IDs only when this row exists. Approve sets `student_badge` for a student account. Reject leaves the badge off, and does not remove a badge that came from a university email.

## 3. What students can open

Any signed-in account can use the calculator and saved designs. Those are not badge-gated.

Course pages, paid masterclass chapters, and Design Engineer Track levels 2–4 open when `profiles.student_badge` is true. A pending student ID does not open them. The Skills Passport lists only rows in `learning_progress`. It is not a certificate.

## 4. Stripe objects to create later

Do not create these until the discount is approved. This repository does not call Stripe for the student offer, and `functions/student-learning-checkout.js` never starts a Checkout Session.

Create these in the Stripe Dashboard, on the same account as the existing Learning Payment Link:

1. Coupon
   - Duration: once
   - Name: your choice (for example, Student Learning)
   - Discount: `percent_off`, or `amount_off` plus currency `usd`, at the value you approve. This doc does not set that number.
   - Applies to: the existing Learning product only. That product is the one behind Payment Link `plink_1UQhha2YHcFlJstOHjvZv5V0` (`https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p`, $199). Do not apply it to jobs, verified manufacturer, or events.
2. Price id to charge
   - Use the existing Learning price id on that Payment Link, or create a new Price on that same Learning product if the student checkout should use its own price.
   - Copy the `price_...` id.
3. Copy the coupon id (`coupon_...`).

Do not create a Payment Link for this offer. A public promotion code is optional and this code does not read one.

## 5. Env vars — leave unset

| Name | Value when you later turn it on |
| --- | --- |
| `STUDENT_LEARNING_COUPON_ENABLED` | exactly `on` |
| `STRIPE_STUDENT_LEARNING_COUPON_ID` | the `coupon_...` id |
| `STRIPE_STUDENT_LEARNING_PRICE_ID` | the `price_...` id |

Set them in Netlify for Production and Deploy Previews only after the coupon and price exist. Setting them still does not charge anyone. The public status stays `enabled: false` with reason `checkout_not_started` until a later change posts a Checkout Session. The session params, when that later change is written, are one-time `mode: payment`, one line item for that price, and `discounts: [{ coupon }]`. Success and cancel URLs are `https://transformerpath.com/pricing.html?session_id={CHECKOUT_SESSION_ID}` and `https://transformerpath.com/pricing.html#student-learning-offer`.

`/pricing.html#student-learning-offer` says the checkout is off. Do not replace that copy with a buy button in this step.

This does not change Engineering Pro or Engineering Team.
