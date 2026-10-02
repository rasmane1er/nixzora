import { APP_LINK_PATHS, iosAppIds } from '@/lib/app-links';

export const dynamic = 'force-dynamic';

/** Served without an extension, as application/json, as Apple requires. */
export function GET(): Response {
  const appIDs = iosAppIds();
  if (!appIDs.length) return new Response('Not found', { status: 404 });
  return Response.json(
    {
      applinks: {
        details: [{ appIDs, components: APP_LINK_PATHS.map((path) => ({ '/': path })) }],
      },
      webcredentials: { apps: appIDs },
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
