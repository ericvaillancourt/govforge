import { Hero } from "@/components/sections/hero";
import { SupportedAgents } from "@/components/sections/supported-agents";
import { ProblemStatement } from "@/components/sections/problem-statement";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { WorkflowDemo } from "@/components/sections/workflow-demo";
import { ArchitectureDiagram } from "@/components/sections/architecture-diagram";
import { OssVsEnterprise } from "@/components/sections/oss-vs-enterprise";
import { TrustStrip } from "@/components/sections/trust-strip";
import { FinalCta } from "@/components/sections/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SupportedAgents />
      <ProblemStatement />
      <FeaturesGrid />
      <WorkflowDemo />
      <ArchitectureDiagram />
      <OssVsEnterprise />
      <TrustStrip />
      <FinalCta />
    </>
  );
}
