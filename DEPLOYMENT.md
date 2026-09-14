# Netlify deployment

TransformerPath is deployed as a static site with one Netlify Function.

## Netlify settings

- **Base directory:** repository root (leave blank)
- **Build command:** leave blank; the site has no compile step
- **Publish directory:** `transformerpath`
- **Functions directory:** `transformerpath/functions`
- **Node version:** 18 or newer

These settings are checked in to [`netlify.toml`](netlify.toml). Netlify installs the
Stripe dependency from `transformerpath/package.json` and bundles
`functions/create-checkout.js` with esbuild.

## Environment variables

Set `STRIPE_SECRET_KEY` in Netlify only when enabling the server-side Stripe
Checkout flow. Keep it in the Netlify environment, never in the repository.
Without it, checkout buttons intentionally fall back to the invoice email flow
defined in `payments.js`.

The remaining values in `.env.example` are for future application integrations
and are not required to publish the current static site.
