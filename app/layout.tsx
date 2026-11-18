import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProtoPilot — Hardware design that shows its work",
  description: "Turn a hardware idea into a structured circuit, wiring plan, firmware, and deterministic checks that show their work.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
