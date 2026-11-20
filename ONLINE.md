# DMC mexx online multiplayer

De lokale versie blijft beschikbaar. De nieuwe online modus werkt als een
Kahoot-lobby: de beheerder maakt een lobby, deelt een code of uitnodigingslink,
en deelnemers melden zich met een naam aan op hun eigen apparaat.

## Starten

Benodigd: Node.js 24 of nieuwer. Er zijn geen externe npm-pakketten nodig.

```sh
npm start
```

Open op de computer waarop de server draait de website op poort 3000 en kies
Online multiplayer, of open het pad `/online`. Maak een lobby en deel de code.
Andere apparaten gebruiken de publiek gehoste HTTPS-website; localhost op een
telefoon verwijst naar die telefoon en niet naar de spelserver.

```sh
npm test
```

De tests controleren spelregels, rechten, realtime updates, dubbele verzoeken,
het herstellen van sessies, chat en media, opslaglimieten en het afronden van
een worp na een serverherstart.

## Schermen en bediening

De lobby heeft twee tabs: **Spelers** en **Spelregels**. De beheerder sorteert
spelers met de sleepgreep, op desktop of via aanraking. De pijltjestoetsen op
een gefocuste greep bieden dezelfde bediening. Spelregels gebruiken toggles;
extra scores staan onder een uitklapbare optie. Bij niet-opgeslagen wijzigingen krijg je vóór het verlaten van de tab of starten
keuze uit verder bewerken, wegdoen of opslaan. Foutieve instellingen blijven
staan zodat je ze kunt herstellen.

Tijdens het spel staan de beheeracties in het menu **•••**.
**Ronde stoppen** bepaalt de huidige verliezer; **Terug naar lobby** beëindigt
de partij. Een nieuwe ronde start via de uitslag of de knop op de dobbeltafel.
Er staan geen dubbele reset- of nieuwe-rondeknoppen meer boven de tafel.

De chat zweeft rechtsonder. Bij een nieuw bericht van iemand anders verschijnen
een rode teller en kort de naam en berichtpreview. Je eigen berichten hebben
een verzendbevestiging. Het openen van de chat focust het invoerveld niet, zodat
je op je telefoon eerst de berichten kunt lezen. Foto’s, video’s en spraakmemo’s blijven beschikbaar.

## Wie doet wat?

- De beheerder stelt regels, teams en speelvolgorde in en start het spel.
- De beheerder kan zelf meespelen of alleen meekijken.
- Alleen de speler aan de beurt kan gooien, stenen vastzetten en doorgeven.
  Ook een beheerder kan niet voor iemand anders gooien.
- Iedereen ziet dezelfde stenen, laatste scores, sterren, strafmeldingen en uitslag.
- Alleen de beheerder start de volgende ronde, sluit een ronde voortijdig af of
  opent de lobby opnieuw. Terug naar de lobby beëindigt de lopende partij.
- In de lobby kan het beheer worden overgedragen en kunnen spelers worden
  verwijderd of tijdelijk op meekijken worden gezet.
- De lobby verlaten meldt je af. Als de beheerder de lobby verlaat gaat het
  beheer naar de eerste overgebleven deelnemer.

Namen en teams worden ingesteld vóór het starten van een partij. Sluit de
beheerder de lobby opnieuw open, dan kunnen de samenstelling en regels worden
gewijzigd. Late deelnemers komen dus in de lobby voordat een partij start.

Bij het maken van of meedoen aan een lobby kun je naast je naam een avatar
kiezen: tien ingebouwde illustraties met dobbel-, bier- en dierenthema’s. Initialen
blijven ook mogelijk. In de lobby kun je je eigen avatar opnieuw kiezen. Andere
leden zien de wijziging direct; de keuze wordt met je lobbysessie opgeslagen.
Alleen je eigen avatar kan worden gewijzigd. Je kunt daarnaast een eigen foto kiezen (PNG, JPG, WebP of GIF, maximaal 5 MB).
De browser snijdt de foto vierkant bij en verkleint hem. De server bewaart alleen
de kleine PNG als apart, uitsluitend voor lobbyleden toegankelijk bestand; live
spelupdates bevatten geen afbeeldingsdata. Vervangen, verwijderen of verlopen
van een lobby ruimt de bijbehorende foto op.

## Adt-teller en kavelen

Achter elke naam in de lobby en het spel staan bierpullen voor het totale aantal
opgelegde adtjes, inclusief halve adtjes en de extra straffen voor van tafel,
een vierde worp of vastgezette stenen. Een rondeverlies wordt alleen bij de
speler met de verliezende worp geteld, ook in teammodus. Het totaal blijft binnen
de lobby bewaard bij nieuwe rondes, opnieuw starten vanuit de lobby, verversen
en serverherstarts. Oude opgeslagen spelstanden worden bij opstarten één keer
bijgewerkt op basis van de nog bewaarde rondes en straffen.

Bij een gedeelde laagste eindscore kavelen alleen de betrokken spelers: ieder
gooit één keer met twee losse stenen. De beurt gaat automatisch door en alleen
de laagste kavelscore verliest. Bij opnieuw gelijkspel kavelen de spelers met
die laagste score opnieuw. Gewone en extra Mexx-scores tellen als hoogste en
verhogen de rondestraf; Nouri en extra direct-af-scores beëindigen ook tijdens
kavelen direct de ronde. Vastzetten en een vierde worp zijn dan uitgeschakeld.
De oorspronkelijke en kavelworpen blijven samen in het scoreoverzicht staan.

Van tafel gooien heeft bij inschakelen **2% kans per beurt**, gecontroleerd bij
de eerste normale worp. Extra worpen en opnieuw gooien na van tafel verhogen
die kans niet. Dezelfde regels werken in de lokale spelmodus.

De uitslagpopup toont de verliezer en de bierpullen. Een half gevulde pul staat
voor een half adtje, een volle voor één adtje. Rondenummer, optelsom en volgende
starter zijn uit de popup verwijderd; de berekening en spelvolgorde zijn gelijk.

## Lobbychat

Via **Chat** rechtsonder kunnen alle lobbyleden tekst, foto’s, video’s en
spraakmemo’s delen, ook tijdens het spel en als ze alleen meekijken. Nieuwe
berichten verschijnen direct; bij een gesloten paneel toont de knop het aantal
nieuwe berichten. Chatten verandert geen worpen, scores, regels of speelvolgorde.

Schrijf een bericht (maximaal 2000 tekens), kies een foto, video of audiobestand,
of klik op **Spraakmemo opnemen**. Opnemen vraagt microfoontoestemming en werkt
via HTTPS of localhost. Na **Stop opname** kun je terugluisteren en zelf op
**Verzenden** klikken. Opnamen stoppen na maximaal 60 seconden. Annuleren, de chat
sluiten, de pagina verlaten of verbindingsverlies stopt een lopende opname en
geeft de microfoon vrij. Zonder microfoontoegang kun je nog tekst en bestanden
delen. Foto’s en video’s worden gekozen uit bestanden; cameratoegang is niet nodig.

Bestanden mogen maximaal 10 MB zijn. Ondersteund zijn JPEG, PNG, GIF, WebP,
MP4, WebM, MOV en audio als WebM, Ogg, MP4/M4A, MP3 of WAV. Afspelen hangt af
van de codecs die de browser ondersteunt. De server controleert bestandstype,
bestandssignatuur, grootte en lobbysessie; SVG en andere actieve documenten
worden niet geaccepteerd. Alleen leden van dezelfde lobby kunnen berichten en
media ophalen. Verwijderde of afgemelde leden verliezen die toegang.

Chatberichten en media worden in dezelfde SQLite-database opgeslagen en blijven
bij een serverherstart behouden wanneer `DMC_DATA_DIR` op blijvende opslag staat.
Per lobby blijven de laatste 100 berichten en maximaal 50 MB aan media bewaard;
bij overschrijding verdwijnen de oudste berichten met hun bijlagen. Bij het
verlopen van een lobby of vertrek van het laatste lid wordt de chat verwijderd.
Iedere deelnemer kan maximaal 30 berichten/uploads per minuut versturen.
Bestaande lobby’s krijgen de chattabel automatisch bij de volgende serverstart;
er zijn geen extra pakketten, externe opslagdiensten of configuratievariabelen nodig.

## Realtime en opslag

De server bepaalt de willekeurige worpen en verwerkt alle spelacties. Verzoeken
gebruiken een beveiligde, niet voor JavaScript leesbare sessiecookie; de lobbycode
is een uitnodiging en geeft geen beheerrechten. De server controleert de rol en
actieve beurt bij iedere opdracht. Acties sturen alleen de intentie, zoals
roll, hold of pass; een deelnemer kan geen dobbeluitkomst aan de server opleggen.

Realtime updates lopen via Server-Sent Events met dezelfde spelserver als de
website. Bij verbindingsverlies worden knoppen geblokkeerd. Na herstel krijgt
iedereen een volledige actuele stand. Verversen herstelt de eigen deelnemer
zolang dezelfde browser de sessiecookie nog heeft. Gebruik aparte browsers of
privévensters als je op één computer verschillende deelnemers wilt testen.

SQLite bewaart de lobby, deelnemers, regels, spelstand, gehashte sessietokens en
nog af te ronden worpen. De standaardmap is `.dmc-data`; met `DMC_DATA_DIR` kan
een andere locatie worden gekozen. Die map wordt niet via de website gedeeld.
Na een procesherstart worden geplande worpen en uitslagen alsnog afgerond.
Een lobby heeft maximaal 30 deelnemers; er worden maximaal 100 lobby's tegelijk
bewaard. Lobby's zonder verbindingen verlopen na 24 uur zonder spelactiviteit.
Per partij worden de laatste 100 rondes bewaard. Er is geen permanente account-
of wedstrijdhistorie buiten deze lobby's.

## Publiek online zetten

Alleen een HTML-bestand op Netlify Drop is voor deze modus onvoldoende. De
Node-server moet blijven draaien en toegang hebben tot een permanente schijf.

Een concrete route is een Docker-webservice op bijvoorbeeld Render of Railway:

1. Zet de bestanden uit dit project in de root van je GitHub-repository.
2. Maak bij de host een webservice die de meegeleverde `Dockerfile` bouwt.
3. Gebruik één instance. Koppel een permanente schijf op `/app/data`.
4. Stel zo nodig `DMC_DATA_DIR=/app/data` in. De server gebruikt de door de host
   aangeleverde `PORT`; zonder die variabele is de poort 3000.
5. Gebruik `/healthz` als healthcheck en de HTTPS-link van de host als speladres.
6. Open `/online`, maak een lobby en deel de uitnodigingslink of code.

Kies een hostingplan dat een permanent draaiende webservice en blijvende opslag
ondersteunt. Dit kan hostingkosten met zich meebrengen. Tijdens dit ontwikkelwerk
is geen dienst aangemaakt, betaald of gepubliceerd.

De Docker-start voert alleen de voorbereiding van de datamap als root uit en
schakelt daarna naar gebruiker 1000. Als je een eigen deployment gebruikt, moet
de servicegebruiker naar de database-map kunnen schrijven. Website en API moeten
via dezelfde oorsprong worden aangeboden; een eventuele reverse proxy moet SSE
zonder buffering doorlaten. Voor microfoonopname is HTTPS nodig.

Voor een eigen Docker-host:

```sh
docker compose up --build -d
```

De meegeleverde compose-configuratie bewaart de database in een volume. Gebruik
ook daar HTTPS via je hostingprovider of reverse proxy voordat je de site met
vrienden deelt. Het Docker-image is gebouwd en gestart. De healthcheck, het draaien als
gebruiker 1000 en het behoud van lobby, sessie en worp na een containerherstart
zijn gecontroleerd. Publicatie bij een cloudhost is nog niet uitgevoerd.

De huidige opslag- en realtime-opzet is bedoeld voor één serverinstance. Meerdere
instanties vereisen gedeelde databaseopslag en een berichtenlaag; dat valt buiten
deze eerste versie. Back-ups van het SQLite-volume blijven de taak van de host.

## Uitgevoerde controles

- Eigen avatarfoto kiezen, bijsnijden, delen en hervatten na verversen/herstart;
  ongeldige en te grote uploads, toegangscontrole en het opruimen van oude foto’s.
- Halfvolle/volle bierpullen, compacte uitslag en strafpopup, duidelijk vastzetten,
  rode accenten, Lobby-titel en instellingenvolgorde gecontroleerd in de browser.

- Lokale en online waarschuwing voor niet-opgeslagen wijzigingen: verder
  bewerken, wegdoen, opslaan, ongeldige invoer en behoud van concepten bij live updates.
- Avatars kiezen bij maken/meedoen, eigen avatar wijzigen, gedeelde weergave,
  hervatten na vernieuwen en serverherstart, en validatie van vaste avatar-ID’s.
- Geen automatische chatfocus, een kopieericoon bij de lobbycode, standaardlid
  Daan en de vereenvoudigde instellingen gecontroleerd op desktop en mobiel.

- Nieuwe vormgeving op desktop en iPhone X-formaat: lokale en online
  sleepvolgorde, aanraking, toetsenbord, team- en ledenvolgorde, toggles,
  gescheiden tabs, spelmenu, subtiel vastzetten en chatmeldingen.
- Foto, video, audio en microfoonopname opnieuw in twee browsersessies getest;
  ook verbindingsherstel, foutmeldingen, conceptbehoud en HTML-export gecontroleerd.
- Server controleert beheerrechten, lobbyfase en de volledige actuele spelerslijst
  bij sorteren; verouderde of ongeldige sleepacties worden afgewezen.

- Kavelen online en lokaal via de echte spelknoppen, uitslag met Mexx-straf,
  chat tijdens kavelen, adt-teller in lobby en spel, mobiele weergave en verversen.
- Automatische controles voor herhaald kavelen, extra Mexx/direct-af/Nouri,
  precies 2% per beurt, persoonlijke teamtellers, meer dan 100 rondes, herstart
  tijdens kavelen, oude verzoeknummers en het bijwerken van oude opgeslagen spellen.

- Docker-build met chatbestanden: healthcheck, laden van de chatmodule, server
  als gebruiker 1000 en behoud van sessie, tekst en foto na containerherstart.

- Lobbychat in twee aparte Chromium-browsersessies: tekst als gewone tekst,
  foto’s, afspeelbare video/audio, microfoonopname met terugluisteren,
  ongelezen berichten, chat tijdens een beurt, echte worp via de spelknop,
  hervatten na verversen, mobiel scherm, annuleren en verbindingsherstel.
- Geweigerde microfoontoegang en een mislukte verzending: chat blijft bruikbaar
  en het concept blijft behouden. De lokale spelmodus start en kan nog gooien.

- 24 Node-tests voor spelregels, chat/media, opslaglimieten, HTTP-rechten, live updates en meerdere tabbladen,
  het overdragen van beheer en hervatten na een serverherstart.
- Vier aparte browsersessies: beheerder die alleen meekijkt en drie spelers;
  gelijke worpen, eigen bediening, volgorde, teams, Nouri, straffen en herstel
  na internetverlies.
- Lokale spelmodus en bestaande instellingen opnieuw gecontroleerd.
- Docker-image gebouwd; echte container met permanent volume gestart en opnieuw
  gestart; database en sessie bleven behouden.

Er staat hiermee nog geen publieke website online. Daarvoor is de hostingstap
met een eigen hostingaccount en permanente opslag nodig.
