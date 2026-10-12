import type { Metadata } from "next";
import "./globals.css";

const description =
  "Mimus rewrites English text between writing styles such as LinkedIn, Corporate, and plain English. Translate meaning, not just words.";

export const metadata: Metadata = {
  title: "Mimus",
  description,
  openGraph: {
    title: "Mimus",
    description,
    siteName: "Mimus",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mimus",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
