/**
 * Client HTTP avec rotation User-Agent et delais aleatoires
 * pour eviter les blocages lors du scraping
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.120 Safari/537.36",
];

let uaIndex = 0;

export function getRandomUA(): string {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return ua;
}

export function randomDelay(min = 600, max = 2000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": getRandomUA(),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Cache-Control": "max-age=0",
    ...(referer ? { Referer: referer } : {}),
  };
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  signal?: AbortSignal
): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (signal?.aborted) return null;
      const res = await fetch(url, {
        ...options,
        signal: signal ?? AbortSignal.timeout(15000),
        headers: {
          ...buildHeaders(),
          ...(options.headers as Record<string, string> || {}),
        },
      });
      if (res.ok) return res;
      console.warn(`fetchWithRetry: HTTP ${res.status} pour ${url.substring(0, 80)}`);
      if (res.status === 429 || res.status === 503) {
        await randomDelay(3000, 7000);
        continue;
      }
      return null;
    } catch (err) {
      console.warn(`fetchWithRetry: erreur tentative ${attempt + 1}/${maxRetries} - ${err}`);
      if (attempt < maxRetries - 1) await randomDelay(1000, 3000);
    }
  }
  return null;
}
