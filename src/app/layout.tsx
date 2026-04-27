import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo/site";

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
  description:
    "Build a University of Wyoming class schedule that fits, fast and automatic. Pick your courses; we generate every conflict-free weekly schedule from the live UW course catalog.",
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
    description:
      "Build a UW class schedule, fast and automatic.",
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
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
