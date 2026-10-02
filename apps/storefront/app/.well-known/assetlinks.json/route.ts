import { androidFingerprints, androidPackage } from '@/lib/app-links';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const fingerprints = androidFingerprints();
  if (!fingerprints.length) return new Response('Not found', { status: 404 });
  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: androidPackage(),
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
