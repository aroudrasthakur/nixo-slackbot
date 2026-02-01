import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { openaiLimiter } from '../pipeline/limiter';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate OpenAI embedding for text.
 */
export async function getOpenAIEmbedding(text: string): Promise<number[]> {
  return await openaiLimiter(async () => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 2000),
    });
    return response.data[0].embedding;
  });
}
