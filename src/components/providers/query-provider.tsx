"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * QueryProvider — TanStack Query client provider.
 *
 * Defaults are tuned for a dashboard application:
 * - longer stale time (60s) to reduce refetch thrash on tab switches
 * - retry once on failure to be resilient to transient network errors
 * - no automatic refetch on window focus (avoid disrupting the user)
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
