/**
 * Logs every event received from Slack to the terminal.
 * Used by Bolt global middleware.
 */
export function logSlackEvent(payload: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const type = (payload as { type?: string }).type ?? 'unknown';
  const eventType = (payload as { event?: { type?: string } }).event?.type;
  const label = eventType ? `${type}/${eventType}` : type;

  console.log('\n[Slack]', ts, '|', label);
  console.log('[Slack] payload:', JSON.stringify(payload, null, 2));
  console.log('[Slack] ---');
}
