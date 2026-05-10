import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account/account-panel";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = (await getDictionary(lang)).account;
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: dict.metaTitle,
    description: dict.metaDescription,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${lang}/account/`,
      languages: {
        en: "/en/account/",
        fr: "/fr/account/",
        "x-default": "/en/account/",
      },
    },
  };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = (await getDictionary(lang as Locale)).account;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-24">
      <AccountPanel dict={dict} lang={lang as Locale} />
    </main>
  );
}
