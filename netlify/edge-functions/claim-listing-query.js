/* A ?slug= query cannot be answered by the static form without JavaScript.
 * Every slug-shaped value is a 301 to /claim-listing/<slug>/.
 * A known slug is that listing. An unknown slug is the path that already
 * returns 404. A request with no slug keeps the blank form.
 */
export default async function claimListingQuery(request, context) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/claim-listing') return context.next();
  const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return context.next();
  return Response.redirect(new URL('/claim-listing/' + slug + '/', url.origin), 301);
}
