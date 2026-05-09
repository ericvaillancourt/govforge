import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://govforge.dev"),
  title: {
    default: "GovForge — Governance infrastructure for AI coding agents",
    template: "%s · GovForge",
  },
  description:
    "Audit, review and govern every code decision produced by Claude Code, Codex, Cursor and other AI coding agents. Local-first, Git-native, Apache 2.0.",
  keywords: [
    "AI governance",
    "AI coding agents",
    "Claude Code",
    "Codex",
    "Cursor",
    "MCP",
    "Model Context Protocol",
    "audit trail",
    "code review",
    "policy engine",
  ],
  authors: [{ name: "GovForge" }],
  openGraph: {
    type: "website",
    url: "https://govforge.dev",
    siteName: "GovForge",
    title: "GovForge — Governance infrastructure for AI coding agents",
    description:
      "Audit, review and govern every code decision produced by AI coding agents. Local-first, Git-native, Apache 2.0.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GovForge — Governance infrastructure for AI coding agents",
    description:
      "Audit, review and govern every code decision produced by AI coding agents.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
