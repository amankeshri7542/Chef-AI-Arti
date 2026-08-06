import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Poppins, Noto_Sans_Devanagari, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./premium-ui.css";
import "./production-overrides.css";
import SWUpdater from "@/components/SWUpdater/SWUpdater";
import PHProvider from "@/components/PHProvider/PHProvider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Chef Arti",
  title: {
    default: "Chef Arti — Aaj kya banao?",
    template: "%s · Chef Arti",
  },
  description: "Hinglish-first AI rasoi assistant for everyday Indian cooking.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chef Arti",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E8640C",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hi"
      className={`${poppins.variable} ${devanagari.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FFFDF9] text-[#1A1A1A]">
        <ClerkProvider>
          <PHProvider>
            <SWUpdater />
            {children}
          </PHProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
