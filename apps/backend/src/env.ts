/**
 * Load root .env before any other app code runs.
 * Must be imported first in index.ts so process.env is set before bolt and others read it.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/backend/src -> go up to repo root
config({ path: resolve(__dirname, '../../../.env') });
