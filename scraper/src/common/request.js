// scraper/src/common/request.js
import axios from "axios";
import Bottleneck from "bottleneck";

/**
 * Simple HTTP client with retries and rate-limiting using Bottleneck.
 * Exports: fetchHtml(url, opts) -> returns { status, data, headers }
 */

// Rate limiter: 4 requests per second, max 2 concurrent (tune as required)
const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 800     // 1 request per 0.8 seconds
  });   

// axios instance with some defaults
const client = axios.create({
    timeout: 30000,
    maxRedirects: 0,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "Referer":
        "https://www.indiacode.nic.in/handle/123456789/1362/browse?type=dateissued",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Connection": "keep-alive",
      "DNT": "1"
    }
  });
  
  
  

async function tryRequest(config, retries = 3) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await client.request(config);
      return res;
    } catch (err) {
      lastErr = err;
      const delay = Math.pow(2, i) * 500; // exponential backoff
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * fetchHtml(url, { retries })
 * returns { status, data, headers }
 */
export async function fetchHtml(url, opts = {}) {
  const { retries = 3 } = opts;
  return limiter.schedule(() => tryRequest({ url, method: "GET" }, retries));
}

/**
 * fetchBinary(url) - for PDFs
 */
export async function fetchBinary(url, opts = {}) {
  const { retries = 3 } = opts;
  return limiter.schedule(() =>
    tryRequest({ url, method: "GET", responseType: "arraybuffer" }, retries)
  );
}
