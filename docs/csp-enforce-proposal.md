# Content-Security-Policy — enforce proposal

Reviewed 21 October 2026 against `netlify.toml` and `tests/csp-report-only.js`.

## What is live

The site already sends an enforcing `Content-Security-Policy`. It starts with `default-src 'self' https: data: blob:` and allows `'unsafe-inline'`, `'unsafe-eval'`, and `https:` in `script-src`. A second header, `Content-Security-Policy-Report-Only`, names the hosts the pages load, including Stripe (`js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`, `m.stripe.network`, `buy.stripe.com`, `checkout.stripe.com`), Google fonts, analytics, ads, cdnjs, and `ipapi.co`.

The report-only header still also allows `'unsafe-inline'`, `'unsafe-eval'`, and `https:`. It is not a tighter policy than the enforcing header.

## Violations

There is no `report-uri` and no `report-to` on either header. This repository has no collected CSP violation reports. Nothing here can be called a clean report.

## Decision

Enforce mode is not changed. The existing enforcing header stays. The report-only header stays. A switch to a host allowlist would not be based on a reviewed, clean report.

## Proposed enforce policy, after a clean report window

Keep this as a proposal until a report endpoint has been quiet:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://fundingchoicesmessages.google.com https://partner.googleadservices.com https://adservice.google.com https://www.googleadservices.com https://ep1.adtrafficquality.google;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://fonts.gstatic.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://ad.doubleclick.net;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://api.stripe.com https://m.stripe.network https://www.google-analytics.com https://www.googletagmanager.com https://ipapi.co https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://fundingchoicesmessages.google.com https://adservice.google.com https://ep1.adtrafficquality.google;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://buy.stripe.com https://checkout.stripe.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com;
object-src 'none';
base-uri 'self';
form-action 'self' https://buy.stripe.com
```

`'unsafe-eval'` stays out of this proposal. Do not drop `'unsafe-inline'` until the inline scripts in the static pages are gone. Do not apply this block in `netlify.toml` until violation reports for it are clean. Payment Links navigate to `buy.stripe.com`; that navigation is `form-action` and `frame-src`, not a reason to put a secret in the policy.
