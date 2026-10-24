import { Figtree } from "next/font/google"

// Free stand-in for Bahn's body face, Duplet Open (light 300, 600 for captions and
// buttons). Only the Overview's website look uses it; the rest of the tool stays Geist.
// Archivo at width 125 (Owners Wide) comes from the root layout.
export const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree", display: "swap" })
