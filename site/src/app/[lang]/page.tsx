import { notFound } from "next/navigation";
import { Hero } from "@/components/sections/hero";
import { SupportedAgents } from "@/components/sections/supported-agents";
import { ProblemStatement } from "@/components/sections/problem-statement";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { WorkflowDemo } from "@/components/sections/workflow-demo";
import { ArchitectureDiagram } from "@/components/sections/architecture-diagram";
import { OssVsEnterprise } from "@/components/sections/oss-vs-enterprise";
import { TrustStrip } from "@/components/sections/trust-strip";
import { FinalCta } from "@/components/sections/final-cta";
import { getDictionary } from "@/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const dict = await getDictionary(locale);

  return (
    <>
      <Hero dict={dict.hero} lang={locale} />
      <SupportedAgents dict={dict.supportedAgents} />
      <ProblemStatement dict={dict.problemStatement} />
      <FeaturesGrid dict={dict.features} />
      <WorkflowDemo dict={dict.workflow} lang={locale} />
      <ArchitectureDiagram dict={dict.architecture} />
      <OssVsEnterprise dict={dict.ossVsEnterprise} lang={locale} />
      <TrustStrip dict={dict.trustStrip} />
      <FinalCta dict={dict.finalCta} lang={locale} />
    </>
  );
}
