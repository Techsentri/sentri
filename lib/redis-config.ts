// Vercel's Upstash integration provisions KV_* names. Keep custom REST names supported.
export function redisSettings(env: Record<string, string | undefined> = process.env) {
  if (env.REDIS_REST_URL && env.REDIS_REST_TOKEN) return { url: env.REDIS_REST_URL, token: env.REDIS_REST_TOKEN };
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  return null;
}
// The account's Redis resource can be shared; never use another application's key space.
export const redisKey = (key: string) => `sentri:v1:${key}`;
