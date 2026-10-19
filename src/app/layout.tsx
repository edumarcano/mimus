import type { Metadata } from "next";
import "./globals.css";

const description =
  "Mimus rewrites English text between writing styles such as LinkedIn, Corporate, and plain English. Translate meaning, not just words.";

// Canonical public origin; resolves social image URLs independent of the
// per-deployment host Vercel would otherwise infer.
const CANONICAL_ORIGIN = "https://mimus-rewrite.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
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

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mimus:theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(!t&&d)||(t==="system"&&d)){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
