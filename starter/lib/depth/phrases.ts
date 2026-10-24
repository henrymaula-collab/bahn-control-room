// Short business messages and call lines for the baseline threads, in the
// languages Bahn's pickup places and customers speak (placeLanguage in
// lib/agent/data.ts: de, fi, da, sv, fr, else en). Every line exists in every
// language; English doubles as the translation. Nothing here states more than
// the card does: "not confirmed yet", "not named yet", never a new fact that
// would settle the case.

export type Lang = "en" | "de" | "fi" | "da" | "sv" | "fr"
export const LANGS: Lang[] = ["en", "de", "fi", "da", "sv", "fr"]
export const asLang = (l: string): Lang => ((LANGS as string[]).includes(l) ? (l as Lang) : "en")

export interface V {
  ref: string
  car: string
  place: string
  /** Full name of the pickup place's contact. */
  contact: string
  /** First name of the customer's contact. */
  cust: string
  /** "on Thursday 22 October at 11:00", with the language's own preposition. */
  slot: string
  /** "on Thursday 22 October". */
  slotDay: string
  delivery: string | null
  amount: string | null
}

const KEYS = [
  "askReady", "notSure", "custUpdateReady", "custDeliveryWait", "custWait", "cAskReady", "cNotYet", "cWhoLater", "cAskFor",
  "askKeys", "keysUnclear", "keysUnclearPrivate", "custUpdateKeys", "custKeysReply", "cAskKeys", "cNoShiftPlan", "cThanks",
  "askConfirm", "reminder", "custAsksConfirm", "custNoReplyYet", "cVoicemail",
  "askRelease", "releaseRequested", "askReleaseRule", "releaseNeeded", "releaseSendIt", "cAskRelease", "cNoRelease", "cNoReleaseYet",
  "placeDiffers", "askWhich", "custAskWhich", "cAskWhere", "cWriteUs",
  "feeAsk", "feeCheck", "custFee", "cAskFee", "cFeeWhat",
  "confirmSlot", "allSet", "cAskPlan", "cAsPlanned",
] as const
export type Key = (typeof KEYS)[number]
type Book = Record<Key, (v: V) => string>

const en: Book = {
  askReady: (v) => `Hello ${v.contact}, this is the Readiness desk at Bahn about order ${v.ref} (${v.car}). Our driver is booked to collect the car ${v.slot}. Will it be ready by then?`,
  notSure: (v) => `Hello, the car is still being prepared: cleaning and the final check are not done. I cannot promise yet that it is ready ${v.slotDay}. I will know more tomorrow afternoon.`,
  custUpdateReady: (v) => `Hello ${v.cust}, a short update on order ${v.ref}: ${v.place} cannot confirm yet that the car (${v.car}) will be ready for the pickup ${v.slot}. We will tell you as soon as we know more, and before anything changes.`,
  custDeliveryWait: (v) => `Thank you. Our buyer expects the car ${v.delivery}. If the pickup has to move, please tell us first.`,
  custWait: () => `Thank you. If the pickup has to move, please tell us first.`,
  cAskReady: (v) => `Good morning, this is the Readiness desk at Bahn, about order ${v.ref} (${v.car}). Is the car ready for the pickup ${v.slotDay}?`,
  cNotYet: () => `Not yet. It is still being prepared. I can tell you this afternoon whether it will be ready.`,
  cWhoLater: () => `Thank you. Whom should we ask this afternoon?`,
  cAskFor: (v) => `Ask for ${v.contact}, who handles your orders.`,
  askKeys: (v) => `Hello, this is the Readiness desk at Bahn about order ${v.ref} (${v.car}), pickup ${v.slot}. Who will hand over the keys to our driver? Please send us a name and a phone number.`,
  keysUnclear: () => `Hello, the shift plan for that day is not made yet, so I cannot tell you today who will hand over the keys. We will send a name as soon as the plan is ready.`,
  keysUnclearPrivate: () => `Hello, it is not decided yet who of us can release the car that day. I will send you a name and a number as soon as I know.`,
  custUpdateKeys: (v) => `Hello ${v.cust}, on order ${v.ref} the pickup place has not yet named who hands over the keys ${v.slotDay}. We are following it up and will tell you before anything changes.`,
  custKeysReply: () => `Thanks. Please make sure the driver does not travel there for nothing.`,
  cAskKeys: (v) => `Hello, this is the Readiness desk at Bahn, about order ${v.ref} (${v.car}). Who hands the keys to our driver ${v.slotDay}?`,
  cNoShiftPlan: (v) => `I cannot say yet, the shift plan for that day is not made. Please ask ${v.contact}, who handles your orders.`,
  cThanks: () => `Thank you, we will.`,
  askConfirm: (v) => `Hello, this is the Readiness desk at Bahn about order ${v.ref} (${v.car}). Can you confirm the pickup ${v.slot}? Please reply to this message or call us back.`,
  reminder: (v) => `Hello again, we still need your confirmation for the pickup of order ${v.ref} ${v.slotDay}. A short reply is enough.`,
  custAsksConfirm: (v) => `Has ${v.place} confirmed the pickup for ${v.ref} yet?`,
  custNoReplyYet: (v) => `Not yet: ${v.place} has not answered our two messages. We keep trying and will tell you before anything changes.`,
  cVoicemail: (v) => `Hello, this is the Readiness desk at Bahn, about the pickup of order ${v.ref} (${v.car}) ${v.slotDay}. Please call us back or reply to our message. Thank you.`,
  askRelease: (v) => `Hello ${v.cust}, ${v.place} needs the signed release document before the car (${v.car}, order ${v.ref}) can be collected. We do not have it yet. Could you send it to us before the pickup ${v.slotDay}?`,
  releaseRequested: () => `We have asked the seller for it. We hope to have it before the pickup, but we cannot promise that.`,
  askReleaseRule: (v) => `Hello, about order ${v.ref} (${v.car}): may our driver collect the car before the signed release document is on file with you?`,
  releaseNeeded: () => `No. Without the signed release on file we hand over neither the car nor the keys.`,
  releaseSendIt: () => `Please send us the release document when you have it. We check it before the handover.`,
  cAskRelease: (v) => `Hello, this is the Readiness desk at Bahn, about order ${v.ref}. Has the signed release for the car (${v.car}) reached you?`,
  cNoRelease: () => `No, nothing has come in. Without it the car stays here.`,
  cNoReleaseYet: () => `No, nothing has come in yet.`,
  placeDiffers: (v) => `Hello, about order ${v.ref}: please check the pickup details with us before the driver comes. What the order says does not match our current plan for this car.`,
  askWhich: () => `Thank you. Which address and which contact should our driver use? Please write it down for us, and we update the order.`,
  custAskWhich: (v) => `Hello ${v.cust}, ${v.place} says the pickup details on order ${v.ref} do not match their plan. Can you confirm where the car (${v.car}) should be collected?`,
  cAskWhere: (v) => `Hello, this is the Readiness desk at Bahn, about order ${v.ref}. Where exactly should our driver collect the car (${v.car})?`,
  cWriteUs: () => `The person who handles this car is out today. Please write to us, and we answer in writing.`,
  feeAsk: (v) => `Hello, for the pickup of order ${v.ref} we charge a handling fee${v.amount ? ` of ${v.amount}` : ""}. Please confirm it before the driver comes.`,
  feeCheck: () => `Thank you. We check this with the customer and come back to you before the pickup.`,
  custFee: (v) => `Hello ${v.cust}, ${v.place} asks for a handling fee${v.amount ? ` of ${v.amount}` : ""} for the pickup of order ${v.ref}. Do you accept it?`,
  cAskFee: (v) => `Hello, this is the Readiness desk at Bahn, about the fee on order ${v.ref}. What is it for?`,
  cFeeWhat: () => `It covers moving the car out of our storage for the handover. We need your confirmation in writing.`,
  confirmSlot: (v) => `Hello, this is the Readiness desk at Bahn about order ${v.ref} (${v.car}). Our driver comes ${v.slot}. Is everything set for the handover?`,
  allSet: () => `Hello, we have the order. The driver should give the order reference on arrival.`,
  cAskPlan: (v) => `Hello, this is the Readiness desk at Bahn, about order ${v.ref}. Is the handover ${v.slotDay} still as planned?`,
  cAsPlanned: () => `As far as I know, yes. The driver gives the order reference on arrival.`,
}

const de: Book = {
  askReady: (v) => `Guten Tag ${v.contact}, hier ist der Readiness-Desk von Bahn zum Auftrag ${v.ref} (${v.car}). Unser Fahrer ist für die Abholung ${v.slot} eingeplant. Ist das Fahrzeug bis dahin fertig?`,
  notSure: (v) => `Guten Tag, das Fahrzeug wird noch aufbereitet: Reinigung und Endkontrolle fehlen noch. Ich kann noch nicht zusagen, dass es ${v.slotDay} fertig ist. Morgen Nachmittag weiß ich mehr.`,
  custUpdateReady: (v) => `Hallo ${v.cust}, ein kurzes Update zum Auftrag ${v.ref}: ${v.place} kann noch nicht bestätigen, dass das Fahrzeug (${v.car}) zur Abholung ${v.slot} fertig ist. Wir melden uns, sobald wir mehr wissen, und bevor sich etwas ändert.`,
  custDeliveryWait: (v) => `Danke. Unser Käufer erwartet das Fahrzeug ${v.delivery}. Falls sich die Abholung verschiebt, sagen Sie uns bitte vorher Bescheid.`,
  custWait: () => `Danke. Falls sich die Abholung verschiebt, sagen Sie uns bitte vorher Bescheid.`,
  cAskReady: (v) => `Guten Morgen, hier ist der Readiness-Desk von Bahn, zum Auftrag ${v.ref} (${v.car}). Ist das Fahrzeug für die Abholung ${v.slotDay} fertig?`,
  cNotYet: () => `Noch nicht. Es wird noch aufbereitet. Heute Nachmittag kann ich Ihnen sagen, ob es klappt.`,
  cWhoLater: () => `Danke. Wen sollen wir heute Nachmittag fragen?`,
  cAskFor: (v) => `Fragen Sie nach ${v.contact}, das ist die Ansprechperson für Ihre Aufträge.`,
  askKeys: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn zum Auftrag ${v.ref} (${v.car}), Abholung ${v.slot}. Wer übergibt unserem Fahrer die Schlüssel? Bitte schicken Sie uns einen Namen und eine Telefonnummer.`,
  keysUnclear: () => `Guten Tag, der Schichtplan für den Tag steht noch nicht, deshalb kann ich Ihnen heute nicht sagen, wer die Schlüssel übergibt. Wir schicken einen Namen, sobald der Plan fertig ist.`,
  keysUnclearPrivate: () => `Guten Tag, es ist noch nicht entschieden, wer von uns das Fahrzeug an dem Tag freigeben kann. Ich schicke Ihnen Namen und Nummer, sobald ich es weiß.`,
  custUpdateKeys: (v) => `Hallo ${v.cust}, beim Auftrag ${v.ref} hat die Abholstelle noch nicht genannt, wer ${v.slotDay} die Schlüssel übergibt. Wir bleiben dran und melden uns, bevor sich etwas ändert.`,
  custKeysReply: () => `Danke. Bitte sorgen Sie dafür, dass der Fahrer nicht umsonst hinfährt.`,
  cAskKeys: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, zum Auftrag ${v.ref} (${v.car}). Wer übergibt unserem Fahrer ${v.slotDay} die Schlüssel?`,
  cNoShiftPlan: (v) => `Das kann ich noch nicht sagen, der Schichtplan für den Tag steht noch nicht. Fragen Sie bitte ${v.contact}, die Ansprechperson für Ihre Aufträge.`,
  cThanks: () => `Danke, machen wir.`,
  askConfirm: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn zum Auftrag ${v.ref} (${v.car}). Können Sie die Abholung ${v.slot} bestätigen? Bitte antworten Sie auf diese Nachricht oder rufen Sie uns zurück.`,
  reminder: (v) => `Guten Tag, wir brauchen noch Ihre Bestätigung für die Abholung zum Auftrag ${v.ref} ${v.slotDay}. Eine kurze Antwort genügt.`,
  custAsksConfirm: (v) => `Hat ${v.place} die Abholung für ${v.ref} schon bestätigt?`,
  custNoReplyYet: (v) => `Noch nicht: ${v.place} hat auf unsere zwei Nachrichten nicht geantwortet. Wir versuchen es weiter und melden uns, bevor sich etwas ändert.`,
  cVoicemail: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, wegen der Abholung zum Auftrag ${v.ref} (${v.car}) ${v.slotDay}. Bitte rufen Sie uns zurück oder antworten Sie auf unsere Nachricht. Danke.`,
  askRelease: (v) => `Hallo ${v.cust}, ${v.place} braucht die unterschriebene Freigabe, bevor das Fahrzeug (${v.car}, Auftrag ${v.ref}) abgeholt werden kann. Sie liegt uns noch nicht vor. Können Sie sie uns vor der Abholung ${v.slotDay} schicken?`,
  releaseRequested: () => `Wir haben den Verkäufer darum gebeten. Wir hoffen, sie vor der Abholung zu haben, können es aber nicht versprechen.`,
  askReleaseRule: (v) => `Guten Tag, zum Auftrag ${v.ref} (${v.car}): Darf unser Fahrer das Fahrzeug abholen, bevor die unterschriebene Freigabe bei Ihnen vorliegt?`,
  releaseNeeded: () => `Nein. Ohne unterschriebene Freigabe geben wir weder das Fahrzeug noch die Schlüssel heraus.`,
  releaseSendIt: () => `Bitte schicken Sie uns die Freigabe, sobald Sie sie haben. Wir prüfen sie vor der Übergabe.`,
  cAskRelease: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, zum Auftrag ${v.ref}. Ist die unterschriebene Freigabe für das Fahrzeug (${v.car}) bei Ihnen eingegangen?`,
  cNoRelease: () => `Nein, es ist nichts gekommen. Ohne Freigabe bleibt das Fahrzeug hier.`,
  cNoReleaseYet: () => `Nein, bisher ist nichts gekommen.`,
  placeDiffers: (v) => `Guten Tag, zum Auftrag ${v.ref}: Bitte stimmen Sie die Abholdaten mit uns ab, bevor der Fahrer kommt. Was im Auftrag steht, passt nicht zu unserer aktuellen Planung für dieses Fahrzeug.`,
  askWhich: () => `Danke. Welche Adresse und welche Ansprechperson soll unser Fahrer nutzen? Bitte schreiben Sie es uns, dann passen wir den Auftrag an.`,
  custAskWhich: (v) => `Hallo ${v.cust}, ${v.place} sagt, dass die Abholdaten im Auftrag ${v.ref} nicht zu ihrer Planung passen. Können Sie bestätigen, wo das Fahrzeug (${v.car}) abgeholt werden soll?`,
  cAskWhere: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, zum Auftrag ${v.ref}. Wo genau soll unser Fahrer das Fahrzeug (${v.car}) abholen?`,
  cWriteUs: () => `Die zuständige Person ist heute nicht da. Bitte schreiben Sie uns, wir antworten schriftlich.`,
  feeAsk: (v) => `Guten Tag, für die Abholung zum Auftrag ${v.ref} berechnen wir eine Bearbeitungsgebühr${v.amount ? ` von ${v.amount}` : ""}. Bitte bestätigen Sie sie, bevor der Fahrer kommt.`,
  feeCheck: () => `Danke. Wir klären das mit dem Kunden und melden uns vor der Abholung.`,
  custFee: (v) => `Hallo ${v.cust}, ${v.place} verlangt für die Abholung zum Auftrag ${v.ref} eine Bearbeitungsgebühr${v.amount ? ` von ${v.amount}` : ""}. Sind Sie damit einverstanden?`,
  cAskFee: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, wegen der Gebühr zum Auftrag ${v.ref}. Wofür ist sie?`,
  cFeeWhat: () => `Dafür holen wir das Fahrzeug für die Übergabe aus unserem Lager. Wir brauchen Ihre Bestätigung schriftlich.`,
  confirmSlot: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn zum Auftrag ${v.ref} (${v.car}). Unser Fahrer kommt ${v.slot}. Ist für die Übergabe alles vorbereitet?`,
  allSet: () => `Guten Tag, der Auftrag liegt uns vor. Der Fahrer nennt bei Ankunft bitte die Auftragsnummer.`,
  cAskPlan: (v) => `Guten Tag, hier ist der Readiness-Desk von Bahn, zum Auftrag ${v.ref}. Bleibt es bei der Übergabe ${v.slotDay}?`,
  cAsPlanned: () => `Soweit ich weiß, ja. Der Fahrer nennt bei Ankunft die Auftragsnummer.`,
}

const fi: Book = {
  askReady: (v) => `Hei ${v.contact}, täällä Bahnin Readiness-tiimi tilauksesta ${v.ref} (${v.car}). Kuljettajamme on varattu hakemaan auton ${v.slot}. Onko auto silloin valmis?`,
  notSure: (v) => `Hei, autoa valmistellaan vielä: pesu ja lopputarkastus puuttuvat. En voi vielä luvata, että se on valmis ${v.slotDay}. Tiedän lisää huomenna iltapäivällä.`,
  custUpdateReady: (v) => `Hei ${v.cust}, lyhyt tilannepäivitys tilauksesta ${v.ref}: ${v.place} ei voi vielä vahvistaa, että auto (${v.car}) on valmis noudettavaksi ${v.slot}. Kerromme heti, kun tiedämme enemmän, ja ennen kuin mikään muuttuu.`,
  custDeliveryWait: (v) => `Kiitos. Ostajamme odottaa autoa ${v.delivery}. Jos nouto siirtyy, kertokaa meille ensin.`,
  custWait: () => `Kiitos. Jos nouto siirtyy, kertokaa meille ensin.`,
  cAskReady: (v) => `Huomenta, täällä Bahnin Readiness-tiimi, soitan tilauksesta ${v.ref} (${v.car}). Onko auto valmis noudettavaksi ${v.slotDay}?`,
  cNotYet: () => `Ei vielä. Sitä valmistellaan edelleen. Voin kertoa iltapäivällä, ehtiikö se valmiiksi.`,
  cWhoLater: () => `Kiitos. Keneltä kysymme iltapäivällä?`,
  cAskFor: (v) => `Yhteyshenkilönne on ${v.contact}, hän hoitaa teidän tilauksenne.`,
  askKeys: (v) => `Hei, täällä Bahnin Readiness-tiimi tilauksesta ${v.ref} (${v.car}), nouto ${v.slot}. Kuka luovuttaa avaimet kuljettajallemme? Lähettäkää meille nimi ja puhelinnumero.`,
  keysUnclear: () => `Hei, sen päivän vuorolista ei ole vielä valmis, joten en voi tänään kertoa, kuka luovuttaa avaimet. Lähetämme nimen heti, kun lista on valmis.`,
  keysUnclearPrivate: () => `Hei, vielä ei ole päätetty, kuka meistä voi luovuttaa auton sinä päivänä. Lähetän nimen ja numeron heti, kun tiedän.`,
  custUpdateKeys: (v) => `Hei ${v.cust}, tilauksen ${v.ref} noutopaikka ei ole vielä kertonut, kuka luovuttaa avaimet ${v.slotDay}. Selvitämme asiaa ja kerromme ennen kuin mikään muuttuu.`,
  custKeysReply: () => `Kiitos. Huolehtikaa, ettei kuljettaja lähde paikalle turhaan.`,
  cAskKeys: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksesta ${v.ref} (${v.car}). Kuka luovuttaa avaimet kuljettajallemme ${v.slotDay}?`,
  cNoShiftPlan: (v) => `En osaa vielä sanoa, sen päivän vuorolista ei ole valmis. Yhteyshenkilönne on ${v.contact}, hän tietää lisää.`,
  cThanks: () => `Kiitos, niin teemme.`,
  askConfirm: (v) => `Hei, täällä Bahnin Readiness-tiimi tilauksesta ${v.ref} (${v.car}). Voitteko vahvistaa noudon ${v.slot}? Vastatkaa tähän viestiin tai soittakaa meille.`,
  reminder: (v) => `Hei taas, tarvitsemme vielä vahvistuksenne tilauksen ${v.ref} noudolle ${v.slotDay}. Lyhyt vastaus riittää.`,
  custAsksConfirm: (v) => `Onko ${v.place} jo vahvistanut tilauksen ${v.ref} noudon?`,
  custNoReplyYet: (v) => `Ei vielä: ${v.place} ei ole vastannut kahteen viestiimme. Yritämme edelleen ja kerromme ennen kuin mikään muuttuu.`,
  cVoicemail: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksen ${v.ref} (${v.car}) noudosta ${v.slotDay}. Soittakaa meille takaisin tai vastatkaa viestiimme. Kiitos.`,
  askRelease: (v) => `Hei ${v.cust}, ${v.place} tarvitsee allekirjoitetun luovutusvaltuutuksen ennen kuin auto (${v.car}, tilaus ${v.ref}) voidaan noutaa. Meillä sitä ei vielä ole. Voitteko lähettää sen meille ennen noutoa ${v.slotDay}?`,
  releaseRequested: () => `Olemme pyytäneet sitä myyjältä. Toivomme saavamme sen ennen noutoa, mutta emme voi luvata.`,
  askReleaseRule: (v) => `Hei, tilauksesta ${v.ref} (${v.car}): saako kuljettajamme noutaa auton ennen kuin allekirjoitettu luovutusvaltuutus on teillä?`,
  releaseNeeded: () => `Ei. Ilman allekirjoitettua luovutusvaltuutusta emme luovuta autoa emmekä avaimia.`,
  releaseSendIt: () => `Lähettäkää meille luovutusvaltuutus, kun saatte sen. Tarkistamme sen ennen luovutusta.`,
  cAskRelease: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksesta ${v.ref}. Onko auton (${v.car}) allekirjoitettu luovutusvaltuutus tullut teille?`,
  cNoRelease: () => `Ei, mitään ei ole tullut. Ilman sitä auto jää tänne.`,
  cNoReleaseYet: () => `Ei, mitään ei ole vielä tullut.`,
  placeDiffers: (v) => `Hei, tilauksesta ${v.ref}: tarkistakaa noutotiedot kanssamme ennen kuin kuljettaja tulee. Tilauksen tiedot eivät vastaa nykyistä suunnitelmaamme tälle autolle.`,
  askWhich: () => `Kiitos. Mitä osoitetta ja ketä yhteyshenkilöä kuljettajamme pitäisi käyttää? Kirjoittakaa se meille, niin päivitämme tilauksen.`,
  custAskWhich: (v) => `Hei ${v.cust}, ${v.place} kertoo, että tilauksen ${v.ref} noutotiedot eivät vastaa heidän suunnitelmaansa. Voitteko vahvistaa, mistä auto (${v.car}) noudetaan?`,
  cAskWhere: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksesta ${v.ref}. Mistä tarkalleen kuljettajamme noutaa auton (${v.car})?`,
  cWriteUs: () => `Autoa hoitava henkilö ei ole tänään paikalla. Kirjoittakaa meille, niin vastaamme kirjallisesti.`,
  feeAsk: (v) => `Hei, tilauksen ${v.ref} noudosta veloitamme käsittelymaksun${v.amount ? ` (${v.amount})` : ""}. Vahvistakaa se ennen kuin kuljettaja tulee.`,
  feeCheck: () => `Kiitos. Tarkistamme asian asiakkaalta ja palaamme ennen noutoa.`,
  custFee: (v) => `Hei ${v.cust}, ${v.place} pyytää käsittelymaksua${v.amount ? ` (${v.amount})` : ""} tilauksen ${v.ref} noudosta. Hyväksyttekö sen?`,
  cAskFee: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksen ${v.ref} maksusta. Mistä se veloitetaan?`,
  cFeeWhat: () => `Siitä, että siirrämme auton varastosta luovutusta varten. Tarvitsemme vahvistuksen kirjallisena.`,
  confirmSlot: (v) => `Hei, täällä Bahnin Readiness-tiimi tilauksesta ${v.ref} (${v.car}). Kuljettajamme tulee ${v.slot}. Onko kaikki valmiina luovutusta varten?`,
  allSet: () => `Hei, tilaus on meillä. Kuljettaja kertoo saapuessaan tilausnumeron.`,
  cAskPlan: (v) => `Hei, täällä Bahnin Readiness-tiimi, soitan tilauksesta ${v.ref}. Pysyykö luovutus ${v.slotDay} ennallaan?`,
  cAsPlanned: () => `Tietääkseni kyllä. Kuljettaja kertoo saapuessaan tilausnumeron.`,
}

const da: Book = {
  askReady: (v) => `Hej ${v.contact}, det er Readiness-desken hos Bahn om ordre ${v.ref} (${v.car}). Vores chauffør er booket til at hente bilen ${v.slot}. Er bilen klar til den tid?`,
  notSure: (v) => `Hej, bilen er stadig under klargøring: vask og slutkontrol mangler. Jeg kan ikke love endnu, at den er klar ${v.slotDay}. Jeg ved mere i morgen eftermiddag.`,
  custUpdateReady: (v) => `Hej ${v.cust}, en kort opdatering om ordre ${v.ref}: ${v.place} kan endnu ikke bekræfte, at bilen (${v.car}) er klar til afhentning ${v.slot}. Vi giver besked, så snart vi ved mere, og før noget ændres.`,
  custDeliveryWait: (v) => `Tak. Vores køber venter bilen ${v.delivery}. Hvis afhentningen skal flyttes, så sig til først.`,
  custWait: () => `Tak. Hvis afhentningen skal flyttes, så sig til først.`,
  cAskReady: (v) => `Godmorgen, det er Readiness-desken hos Bahn, om ordre ${v.ref} (${v.car}). Er bilen klar til afhentning ${v.slotDay}?`,
  cNotYet: () => `Ikke endnu. Den er stadig under klargøring. Jeg kan sige i eftermiddag, om den bliver klar.`,
  cWhoLater: () => `Tak. Hvem skal vi spørge i eftermiddag?`,
  cAskFor: (v) => `Spørg efter ${v.contact}, som har jeres ordrer.`,
  askKeys: (v) => `Hej, det er Readiness-desken hos Bahn om ordre ${v.ref} (${v.car}), afhentning ${v.slot}. Hvem udleverer nøglerne til vores chauffør? Send os gerne et navn og et telefonnummer.`,
  keysUnclear: () => `Hej, vagtplanen for den dag er ikke lagt endnu, så jeg kan ikke sige i dag, hvem der udleverer nøglerne. Vi sender et navn, så snart planen er klar.`,
  keysUnclearPrivate: () => `Hej, det er endnu ikke afgjort, hvem af os der kan udlevere bilen den dag. Jeg sender navn og nummer, så snart jeg ved det.`,
  custUpdateKeys: (v) => `Hej ${v.cust}, på ordre ${v.ref} har afhentningsstedet endnu ikke oplyst, hvem der udleverer nøglerne ${v.slotDay}. Vi følger op og giver besked, før noget ændres.`,
  custKeysReply: () => `Tak. Sørg for, at chaufføren ikke kører derud forgæves.`,
  cAskKeys: (v) => `Hej, det er Readiness-desken hos Bahn, om ordre ${v.ref} (${v.car}). Hvem udleverer nøglerne til vores chauffør ${v.slotDay}?`,
  cNoShiftPlan: (v) => `Det kan jeg ikke sige endnu, vagtplanen for den dag er ikke lagt. Spørg ${v.contact}, som har jeres ordrer.`,
  cThanks: () => `Tak, det gør vi.`,
  askConfirm: (v) => `Hej, det er Readiness-desken hos Bahn om ordre ${v.ref} (${v.car}). Kan I bekræfte afhentningen ${v.slot}? Svar gerne på denne besked eller ring tilbage.`,
  reminder: (v) => `Hej igen, vi mangler stadig jeres bekræftelse på afhentningen af ordre ${v.ref} ${v.slotDay}. Et kort svar er nok.`,
  custAsksConfirm: (v) => `Har ${v.place} bekræftet afhentningen af ${v.ref} endnu?`,
  custNoReplyYet: (v) => `Ikke endnu: ${v.place} har ikke svaret på vores to beskeder. Vi prøver videre og giver besked, før noget ændres.`,
  cVoicemail: (v) => `Hej, det er Readiness-desken hos Bahn, om afhentningen af ordre ${v.ref} (${v.car}) ${v.slotDay}. Ring venligst tilbage eller svar på vores besked. Tak.`,
  askRelease: (v) => `Hej ${v.cust}, ${v.place} skal have den underskrevne frigivelse, før bilen (${v.car}, ordre ${v.ref}) kan hentes. Vi har den ikke endnu. Kan du sende den til os før afhentningen ${v.slotDay}?`,
  releaseRequested: () => `Vi har bedt sælgeren om den. Vi håber at have den før afhentningen, men vi kan ikke love det.`,
  askReleaseRule: (v) => `Hej, om ordre ${v.ref} (${v.car}): Må vores chauffør hente bilen, før den underskrevne frigivelse ligger hos jer?`,
  releaseNeeded: () => `Nej. Uden underskrevet frigivelse udleverer vi hverken bilen eller nøglerne.`,
  releaseSendIt: () => `Send os frigivelsen, når I har den. Vi tjekker den før udleveringen.`,
  cAskRelease: (v) => `Hej, det er Readiness-desken hos Bahn, om ordre ${v.ref}. Er den underskrevne frigivelse for bilen (${v.car}) kommet til jer?`,
  cNoRelease: () => `Nej, der er ikke kommet noget. Uden den bliver bilen her.`,
  cNoReleaseYet: () => `Nej, der er ikke kommet noget endnu.`,
  placeDiffers: (v) => `Hej, om ordre ${v.ref}: Afstem venligst afhentningsoplysningerne med os, før chaufføren kommer. Det, der står på ordren, passer ikke med vores nuværende plan for bilen.`,
  askWhich: () => `Tak. Hvilken adresse og hvilken kontaktperson skal vores chauffør bruge? Skriv det gerne til os, så retter vi ordren.`,
  custAskWhich: (v) => `Hej ${v.cust}, ${v.place} siger, at afhentningsoplysningerne på ordre ${v.ref} ikke passer med deres plan. Kan du bekræfte, hvor bilen (${v.car}) skal hentes?`,
  cAskWhere: (v) => `Hej, det er Readiness-desken hos Bahn, om ordre ${v.ref}. Hvor præcis skal vores chauffør hente bilen (${v.car})?`,
  cWriteUs: () => `Den person, der har bilen, er her ikke i dag. Skriv til os, så svarer vi skriftligt.`,
  feeAsk: (v) => `Hej, for afhentningen af ordre ${v.ref} opkræver vi et ekspeditionsgebyr${v.amount ? ` på ${v.amount}` : ""}. Bekræft det venligst, før chaufføren kommer.`,
  feeCheck: () => `Tak. Vi afklarer det med kunden og vender tilbage før afhentningen.`,
  custFee: (v) => `Hej ${v.cust}, ${v.place} beder om et ekspeditionsgebyr${v.amount ? ` på ${v.amount}` : ""} for afhentningen af ordre ${v.ref}. Accepterer I det?`,
  cAskFee: (v) => `Hej, det er Readiness-desken hos Bahn, om gebyret på ordre ${v.ref}. Hvad dækker det?`,
  cFeeWhat: () => `At vi flytter bilen ud af vores lager til udleveringen. Vi skal have jeres bekræftelse skriftligt.`,
  confirmSlot: (v) => `Hej, det er Readiness-desken hos Bahn om ordre ${v.ref} (${v.car}). Vores chauffør kommer ${v.slot}. Er alt klar til udleveringen?`,
  allSet: () => `Hej, vi har ordren. Chaufføren oplyser ordrenummeret ved ankomst.`,
  cAskPlan: (v) => `Hej, det er Readiness-desken hos Bahn, om ordre ${v.ref}. Holder udleveringen ${v.slotDay} stadig?`,
  cAsPlanned: () => `Så vidt jeg ved, ja. Chaufføren oplyser ordrenummeret ved ankomst.`,
}

const sv: Book = {
  askReady: (v) => `Hej ${v.contact}, det här är Readiness-desken på Bahn om order ${v.ref} (${v.car}). Vår förare är bokad att hämta bilen ${v.slot}. Är bilen klar då?`,
  notSure: (v) => `Hej, bilen håller fortfarande på att iordningställas: tvätt och slutkontroll återstår. Jag kan inte lova ännu att den är klar ${v.slotDay}. Jag vet mer i morgon eftermiddag.`,
  custUpdateReady: (v) => `Hej ${v.cust}, en kort uppdatering om order ${v.ref}: ${v.place} kan ännu inte bekräfta att bilen (${v.car}) är klar för hämtning ${v.slot}. Vi hör av oss så snart vi vet mer, och innan något ändras.`,
  custDeliveryWait: (v) => `Tack. Vår köpare väntar bilen ${v.delivery}. Om hämtningen måste flyttas, säg till oss först.`,
  custWait: () => `Tack. Om hämtningen måste flyttas, säg till oss först.`,
  cAskReady: (v) => `God morgon, det här är Readiness-desken på Bahn, om order ${v.ref} (${v.car}). Är bilen klar för hämtning ${v.slotDay}?`,
  cNotYet: () => `Inte än. Den iordningställs fortfarande. Jag kan säga i eftermiddag om den hinner bli klar.`,
  cWhoLater: () => `Tack. Vem ska vi fråga i eftermiddag?`,
  cAskFor: (v) => `Fråga efter ${v.contact}, som har hand om era order.`,
  askKeys: (v) => `Hej, det här är Readiness-desken på Bahn om order ${v.ref} (${v.car}), hämtning ${v.slot}. Vem lämnar över nycklarna till vår förare? Skicka gärna ett namn och ett telefonnummer.`,
  keysUnclear: () => `Hej, schemat för den dagen är inte klart än, så jag kan inte säga i dag vem som lämnar över nycklarna. Vi skickar ett namn så snart schemat är klart.`,
  keysUnclearPrivate: () => `Hej, det är inte bestämt än vem av oss som kan lämna ut bilen den dagen. Jag skickar namn och nummer så snart jag vet.`,
  custUpdateKeys: (v) => `Hej ${v.cust}, för order ${v.ref} har hämtningsplatsen ännu inte sagt vem som lämnar över nycklarna ${v.slotDay}. Vi följer upp och hör av oss innan något ändras.`,
  custKeysReply: () => `Tack. Se till att föraren inte åker dit i onödan.`,
  cAskKeys: (v) => `Hej, det här är Readiness-desken på Bahn, om order ${v.ref} (${v.car}). Vem lämnar över nycklarna till vår förare ${v.slotDay}?`,
  cNoShiftPlan: (v) => `Det kan jag inte säga än, schemat för den dagen är inte klart. Fråga ${v.contact}, som har hand om era order.`,
  cThanks: () => `Tack, det gör vi.`,
  askConfirm: (v) => `Hej, det här är Readiness-desken på Bahn om order ${v.ref} (${v.car}). Kan ni bekräfta hämtningen ${v.slot}? Svara gärna på det här meddelandet eller ring tillbaka.`,
  reminder: (v) => `Hej igen, vi behöver fortfarande er bekräftelse för hämtningen av order ${v.ref} ${v.slotDay}. Ett kort svar räcker.`,
  custAsksConfirm: (v) => `Har ${v.place} bekräftat hämtningen för ${v.ref} än?`,
  custNoReplyYet: (v) => `Inte än: ${v.place} har inte svarat på våra två meddelanden. Vi fortsätter försöka och hör av oss innan något ändras.`,
  cVoicemail: (v) => `Hej, det här är Readiness-desken på Bahn, om hämtningen av order ${v.ref} (${v.car}) ${v.slotDay}. Ring gärna tillbaka eller svara på vårt meddelande. Tack.`,
  askRelease: (v) => `Hej ${v.cust}, ${v.place} behöver den signerade frisläppningen innan bilen (${v.car}, order ${v.ref}) kan hämtas. Vi har den inte än. Kan du skicka den till oss före hämtningen ${v.slotDay}?`,
  releaseRequested: () => `Vi har bett säljaren om den. Vi hoppas ha den före hämtningen, men vi kan inte lova det.`,
  askReleaseRule: (v) => `Hej, om order ${v.ref} (${v.car}): Får vår förare hämta bilen innan den signerade frisläppningen finns hos er?`,
  releaseNeeded: () => `Nej. Utan signerad frisläppning lämnar vi varken ut bilen eller nycklarna.`,
  releaseSendIt: () => `Skicka frisläppningen till oss när ni har den. Vi kontrollerar den före överlämningen.`,
  cAskRelease: (v) => `Hej, det här är Readiness-desken på Bahn, om order ${v.ref}. Har den signerade frisläppningen för bilen (${v.car}) kommit till er?`,
  cNoRelease: () => `Nej, ingenting har kommit. Utan den stannar bilen här.`,
  cNoReleaseYet: () => `Nej, ingenting har kommit än.`,
  placeDiffers: (v) => `Hej, om order ${v.ref}: stäm gärna av hämtningsuppgifterna med oss innan föraren kommer. Det som står i ordern stämmer inte med vår nuvarande plan för bilen.`,
  askWhich: () => `Tack. Vilken adress och vilken kontaktperson ska vår förare använda? Skriv det gärna till oss, så uppdaterar vi ordern.`,
  custAskWhich: (v) => `Hej ${v.cust}, ${v.place} säger att hämtningsuppgifterna i order ${v.ref} inte stämmer med deras plan. Kan du bekräfta var bilen (${v.car}) ska hämtas?`,
  cAskWhere: (v) => `Hej, det här är Readiness-desken på Bahn, om order ${v.ref}. Var exakt ska vår förare hämta bilen (${v.car})?`,
  cWriteUs: () => `Personen som har hand om bilen är inte här i dag. Skriv till oss, så svarar vi skriftligt.`,
  feeAsk: (v) => `Hej, för hämtningen av order ${v.ref} tar vi ut en hanteringsavgift${v.amount ? ` på ${v.amount}` : ""}. Bekräfta den gärna innan föraren kommer.`,
  feeCheck: () => `Tack. Vi stämmer av med kunden och återkommer före hämtningen.`,
  custFee: (v) => `Hej ${v.cust}, ${v.place} begär en hanteringsavgift${v.amount ? ` på ${v.amount}` : ""} för hämtningen av order ${v.ref}. Godkänner ni den?`,
  cAskFee: (v) => `Hej, det här är Readiness-desken på Bahn, om avgiften för order ${v.ref}. Vad gäller den?`,
  cFeeWhat: () => `Att vi flyttar bilen ur vårt lager för överlämningen. Vi behöver er bekräftelse skriftligt.`,
  confirmSlot: (v) => `Hej, det här är Readiness-desken på Bahn om order ${v.ref} (${v.car}). Vår förare kommer ${v.slot}. Är allt klart för överlämningen?`,
  allSet: () => `Hej, vi har ordern. Föraren uppger ordernumret vid ankomst.`,
  cAskPlan: (v) => `Hej, det här är Readiness-desken på Bahn, om order ${v.ref}. Gäller överlämningen ${v.slotDay} fortfarande?`,
  cAsPlanned: () => `Så vitt jag vet, ja. Föraren uppger ordernumret vid ankomst.`,
}

const fr: Book = {
  askReady: (v) => `Bonjour ${v.contact}, ici le Readiness desk de Bahn au sujet de la commande ${v.ref} (${v.car}). Notre chauffeur doit venir chercher la voiture ${v.slot}. Sera-t-elle prête ?`,
  notSure: (v) => `Bonjour, la voiture est encore en préparation : il reste le lavage et le contrôle final. Je ne peux pas encore promettre qu'elle sera prête ${v.slotDay}. J'en saurai plus demain après-midi.`,
  custUpdateReady: (v) => `Bonjour ${v.cust}, un point rapide sur la commande ${v.ref} : ${v.place} ne peut pas encore confirmer que la voiture (${v.car}) sera prête pour l'enlèvement ${v.slot}. Nous vous informons dès que nous en savons plus, et avant tout changement.`,
  custDeliveryWait: (v) => `Merci. Notre acheteur attend la voiture ${v.delivery}. Si l'enlèvement doit être déplacé, prévenez-nous d'abord.`,
  custWait: () => `Merci. Si l'enlèvement doit être déplacé, prévenez-nous d'abord.`,
  cAskReady: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de la commande ${v.ref} (${v.car}). La voiture est-elle prête pour l'enlèvement ${v.slotDay} ?`,
  cNotYet: () => `Pas encore. Elle est toujours en préparation. Je pourrai vous dire cet après-midi si elle sera prête.`,
  cWhoLater: () => `Merci. À qui devons-nous demander cet après-midi ?`,
  cAskFor: (v) => `Demandez ${v.contact}, qui suit vos commandes.`,
  askKeys: (v) => `Bonjour, ici le Readiness desk de Bahn au sujet de la commande ${v.ref} (${v.car}), enlèvement ${v.slot}. Qui remettra les clés à notre chauffeur ? Merci de nous envoyer un nom et un numéro de téléphone.`,
  keysUnclear: () => `Bonjour, le planning de ce jour-là n'est pas encore fait, je ne peux donc pas vous dire aujourd'hui qui remettra les clés. Nous vous envoyons un nom dès que le planning est prêt.`,
  keysUnclearPrivate: () => `Bonjour, nous n'avons pas encore décidé qui pourra remettre la voiture ce jour-là. Je vous envoie un nom et un numéro dès que je le sais.`,
  custUpdateKeys: (v) => `Bonjour ${v.cust}, pour la commande ${v.ref}, le lieu d'enlèvement n'a pas encore indiqué qui remettra les clés ${v.slotDay}. Nous suivons cela et vous prévenons avant tout changement.`,
  custKeysReply: () => `Merci. Veillez à ce que le chauffeur ne se déplace pas pour rien.`,
  cAskKeys: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de la commande ${v.ref} (${v.car}). Qui remettra les clés à notre chauffeur ${v.slotDay} ?`,
  cNoShiftPlan: (v) => `Je ne peux pas encore le dire, le planning de ce jour-là n'est pas fait. Demandez à ${v.contact}, qui suit vos commandes.`,
  cThanks: () => `Merci, nous le ferons.`,
  askConfirm: (v) => `Bonjour, ici le Readiness desk de Bahn au sujet de la commande ${v.ref} (${v.car}). Pouvez-vous confirmer l'enlèvement ${v.slot} ? Merci de répondre à ce message ou de nous rappeler.`,
  reminder: (v) => `Bonjour, nous attendons toujours votre confirmation pour l'enlèvement de la commande ${v.ref} ${v.slotDay}. Une courte réponse suffit.`,
  custAsksConfirm: (v) => `${v.place} a-t-il déjà confirmé l'enlèvement pour ${v.ref} ?`,
  custNoReplyYet: (v) => `Pas encore : ${v.place} n'a pas répondu à nos deux messages. Nous continuons d'essayer et vous prévenons avant tout changement.`,
  cVoicemail: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de l'enlèvement de la commande ${v.ref} (${v.car}) ${v.slotDay}. Merci de nous rappeler ou de répondre à notre message.`,
  askRelease: (v) => `Bonjour ${v.cust}, ${v.place} a besoin du document de mise à disposition signé avant l'enlèvement de la voiture (${v.car}, commande ${v.ref}). Nous ne l'avons pas encore. Pouvez-vous nous l'envoyer avant l'enlèvement ${v.slotDay} ?`,
  releaseRequested: () => `Nous l'avons demandé au vendeur. Nous espérons l'avoir avant l'enlèvement, mais nous ne pouvons pas le promettre.`,
  askReleaseRule: (v) => `Bonjour, au sujet de la commande ${v.ref} (${v.car}) : notre chauffeur peut-il prendre la voiture avant que le document de mise à disposition signé soit chez vous ?`,
  releaseNeeded: () => `Non. Sans le document signé, nous ne remettons ni la voiture ni les clés.`,
  releaseSendIt: () => `Envoyez-nous le document dès que vous l'avez. Nous le vérifions avant la remise.`,
  cAskRelease: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de la commande ${v.ref}. Avez-vous reçu le document de mise à disposition signé pour la voiture (${v.car}) ?`,
  cNoRelease: () => `Non, rien n'est arrivé. Sans ce document, la voiture reste ici.`,
  cNoReleaseYet: () => `Non, rien n'est encore arrivé.`,
  placeDiffers: (v) => `Bonjour, au sujet de la commande ${v.ref} : merci de vérifier les détails de l'enlèvement avec nous avant la venue du chauffeur. Ce qui figure sur la commande ne correspond pas à notre planning actuel pour cette voiture.`,
  askWhich: () => `Merci. Quelle adresse et quel contact notre chauffeur doit-il utiliser ? Merci de nous l'écrire, et nous mettons la commande à jour.`,
  custAskWhich: (v) => `Bonjour ${v.cust}, ${v.place} indique que les détails d'enlèvement de la commande ${v.ref} ne correspondent pas à leur planning. Pouvez-vous confirmer où la voiture (${v.car}) doit être enlevée ?`,
  cAskWhere: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de la commande ${v.ref}. Où exactement notre chauffeur doit-il prendre la voiture (${v.car}) ?`,
  cWriteUs: () => `La personne qui suit cette voiture est absente aujourd'hui. Écrivez-nous, et nous répondrons par écrit.`,
  feeAsk: (v) => `Bonjour, pour l'enlèvement de la commande ${v.ref}, nous facturons des frais de traitement${v.amount ? ` de ${v.amount}` : ""}. Merci de les confirmer avant la venue du chauffeur.`,
  feeCheck: () => `Merci. Nous vérifions avec le client et revenons vers vous avant l'enlèvement.`,
  custFee: (v) => `Bonjour ${v.cust}, ${v.place} demande des frais de traitement${v.amount ? ` de ${v.amount}` : ""} pour l'enlèvement de la commande ${v.ref}. Les acceptez-vous ?`,
  cAskFee: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet des frais pour la commande ${v.ref}. À quoi correspondent-ils ?`,
  cFeeWhat: () => `Au déplacement de la voiture hors de notre stock pour la remise. Il nous faut votre confirmation par écrit.`,
  confirmSlot: (v) => `Bonjour, ici le Readiness desk de Bahn au sujet de la commande ${v.ref} (${v.car}). Notre chauffeur vient ${v.slot}. Tout est-il prêt pour la remise ?`,
  allSet: () => `Bonjour, nous avons bien la commande. Le chauffeur donne le numéro de commande à son arrivée.`,
  cAskPlan: (v) => `Bonjour, ici le Readiness desk de Bahn, au sujet de la commande ${v.ref}. La remise ${v.slotDay} est-elle toujours prévue ?`,
  cAsPlanned: () => `À ma connaissance, oui. Le chauffeur donne le numéro de commande à son arrivée.`,
}

const BOOKS: Record<Lang, Book> = { en, de, fi, da, sv, fr }

export function say(lang: Lang, key: Key, v: V): string {
  return BOOKS[lang][key](v)
}

/** Every key exists in every language (the test checks it). */
export function missingPhrases(): string[] {
  return LANGS.flatMap((l) => KEYS.filter((k) => typeof BOOKS[l][k] !== "function").map((k) => `${l}.${k}`))
}

// ---------- dates, in each language's own words ----------

const LOCALE: Record<Lang, string> = { en: "en-GB", de: "de-DE", fi: "fi-FI", da: "da-DK", sv: "sv-SE", fr: "fr-FR" }

function parts(iso: string, lang: Lang, tz: string) {
  const p = new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).formatToParts(new Date(iso))
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ""
  return { weekday: get("weekday"), day: get("day"), month: get("month"), hour: get("hour"), minute: get("minute") }
}

/** "on Thursday 22 October" / "am Donnerstag, 22. Oktober" / "torstaina 22. lokakuuta" ... */
export function dayPhrase(iso: string | null, lang: Lang, tz: string): string {
  if (!iso) return { en: "on the planned day", de: "am geplanten Tag", fi: "suunniteltuna päivänä", da: "på den planlagte dag", sv: "den planerade dagen", fr: "le jour prévu" }[lang]
  const d = parts(iso, lang, tz)
  switch (lang) {
    case "de": return `am ${d.weekday}, ${d.day}. ${d.month}`
    case "fi": return `${d.weekday}na ${d.day}. ${d.month}`
    case "da": return `${d.weekday} den ${d.day}. ${d.month}`
    case "sv": return `${d.weekday} den ${d.day} ${d.month}`
    case "fr": return `le ${d.weekday} ${d.day} ${d.month}`
    default: return `on ${d.weekday} ${d.day} ${d.month}`
  }
}

/** The day plus the time: "on Thursday 22 October at 11:00", "am Donnerstag, 22. Oktober, um 11:00 Uhr" ... */
export function slotPhrase(iso: string | null, lang: Lang, tz: string): string {
  const day = dayPhrase(iso, lang, tz)
  if (!iso) return day
  const d = parts(iso, lang, tz)
  switch (lang) {
    case "de": return `${day}, um ${d.hour}:${d.minute} Uhr`
    case "fi": return `${day} klo ${d.hour}.${d.minute}`
    case "da": return `${day} kl. ${d.hour}.${d.minute}`
    case "sv": return `${day} kl. ${d.hour}.${d.minute}`
    case "fr": return `${day} à ${d.hour}h${d.minute}`
    default: return `${day} at ${d.hour}:${d.minute}`
  }
}
