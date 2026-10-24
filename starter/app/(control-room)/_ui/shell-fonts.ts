import { Archivo } from "next/font/google"

// Archivo's true italic (the root layout loads the upright only), set on the shell: "room"
// in the "bahn / Control room" lockup (light italic, as Aalto sets "Sprint") and
// "Bahn Express" in the Overview's welcome, which echoes it.
export const archivoItalic = Archivo({ subsets: ["latin"], style: ["italic"], axes: ["wdth"], variable: "--font-archivo-italic", display: "swap" })
