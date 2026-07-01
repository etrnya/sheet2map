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
  title: {
    default: "Sheet2Map 互動地圖平台",
    template: "%s | Sheet2Map 互動地圖"
  },
  description: "任何試算表、OpenData，都能一秒轉成手機版互動地圖。",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Sheet2Map 互動地圖平台",
    description: "任何試算表、OpenData，都能一秒轉成手機版互動地圖。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sheet2Map Interactive Map Platform",
      }
    ],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
