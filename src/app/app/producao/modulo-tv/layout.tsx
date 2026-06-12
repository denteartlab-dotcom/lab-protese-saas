import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-tv-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-tv-mono",
  display: "swap",
});

export default function ModuloTvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} ${jetbrainsMono.variable} font-tv h-[100vh] w-[100vw] max-w-none overflow-hidden antialiased`}
    >
      {children}
    </div>
  );
}
