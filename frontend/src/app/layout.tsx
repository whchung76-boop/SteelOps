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
  title: "SteelOps - 견적 이력 검색",
  description: "철강 설비 영업·견적 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        <header className="bg-slate-900 text-white h-16 flex items-center px-6 shrink-0 shadow-md">
          <h1 className="text-xl font-bold tracking-wider">
            SteelOps<span className="text-blue-400 font-medium ml-2 text-sm">영업·견적 관리</span>
          </h1>
          <nav className="ml-10 flex gap-6">
            <a href="/" className="text-white font-semibold border-b-2 border-blue-400 pb-1">견적 이력 검색</a>
            <a href="#" className="text-slate-300 hover:text-white pb-1">신규 견적 작성</a>
            <a href="#" className="text-slate-300 hover:text-white pb-1">대시보드</a>
          </nav>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
