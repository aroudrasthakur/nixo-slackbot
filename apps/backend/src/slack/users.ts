import { boltApp } from './bolt';

// In-memory cache for user info (userId -> display name)
const userCache = new Map<string, { name: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch display name for a Slack user ID.
 * Uses cache to avoid repeated API calls.
 */
export async function getSlackUsername(userId: string): Promise<string | null> {
  // Check cache
  const cached = userCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.name;
  }

  try {
    const result = await boltApp.client.users.info({ user: userId });

    if (!result.ok || !result.user) {
      console.warn('[SlackUsers] Failed to fetch user info for:', userId);
      return null;
    }

    // Prefer display_name > real_name > name
    const user = result.user as {
      profile?: { display_name?: string; real_name?: string };
      real_name?: string;
      name?: string;
    };

    const displayName =
      user.profile?.display_name ||
      user.profile?.real_name ||
      user.real_name ||
      user.name ||
      null;

    if (displayName) {
      userCache.set(userId, {
        name: displayName,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return displayName;
  } catch (error: unknown) {
    const err = error as { code?: string; data?: { error?: string; needed?: string } };
    if (err?.code === 'slack_webapi_platform_error' && err?.data?.error === 'missing_scope') {
      // Log once per scope so we don't spam; user needs to add users:read in Slack app OAuth & Permissions
      if (!userCache.has('_scope_warned')) {
        userCache.set('_scope_warned', { name: '', expiresAt: Date.now() + 60 * 60 * 1000 });
        console.warn('[SlackUsers] Missing Slack scope:', err.data?.needed ?? 'users:read', '- Add it in Slack app OAuth & Permissions and reinstall. Usernames will show as IDs until then.');
      }
    } else {
      console.error('[SlackUsers] Error fetching user info:', error);
    }
    return null;
  }
}
