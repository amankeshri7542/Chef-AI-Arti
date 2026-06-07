import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Poppins, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chief-AI-Arti — Aaj kya banao?",
  description: "Hinglish-first AI recipe assistant for North Indian homemakers",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hi"
      className={`${poppins.variable} ${devanagari.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#E8640C" />
      </head>
      <body className="min-h-full flex flex-col bg-[#FFFDF9] text-[#1A1A1A]">
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
