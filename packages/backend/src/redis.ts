import IORedis from "ioredis";

const url = process.env.REDIS_URL;
let redis: IORedis | null = null;

export function getRedis() {
  if (!url) return null;
  if (!redis) {
    redis = new IORedis(url, {
      tls: url.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    redis.on("error", (e) => console.error("[Redis] error", e));
    redis.on("ready", () => console.log("[Redis] ready"));
    console.log("[Redis] connecting…");
  }
  return redis;
}
