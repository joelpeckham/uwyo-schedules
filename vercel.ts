import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  headers: [
    {
      source: '/courses(.*)',
      // Edge cache: 1h fresh, background revalidate up to 24h.
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      ],
    },
    {
      source: '/terms(.*)',
      // Same cache policy as /courses.
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      ],
    },
  ],

  crons: [
    // Hot ingest: refresh active-term schedule data every 2 hours.
    { path: '/api/cron/banner-ingest?mode=hot', schedule: '0 */2 * * *' },

    // Archive ingest: nightly pass over historical terms (00:30 UTC).
    { path: '/api/cron/banner-ingest?mode=archive', schedule: '30 0 * * *' },

    // Course descriptions: nightly, after archive ingest (01:45 UTC).
    { path: '/api/cron/banner-descriptions', schedule: '45 1 * * *' },
  ],
};
