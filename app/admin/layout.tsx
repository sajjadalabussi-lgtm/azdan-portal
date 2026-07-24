import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "أزدان للمقاولات العامة",
  description: "نظام إدارة مشاريع وعملاء شركة أزدان للمقاولات العامة",

  manifest: "/manifest.webmanifest",

  applicationName: "أزدان",

  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "أزدان",
  },

  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}