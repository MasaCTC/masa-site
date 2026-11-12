import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "../../design/system/tokens.css";
import "../../design/system/bundle.css";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const DESCRIPTION =
  "CS at UC Irvine. I build apps in public as @masamcodes and post the real numbers: live Instagram stats, project build maps, and my resume.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Masa Chien", template: "%s · Masa Chien" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Masa Chien",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

// Runs before paint: light by default, follows the OS, updates on change.
const themeScript = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var r=document.documentElement;var s=function(){r.setAttribute('data-theme',m.matches?'dark':'light')};s();if(m.addEventListener){m.addEventListener('change',s)}else if(m.addListener){m.addListener(s)}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-type="a"
      className={`${spaceGrotesk.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="mn-root">{children}</body>
    </html>
  );
}
