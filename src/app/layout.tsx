import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SkipToMain } from "@/components/seo/SkipToMain";
import { Toaster } from "@/components/ui/sonner";
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
    default: "UW class schedule planner · uwyoschedule",
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
  themeColor: "#FBF7F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif4.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className={`${inter.className} min-h-full flex flex-col font-sans`}
      >
        <SkipToMain />
        {children}
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
