import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  fontFeatures: [
    { name: "cv02", value: "1" },
    { name: "cv03", value: "1" },
    { name: "cv04", value: "1" },
    { name: "cv11", value: "1" },
    { name: "ss01", value: "1" },
  ],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Leadforge — Self-hosted Lead Intelligence",
  description:
    "Discover, enrich, qualify and manage high-quality SaaS startup leads. A self-hosted, production-grade alternative to Apollo.",
  keywords: [
    "lead generation",
    "B2B leads",
    "SaaS leads",
    "self-hosted",
    "Apollo alternative",
    "lead intelligence",
  ],
  authors: [{ name: "Leadforge" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Leadforge — Self-hosted Lead Intelligence",
    description:
      "Discover, enrich, qualify and manage high-quality SaaS startup leads.",
    siteName: "Leadforge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leadforge",
    description:
      "Discover, enrich, qualify and manage high-quality SaaS startup leads.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={300}>
              {children}
              <Toaster />
              <SonnerToaster
                position="bottom-right"
                theme="dark"
                toastOptions={{
                  style: {
                    background:
                      "oklch(0.17 0.005 264 / 95%)",
                    border: "1px solid oklch(1 0 0 / 8%)",
                    color: "oklch(0.97 0.002 240)",
                  },
                }}
              />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
