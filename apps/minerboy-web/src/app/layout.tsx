import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";
import GlobalWalletModal from "./GlobalWalletModal";
import MaintenanceGate from "@/components/MaintenanceGate";
import ClosedOverlay from "@/components/ClosedOverlay";

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
        <Providers>
          {children}
          {/* mounted once globally */}
          <GlobalWalletModal />
          {/* Sits on top when maintenance is enabled */}
          <MaintenanceGate />
          {/* CLOSED overlay for main branch - commented out for B branch */}
          {/* <ClosedOverlay /> */}
        </Providers>
      </body>
    </html>
  );
}
// Force redeploy - Tue Sep 16 00:26:11 BST 2025
