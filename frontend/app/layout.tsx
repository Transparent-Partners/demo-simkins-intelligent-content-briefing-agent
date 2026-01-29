import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ModCon Planning Tool",
  description: "Modular Activation Planning Workspace for Creative, Production, and Media Alignment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

