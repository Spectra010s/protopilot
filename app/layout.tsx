import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProtoPilot — Hardware design that shows its work",
  description: "Turn a hardware idea into a structured circuit, wiring plan, firmware, and deterministic checks that show their work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
