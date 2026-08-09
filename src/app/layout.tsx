import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Island Coolers — Cool Drinks. Good Vibes.",
    template: "%s · Island Coolers",
  },
  description:
    "Order soda flavors, iced coffee, and matcha online. Track delivery, earn points, and redeem rewards.",
  keywords: ["Island Coolers", "drinks", "delivery", "soda", "matcha", "coffee"],
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/brand/island-coolers-logo.png", sizes: "1024x1024" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#176B3A",
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
