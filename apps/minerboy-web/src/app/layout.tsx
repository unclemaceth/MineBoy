import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalWalletModal from "./GlobalWalletModal";
import MaintenanceGate from "@/components/MaintenanceGate";
import ClosedOverlay from "@/components/ClosedOverlay";
import SeasonEndOverlay from "@/components/SeasonEndOverlay";
import GlyphWalletProvider from "./GlyphWalletProvider";
import W3MInit from "./W3MInit";
import WCAccountBridge from '@/components/WCAccountBridge';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MineBoy",
  description: "Gamified cryptographic SHA256 mining. Real Proof-of-Work Mining, in-browser. MINE TO WIN! Now featuring MineStrategy! Created by Not a Punks Cult @NGMI.land. Powered by ApeCoin.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MineBoy",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "MineBoy",
    description: "Gamified cryptographic SHA256 mining. Real Proof-of-Work Mining, in-browser. MINE TO WIN! Now featuring MineStrategy! Created by Not a Punks Cult @NGMI.land. Powered by ApeCoin.",
    url: "https://mineboy.gg",
    siteName: "MineBoy",
    images: [
      {
        url: "/mineboylogo.png",
        width: 1200,
        height: 630,
        alt: "MineBoy Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MineBoy",
    description: "Gamified cryptographic SHA256 mining. Real Proof-of-Work Mining, in-browser. MINE TO WIN! Now featuring MineStrategy! Created by Not a Punks Cult @NGMI.land. Powered by ApeCoin.",
    images: ["/mineboylogo.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlyphWalletProvider>
          <W3MInit />
          <WCAccountBridge />
          {children}
          {/* mounted once globally */}
          <GlobalWalletModal />
              {/* Sits on top when maintenance is enabled */}
              <MaintenanceGate />
              {/* Season 1 Beta Test ended - commented out for testing */}
              {/* <SeasonEndOverlay /> */}
        </GlyphWalletProvider>
      </body>
    </html>
  );
}
// Force redeploy - Timeout cooldown restored - Fri Oct 3 2025
// Fresh build - Web3ModalBridge references removed
