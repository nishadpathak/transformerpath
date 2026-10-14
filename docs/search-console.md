# Search Console and Bing Webmaster

Steps for Nishad to verify transformerpath.com, submit the sitemap, and request indexing. The sitemap URL is `https://transformerpath.com/sitemap.xml`. `robots.txt` already names that sitemap.

Do these in a browser while signed in as the Google account that should own the property, and as the Bing account that should own the site. Nothing below is stored in the repository. Google and Bing generate the verification token; do not reuse a token from another property.

## 1. Verify the domain in Google Search Console with a DNS TXT record

1. Open [Google Search Console](https://search.google.com/search-console).
2. Click **Add property**.
3. Choose **Domain** (not URL prefix). Enter `transformerpath.com`. Domain covers `https://transformerpath.com` and `www` without a second property.
4. Search Console shows a TXT record. It looks like `google-site-verification=` followed by a token. Copy the whole value.
5. At the DNS host for `transformerpath.com` (the registrar or DNS provider that serves the public zone), add a record:
   - Type: **TXT**
   - Host / name: `@` (the zone apex, `transformerpath.com`). Leave the host blank if the provider treats an empty host as the apex.
   - Value: the full `google-site-verification=...` string from Search Console.
   - TTL: the provider default is fine.
6. Save the record. Do not delete existing TXT records (SPF, other verifications).
7. Back in Search Console, click **Verify**. DNS can take a few minutes. If verification fails, wait and retry. Confirm the TXT is visible with `dig TXT transformerpath.com` or the provider's DNS lookup before retrying.
8. After the domain property is verified, leave the TXT record in place. Removing it drops verification.

URL-prefix properties and HTML-file uploads are not required once the domain property is verified.

## 2. Submit the sitemap

1. In the `transformerpath.com` domain property, open **Sitemaps**.
2. Under **Add a new sitemap**, enter `sitemap.xml`.
3. Submit. The fetched URL is `https://transformerpath.com/sitemap.xml`.
4. Status should become **Success**. The discovered URL count should be in the same range as the sitemap `<loc>` count (about 2,400). A "Couldn't fetch" status means the file was not returned as XML; open the sitemap URL in a browser and confirm it is the current deploy.
5. Resubmit the same sitemap after a release that adds or removes a large set of URLs. Search Console keeps the sitemap and recrawls it; a new submission is only needed when you want to force a refresh.

## 3. Inspect a URL and request indexing

Use this for a page that should be in the index soon (the homepage, a manufacturer profile, an event page, or `/intel.html`). It is not the way to submit the whole site. The sitemap does that.

1. Paste the full URL into the inspection bar at the top of Search Console. Example: `https://transformerpath.com/manufacturers/hitachi-energy/`.
2. Wait for **URL inspection**. Read **Page indexing**.
3. If the page is unknown or crawled but not indexed, and the inspection says the URL is allowed, click **Request indexing**.
4. Google fetches the live URL. The request is queued. It does not promise indexing.
5. If inspection reports **Excluded by robots.txt**, **noindex**, a canonical to a different URL, or a redirect, fix that on the site and deploy before requesting again. Requesting indexing does not override `noindex` or a canonical that points elsewhere.
6. Repeat for a handful of important URLs, not for every manufacturer page.

## 4. Import the site into Bing Webmaster Tools

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/) and sign in.
2. Choose **Import from Google Search Console**.
3. Sign in with the same Google account that owns the `transformerpath.com` domain property and approve access.
4. Select the `transformerpath.com` domain property. Bing imports the verified site and the sitemap list.
5. After import, open **Sitemaps** and confirm `https://transformerpath.com/sitemap.xml` is listed. If the import did not copy it, submit that URL manually.
6. Use **URL Inspection** in Bing the same way as Google: inspect one live URL, then **Request indexing** only when the page should be crawled and is not blocked.

If Google import is unavailable, add the site in Bing with the same DNS TXT method Bing displays, then submit `https://transformerpath.com/sitemap.xml`.
