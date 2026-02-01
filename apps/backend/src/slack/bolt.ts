import { createRequire } from 'node:module';
import { logSlackEvent } from './logger.js';

const require = createRequire(import.meta.url);
const { App } = require('@slack/bolt') as { App: typeof import('@slack/bolt').App };

const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;

if (!appToken || !botToken) {
  throw new Error('Missing Slack tokens. Set SLACK_APP_TOKEN and SLACK_BOT_TOKEN');
}

export const boltApp = new App({
  token: botToken,
  appToken,
  socketMode: true,
  signingSecret, // Optional but recommended
});

// Log every event from Slack to the terminal
boltApp.use(async ({ payload, next }) => {
  logSlackEvent(payload as Record<string, unknown>);
  await next();
});

// Error handling
boltApp.error(async (error) => {
  console.error('Slack Bolt error:', error);
});
