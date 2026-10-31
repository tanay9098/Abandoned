import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/lora";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Abandonment", template: "%s · Abandonment" },
  description: "Your unfinished business has come back to haunt you. A paranormal to-do app.",
};

export const viewport: Viewport = { themeColor: "#0d0e12", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
