"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/**
 * ThemeProvider — wraps next-themes to enforce dark-first experience.
 * The application is designed dark-first; light theme is supported but
 * dark is the canonical, premium experience.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
