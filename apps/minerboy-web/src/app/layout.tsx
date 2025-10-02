import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalWalletModal from "./GlobalWalletModal";
import MaintenanceGate from "@/components/MaintenanceGate";
import ClosedOverlay from "@/components/ClosedOverlay";
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
  description: "NFT-gated crypto mining PWA",
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
          {/* CLOSED overlay to prevent access during migration */}
          <ClosedOverlay />
        </GlyphWalletProvider>
      </body>
    </html>
  );
}
// Force redeploy - Tue Sep 16 00:26:11 BST 2025
// Fresh build - Web3ModalBridge references removed
