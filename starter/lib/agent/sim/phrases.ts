// Fixed phrases for the mock call (no model). The live providers let the
// model speak freely; these keep a fresh clone's mock calls believable.

type Phrases = {
  greeting: (place: string, role: string, name: string) => string
  intro: (ref: string, car: string) => string
  askReady: string
  askRelease: string
  ack: string
  askMore: string
  nothingElse: string
  closeDecision: string
  closeOk: string
  bye: string
  callbackIntro: (ref: string) => string
}

export const PHRASES: Record<string, Phrases> = {
  en: {
    greeting: (place, role, name) => `${place}, ${role}, ${name} speaking.`,
    intro: (ref, car) => `Hello, this is Bahn's digital assistant, calling about pickup ${ref}, the ${car}.`,
    askReady: "Is the car ready for the pickup, where are the keys, and is anything needed before the car can leave?",
    askRelease: "Has the signed release document for this car reached you?",
    ack: "Understood.",
    askMore: "Is there anything else the driver needs to know?",
    nothingElse: "No, that's all.",
    closeDecision: "Thank you. A colleague needs to decide this. We'll get back to you within the hour.",
    closeOk: "Thank you, that's all clear. Goodbye.",
    bye: "You're welcome, goodbye.",
    callbackIntro: (ref) => `Hello again, this is Bahn's digital assistant about pickup ${ref}. As promised, I'm calling back.`,
  },
  de: {
    greeting: (place, role, name) => `${place}, ${role}, ${name} am Apparat.`,
    intro: (ref, car) => `Guten Tag, hier ist der digitale Assistent von Bahn. Es geht um die Abholung ${ref}, den ${car}.`,
    askReady: "Ist das Auto zur Abholung bereit, wo sind die Schlüssel, und braucht es vor der Abholung noch etwas?",
    askRelease: "Ist die unterschriebene Freigabe für dieses Auto bei Ihnen angekommen?",
    ack: "Verstanden.",
    askMore: "Gibt es sonst noch etwas, das der Fahrer wissen muss?",
    nothingElse: "Nein, das ist alles.",
    closeDecision: "Danke. Das entscheidet eine Kollegin bei uns. Wir melden uns innerhalb der nächsten Stunde bei Ihnen.",
    closeOk: "Danke, dann ist alles klar. Auf Wiederhören.",
    bye: "Gerne, auf Wiederhören.",
    callbackIntro: (ref) => `Guten Tag, hier ist wieder der digitale Assistent von Bahn, wegen der Abholung ${ref}. Wie versprochen melde ich mich zurück.`,
  },
  fi: {
    greeting: (place, role, name) => `${place}, ${role}, ${name}.`,
    intro: (ref, car) => `Hei, täällä Bahnin digitaalinen avustaja. Soitan noudosta ${ref}, kyseessä ${car}.`,
    askReady: "Onko auto valmis noudettavaksi, missä avaimet ovat, ja tarvitaanko ennen noutoa vielä jotain?",
    askRelease: "Onko tämän auton allekirjoitettu luovutusdokumentti tullut teille?",
    ack: "Selvä.",
    askMore: "Onko vielä jotain, mitä kuljettajan pitää tietää?",
    nothingElse: "Ei, siinä kaikki.",
    closeDecision: "Kiitos. Kollegani päättää tästä. Palaamme asiaan tunnin sisällä.",
    closeOk: "Kiitos, kaikki selvä. Kuulemiin.",
    bye: "Selvä, kuulemiin.",
    callbackIntro: (ref) => `Hei, täällä taas Bahnin digitaalinen avustaja, noudosta ${ref}. Palaan asiaan kuten lupasin.`,
  },
}

export const PHRASES_EN: Record<keyof Omit<Phrases, "greeting" | "intro" | "callbackIntro">, string> = {
  askReady: PHRASES.en.askReady,
  askRelease: PHRASES.en.askRelease,
  ack: PHRASES.en.ack,
  askMore: PHRASES.en.askMore,
  nothingElse: PHRASES.en.nothingElse,
  closeDecision: PHRASES.en.closeDecision,
  closeOk: PHRASES.en.closeOk,
  bye: PHRASES.en.bye,
}
