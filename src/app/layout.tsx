import type { Metadata, Viewport } from "next";
import { Changa, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const changa = Changa({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Khrov",
  description: "Second Brain — notas conectadas, tags e pastas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "Khrov",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${changa.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ServiceWorkerRegister />
        <AuthSessionProvider>
          <ThemeProvider>
            <TooltipProvider delay={200}>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
