import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { getGithubStars } from "@/lib/github";
import { getDictionary } from "@/dictionaries";
import { isLocale, locales, type Locale } from "@/lib/i18n";

const GITHUB_REPO = "ericvaillancourt/govforge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> },
): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const ogLocale = lang === "fr" ? "fr_CA" : "en_US";
  const altLocale = lang === "fr" ? "en_US" : "fr_CA";
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: {
      default: dict.metadata.title,
      template: "%s · GovForge",
    },
    description: dict.metadata.description,
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
    alternates: {
      canonical: `/${lang}/`,
      languages: {
        en: "/en/",
        fr: "/fr/",
        "x-default": "/en/",
      },
    },
    openGraph: {
      type: "website",
      url: `https://govforge.dev/${lang}/`,
      siteName: "GovForge",
      title: dict.metadata.ogTitle,
      description: dict.metadata.ogDescription,
      locale: ogLocale,
      alternateLocale: altLocale,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "GovForge — Govern AI coding agents before they govern your codebase.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.metadata.twitterTitle,
      description: dict.metadata.twitterDescription,
      images: ["/opengraph-image"],
    },
    // Icons + OG/Twitter images intentionally omitted: Next picks up the
    // app/icon.tsx, app/apple-icon.tsx, and app/opengraph-image.tsx routes
    // automatically and injects the right <link>/<meta> tags. Setting
    // `icons.icon` here would shadow the generated `/icon` route.
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang as Locale);
  const stars = await getGithubStars(GITHUB_REPO);

  return (
    <html
      lang={lang}
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
          <Nav stars={stars} repo={GITHUB_REPO} dict={dict.nav} lang={lang as Locale} />
          <main className="flex-1">{children}</main>
          <Footer dict={dict.footer} lang={lang as Locale} />
        </ThemeProvider>
      </body>
    </html>
  );
}
