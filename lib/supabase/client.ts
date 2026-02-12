import { createBrowserClient } from "@supabase/ssr";

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
          // Disable caching for all Supabase requests to ensure fresh data
          return fetch(url, {
            ...options,
            cache: 'no-store',
            headers: {
              ...(options.headers || {}),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
        },
      },
    }
  );
}

export const supabase = createClient();
export { createClient };
