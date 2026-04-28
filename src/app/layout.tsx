import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SkipToMain } from "@/components/seo/SkipToMain";
import {
  SITE_DESCRIPTION,
  SITE_DESCRIPTION_SHORT,
  SITE_URL,
} from "@/lib/seo/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
  preload: true,
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-app-serif",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-app-mono",
  display: "swap",
  preload: false,
});

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "uwyoschedule — University of Wyoming class schedule planner",
    template: "%s · uwyoschedule",
  },
  description: SITE_DESCRIPTION,
  applicationName: "uwyoschedule",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "uwyoschedule",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "uwyoschedule",
    description: SITE_DESCRIPTION_SHORT,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/apple-icon",
  },
  manifest: "/manifest.webmanifest",
  authors: [{ name: "uwyoschedule" }],
  category: "education",
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1F1A14" },
  ],
};

/**
 * Inline script that runs before paint, applies the stored theme preference
 * to <html>, and prevents the brief light-to-dark (or vice versa) flash that
 * happens when a useEffect-based theme toggle hydrates.
 *
 * Mirrors the storage key and "system" semantics in `ThemeToggle`.
 */
const NO_THEME_FLASH_SCRIPT = `(()=>{try{var k='uwyoschedule-theme';var v=localStorage.getItem(k);var d=v==='dark'||(v!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif4.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_THEME_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SkipToMain />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
