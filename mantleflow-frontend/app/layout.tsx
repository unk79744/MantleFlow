import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/AppContext";
import { Web3Provider } from "@/components/Web3Provider";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "MantleFlow",
  description: "Real-time whale transaction tracking on Mantle Network",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="bg-[#F6F8FA] font-sans antialiased text-slate-900">
        <Web3Provider>
          <AppProvider>{children}</AppProvider>
        </Web3Provider>
      </body>
    </html>
  );
}