import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import { QueryProvider } from "@/components/QueryProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "GovForge Cockpit",
  description: "Local cockpit for governing AI coding agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
