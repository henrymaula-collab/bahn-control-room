import { Archivo } from "next/font/google"

// Archivo's true italic (the root layout loads the upright only), for "room" in the
// "bahn / Control room" lockup, set light italic the way Aalto sets "Sprint".
export const archivoItalic = Archivo({ subsets: ["latin"], style: ["italic"], axes: ["wdth"], variable: "--font-archivo-italic", display: "swap" })
