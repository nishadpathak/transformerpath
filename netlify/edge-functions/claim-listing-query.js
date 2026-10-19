/* Unknown ?slug= values cannot be answered by the static form without JavaScript.
 * A known slug goes to its prerendered page. Any other slug goes to the static
 * not-found page. A request with no slug keeps the blank form.
 */
export default async function claimListingQuery(request, context) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/claim-listing') return context.next();
  const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();
  if (!slug) return context.next();
  const known = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  if (!known) return Response.redirect(new URL('/claim-listing/not-found/', url.origin), 302);
  try {
    const indexRes = await fetch(new URL('/data/claim-listing-index.json', url.origin));
    if (!indexRes.ok) return context.next();
    const index = await indexRes.json();
    if (index && Object.prototype.hasOwnProperty.call(index, slug)) {
      return Response.redirect(new URL('/claim-listing/' + slug + '/', url.origin), 302);
    }
  } catch (err) {
    return context.next();
  }
  return Response.redirect(new URL('/claim-listing/not-found/', url.origin), 302);
}
