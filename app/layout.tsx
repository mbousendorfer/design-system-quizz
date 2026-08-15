import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: copy.app.name,
  description: copy.app.tagline,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <head>
        {/* Averta, for the live component renders. `@font-face` is ignored inside
            adoptedStyleSheets — font registration is document-scoped — so this one
            sheet is linked here. It declares nothing but @font-face, so it cannot
            restyle the quiz's own interface. */}
        <link rel="stylesheet" href="/ds/fonts.css" />
      </head>
      <body>
        {/* Visible only once focused: a keyboard player should not have to tab
            through the admin nav to reach the question they are being timed on. */}
        <a
          href="#content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-popover focus-visible:px-3 focus-visible:py-2 focus-visible:text-popover-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.app.skipToContent}
        </a>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
