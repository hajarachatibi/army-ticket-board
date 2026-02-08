import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Providers from "@/components/Providers";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Army Ticket Board",
  description: "Find, book, and manage BTS concert tickets with ARMY.",
  icons: {
    icon: [{ url: "/army-ticket-board-logo.png", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Army Ticket Board",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Army Ticket Board" />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
