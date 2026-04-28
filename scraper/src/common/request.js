// scraper/src/common/request.js
import axios from "axios";
import Bottleneck from "bottleneck";

/**
 * Simple HTTP client with retries and rate-limiting using Bottleneck.
 * Exports: fetchHtml(url, opts) -> returns { status, data, headers }
 */

function parseIntWithDefault(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPositiveInt(value, fallback, minimum = 1) {
  return Math.max(minimum, parseIntWithDefault(value, fallback));
}

function getNonNegativeInt(value, fallback) {
  return Math.max(0, parseIntWithDefault(value, fallback));
}

const htmlRequestConcurrency = getPositiveInt(
  process.env.SCRAPER_HTML_REQUEST_CONCURRENCY ??
    process.env.SCRAPER_REQUEST_CONCURRENCY,
  1
);
const htmlRequestMinTime = getNonNegativeInt(
  process.env.SCRAPER_HTML_REQUEST_MIN_TIME_MS ??
    process.env.SCRAPER_REQUEST_MIN_TIME_MS,
  800
);
const binaryRequestConcurrency = getPositiveInt(
  process.env.SCRAPER_BINARY_REQUEST_CONCURRENCY,
  Math.max(2, htmlRequestConcurrency)
);
const binaryRequestMinTime = getNonNegativeInt(
  process.env.SCRAPER_BINARY_REQUEST_MIN_TIME_MS,
  Math.max(150, Math.floor(htmlRequestMinTime / 3))
);
const defaultHtmlRetries = getNonNegativeInt(
  process.env.SCRAPER_HTML_REQUEST_RETRIES ??
    process.env.SCRAPER_REQUEST_RETRIES,
  3
);
const defaultBinaryRetries = getNonNegativeInt(
  process.env.SCRAPER_BINARY_REQUEST_RETRIES,
  2
);
const defaultHtmlTimeout = getPositiveInt(
  process.env.SCRAPER_HTML_TIMEOUT_MS ??
    process.env.SCRAPER_REQUEST_TIMEOUT_MS,
  30000
);
const defaultBinaryTimeout = getPositiveInt(
  process.env.SCRAPER_BINARY_TIMEOUT_MS ??
    process.env.SCRAPER_REQUEST_TIMEOUT_MS,
  45000
);

const htmlLimiter = new Bottleneck({
  maxConcurrent: htmlRequestConcurrency,
  minTime: htmlRequestMinTime,
});

const binaryLimiter = new Bottleneck({
  maxConcurrent: binaryRequestConcurrency,
  minTime: binaryRequestMinTime,
});

// axios instance with some defaults
const client = axios.create({
    timeout: defaultHtmlTimeout,
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
  const {
    retries = defaultHtmlRetries,
    maxRedirects = 0,
    responseType,
    timeout = defaultHtmlTimeout,
  } = opts;
  return htmlLimiter.schedule(() =>
    tryRequest(
      { url, method: "GET", maxRedirects, responseType, timeout },
      retries
    )
  );
}

/**
 * fetchBinary(url) - for PDFs
 */
export async function fetchBinary(url, opts = {}) {
  const {
    retries = defaultBinaryRetries,
    maxRedirects = 0,
    timeout = defaultBinaryTimeout,
  } = opts;
  return binaryLimiter.schedule(() =>
    tryRequest(
      {
        url,
        method: "GET",
        responseType: "arraybuffer",
        maxRedirects,
        timeout,
      },
      retries
    )
  );
}

export function getRequestTuning() {
  return {
    html: {
      concurrency: htmlRequestConcurrency,
      minTimeMs: htmlRequestMinTime,
      retries: defaultHtmlRetries,
      timeoutMs: defaultHtmlTimeout,
    },
    binary: {
      concurrency: binaryRequestConcurrency,
      minTimeMs: binaryRequestMinTime,
      retries: defaultBinaryRetries,
      timeoutMs: defaultBinaryTimeout,
    },
  };
}
