// Small fetch wrapper with a hard timeout. Both network calls on the page are
// optional extras, so a slow endpoint must give up quickly and let the UI fall back.

export type FetchJsonOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  /** Caller's signal, e.g. aborted when inputs change or the component unmounts. */
  signal?: AbortSignal;
};

export async function fetchJson(url: string, options: FetchJsonOptions): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const outer = options.signal;
  // Forward the outer signal by hand: AbortSignal.any is newer than the browsers Next 16 targets.
  const forwardAbort = () => controller.abort();

  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forwardAbort);
  }
}
