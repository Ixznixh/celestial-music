/**
 * Centralized Music API Client
 * 
 * Routes requests to our internal server-side music endpoints (/api/music/*).
 * Provider-specific code (youtubei.js) runs strictly on the backend.
 * No external API keys or base URLs required in the frontend.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(endpoint: string, timeoutMs: number) {
    super(`Request to ${endpoint} timed out after ${timeoutMs}ms`, 408, endpoint);
    this.name = 'ApiTimeoutError';
  }
}

export class RateLimitError extends ApiError {
  constructor(endpoint: string, public retryAfterMs: number = 60000) {
    super(`Rate limit exceeded on ${endpoint}. Try again in ${Math.round(retryAfterMs / 1000)}s`, 429, endpoint);
    this.name = 'RateLimitError';
  }
}

export class ApiNetworkError extends ApiError {
  constructor(endpoint: string, originalError?: any) {
    super(
      `Network error reaching ${endpoint}: ${originalError?.message || 'Connection failed'}`,
      0,
      endpoint,
      originalError
    );
    this.name = 'ApiNetworkError';
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class MusicApiClient {
  private baseUrl: string = '/api/music';
  private defaultTimeoutMs: number = 45000;
  private rateLimitResetTimestamp: number = 0;

  constructor(customBaseUrl?: string) {
    if (customBaseUrl) {
      this.baseUrl = customBaseUrl.replace(/\/+$/, '');
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitResetTimestamp;
  }

  public getRateLimitResetTime(): number {
    return Math.max(0, this.rateLimitResetTimestamp - Date.now());
  }

  /**
   * Centralized GET method for all internal music endpoints
   */
  public async get<T = any>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined | null> = {},
    options: RequestOptions = {}
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // 1. Check client-side rate limit backoff
    if (this.isRateLimited()) {
      const waitTime = this.getRateLimitResetTime();
      throw new RateLimitError(cleanEndpoint, waitTime);
    }

    // 2. Build full path and URL query string
    let urlString = `${this.baseUrl}${cleanEndpoint}`;
    const queryEntries = Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null
    );

    if (queryEntries.length > 0) {
      const searchParams = new URLSearchParams();
      queryEntries.forEach(([key, value]) => {
        searchParams.set(key, String(value));
      });
      urlString += `?${searchParams.toString()}`;
    }

    // 3. Timeout and abort signal orchestration
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    let timeoutId: any = null;
    let didTimeout = false;

    if (options.signal) {
      if (options.signal.aborted) {
        const err = new Error('Request aborted');
        err.name = 'AbortError';
        throw err;
      }
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new ApiTimeoutError(cleanEndpoint, timeoutMs));
      }, timeoutMs);
    });

    try {
      const fetchPromise = fetch(urlString, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      // 4. Handle HTTP 429
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 60 : 60;
        const cooldownMs = retrySeconds * 1000;
        this.rateLimitResetTimestamp = Date.now() + cooldownMs;
        throw new RateLimitError(cleanEndpoint, cooldownMs);
      }

      // 5. Handle non-2xx status codes
      if (!response.ok) {
        let errorBody: any = null;
        try {
          const rawErr = await response.text();
          if (!rawErr.trim().startsWith('<')) {
            errorBody = JSON.parse(rawErr);
          }
        } catch {
          // Ignored
        }
        throw new ApiError(
          `Music API request failed: ${response.status} ${response.statusText}`,
          response.status,
          cleanEndpoint,
          errorBody
        );
      }

      // 6. Safe JSON parsing with HTML fallback handling
      const rawText = await response.text();
      if (rawText.trim().startsWith('<')) {
        // Detected HTML page (SPA index.html or proxy page). Attempt alternate base URL.
        const altBase = this.baseUrl === '/api/music' ? '/api' : '/api/music';
        let altUrl = `${altBase}${cleanEndpoint}`;
        if (queryEntries.length > 0) {
          const searchParams = new URLSearchParams();
          queryEntries.forEach(([key, value]) => searchParams.set(key, String(value)));
          altUrl += `?${searchParams.toString()}`;
        }

        try {
          const altRes = await fetch(altUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(options.headers || {}),
            },
            signal: controller.signal,
          });

          if (altRes.ok) {
            const altText = await altRes.text();
            if (!altText.trim().startsWith('<')) {
              this.baseUrl = altBase; // Permanently switch to functioning prefix
              return JSON.parse(altText) as T;
            }
          }
        } catch {
          // Continue to error
        }

        throw new ApiError(
          `Endpoint ${cleanEndpoint} returned HTML instead of JSON. Server may be starting up.`,
          response.status,
          cleanEndpoint
        );
      }

      const data = JSON.parse(rawText);
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      // If user aborted via options.signal, rethrow original AbortError without error toast
      if (err.name === 'AbortError' && !didTimeout) {
        throw err;
      }

      if (didTimeout || err.name === 'AbortError') {
        throw new ApiTimeoutError(cleanEndpoint, timeoutMs);
      }

      throw new ApiNetworkError(cleanEndpoint, err);
    }
  }
}

// Singleton centralized client
export const musicApi = new MusicApiClient();
