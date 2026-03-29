import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: "BÈR — Excelência Operacional",
  description: "Sistema interno BÈR — Excelência Operacional",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BÈR App",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} h-full min-h-dvh`}>
      <body className="h-full min-h-dvh antialiased">{children}</body>
    </html>
  );
}
