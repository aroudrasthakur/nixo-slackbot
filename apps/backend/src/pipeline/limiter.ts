import pLimit from 'p-limit';

const concurrency = parseInt(process.env.OPENAI_CONCURRENCY || '3', 10);

export const openaiLimiter = pLimit(concurrency);
