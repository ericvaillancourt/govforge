import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevicePanel } from "@/components/account/device-panel";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = (await getDictionary(lang)).device;
  return {
    metadataBase: new URL("https://govforge.dev"),
    title: dict.metaTitle,
    description: dict.metaDescription,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${lang}/device/`,
      languages: {
        en: "/en/device/",
        fr: "/fr/device/",
        "x-default": "/en/device/",
      },
    },
  };
}

export default async function DevicePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = (await getDictionary(lang as Locale)).device;

  return (
    <main className="mx-auto max-w-md px-4 sm:px-6 py-16 sm:py-24">
      <header>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {dict.heading}
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {dict.subheading}
        </p>
      </header>

      <DevicePanel lang={lang as Locale} dict={dict} />
    </main>
  );
}
