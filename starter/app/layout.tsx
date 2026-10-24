import type { Metadata, Viewport } from "next"
import { Archivo, Geist, Geist_Mono } from "next/font/google"
import { Agentation } from "agentation"

// Root layout: fonts and the dev-only feedback tool. Each world brings its own
// stylesheet in its route group: (control-room) for our screens, (starter) for
// the starter's record pages, so neither leaks into the other.

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" })
// Free stand-in for Bahn's Owners Wide: Archivo at width 125, weight 600. Page titles only.
const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-archivo", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Control room", template: "%s" },
  description: "Bahn's control room: agents do the legwork, people decide.",
}

export const viewport: Viewport = { themeColor: "#fffef7", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${archivo.variable}`}>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  )
}
