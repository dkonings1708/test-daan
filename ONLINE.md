# DMC mexx online multiplayer

De lokale versie blijft beschikbaar. De nieuwe online modus werkt als een
Kahoot-lobby: de beheerder maakt een lobby, deelt een code of uitnodigingslink,
en deelnemers melden zich met een naam aan op hun eigen apparaat.

## Starten

Benodigd: Node.js 24 of nieuwer. Er zijn geen externe npm-pakketten nodig.

```sh
npm start
```

Open op de computer waarop de server draait de website op poort 3000.
De homepage opent online spelen; `/online` blijft beschikbaar.
Via **Lokaal spelen** open je `/local`. Maak een lobby en deel de code.
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
Voor deelnemers met een profiel worden profiel en lobby-avatar beide kanten op
bijgewerkt, ook in lopende spellen en andere gekoppelde lobbies. De privéfoto
krijgt bij vervangen een nieuwe URL, zodat een oude browsercache niet wordt
hergebruikt. Gastavatars blijven onafhankelijk. De spelerslijst in het spel
toont dezelfde foto of illustratie naast de naam, score en numerieke adt-teller.
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

Van tafel gooien staat voor nieuwe instellingen standaard op **1% per beurt**.
De gebruiker kiest met een slider 0–5% in hele stappen; 0% zet de regel uit.
Eerdere opgeslagen instellingen blijven behouden. De kans wordt gecontroleerd bij
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
Per partij worden de laatste 100 rondes bewaard. Apparaatprofielen bewaren hun eigen totaaltellers buiten de lobbyvervaltijd;
er is geen volledige wedstrijdhistorie buiten de lobby's.

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


## Apparaatprofielen

Optionele apparaatprofielen gebruiken `/api/profile` (GET/POST) en
`/api/profile/forget` en `/api/profile/reset` (POST). Een aparte HttpOnly-cookie `dmc_profile` identificeert
het profiel; de lobbycookie blijft onafhankelijk. `useProfile: true` bij maken of
joinen koppelt de deelnemer aan het eigen profiel. Zonder die keuze speel je als
gast, ook wanneer dit apparaat een profiel heeft. Naam en foto worden vooraf
ingevuld. Profielfoto's worden voor een lobby naar de bestaande privé-avataropslag
gekopieerd, zodat verwijderen/verlopen van een lobby het profiel niet verwijdert.

Zonder externe opslag staan `device_profiles` en `profile_rounds` in SQLite;
daarvoor moet `DMC_DATA_DIR` op een permanente schijf staan. Voor gratis Render
is [Supabase-opslag](SUPABASE.md) beschikbaar. Stel de twee servervariabelen in
en voer [het SQL-script](supabase/profiles.sql) uit. Cloudprofielen en hun
profielfoto’s en statistieken blijven dan na vervanging van de Render-container
beschikbaar. Lobbies en chat blijven lokaal.
Afgeronde rondes worden per profiel, spel en ronde eenmaal geteld; persoonlijke
straffen worden samen met de spelstand binnen een transactie verwerkt.
Profiel-ID's en cookies worden niet in lobbysnapshots gedeeld. Alleen online
spel telt mee. Er zijn geen OAuth-sleutels of extra diensten nodig. Een profiel
werkt uitsluitend zolang de cookie op dit apparaat beschikbaar is.


### Persoonlijke statistieken resetten

`POST /api/profile/reset` met `{"scope":"adts"}` reset alleen persoonlijke adtjes;
`{"scope":"all"}` reset adtjes en gespeelde rondes. De profielcookie is vereist.
Identiteit, lid-sindsdatum, lobbytellers en de verwerkingsregistratie van eerdere
rondes blijven behouden. Daardoor worden oude gebeurtenissen niet nogmaals
geteld, ook na opnieuw verbinden of een serverherstart.

Lobby- en speltellers tonen numerieke adtjes met een Nederlandse decimale komma.
De bierpullen in uitslag- en incidentpopups blijven beschikbaar. De mobiele chat
gebruikt 16px invoertekst en volgt `visualViewport` bij typen, scrollen en draaien.


## Supabase-opslag voor profielen

Zie [SUPABASE.md](SUPABASE.md) voor de volledige installatie en grenzen. De
koppeling gebruikt de Supabase Data API met een server-side secret key, zonder
extra npm-dependencies. De databasefuncties gebruiken `security invoker` en
expliciete grants aan `service_role`; alle profieltabellen hebben RLS en geen
rechten voor `anon`/`authenticated`. Er zijn geen publieke profielendpoints met
Supabase-sleutels in de browser.

De bestaande `dmc_profile`-cookie en gehashte identiteit blijven behouden.
Profiel-API’s en profieldeelname lezen uit Supabase. Spelgebeurtenissen worden
binnen de lokale speltransactie aan een wachtrij toegevoegd, daarna via een
idempotente databasefunctie verwerkt. De cloud gebruikt een vergrendeling per
profiel voor optellen en resetten; een unieke profiel/spel/ronde-combinatie
voorkomt dubbele rondes. Bij netwerkfouten wordt opnieuw geprobeerd. Een
profile-GET geeft bij een cloudstoring 503, zodat een storing niet als een
verdwenen profiel wordt behandeld. De migratie naar Supabase bewaart een vaste
importbasis om nieuwe, nog niet verstuurde gebeurtenissen niet dubbel te tellen.


## Random teams

In teammodus is **Random teams** beschikbaar. Online stelt de beheerder onder
**Spelregels → Spelers per team** een heel aantal van 2–30 in en slaat dit op.
Onder **Spelers** maakt de knop de willekeurige indeling; een voorbeeld toont
de verwachte teamgroottes. Iedere meespelende deelnemer komt precies eenmaal
in een team. Toeschouwers worden niet ingedeeld. Alleen de beheerder kan loten,
uitsluitend voordat het spel begint. Achter iedere speler staat het team.

Negen spelers bij grootte 2 worden verdeeld als **2–2–2–3**. Een overgebleven
speler sluit aan bij het laatste team; twee of meer restspelers vormen samen
een laatste kleiner team. Bijvoorbeeld: acht spelers bij grootte 3 worden
**3–3–2**. Opnieuw loten is mogelijk; de indeling wordt niet automatisch
veranderd bij starten of door een nieuwe deelnemer.

Lokaal staan de grootte en de knop bij **Teams & volgorde**. Alle ingevoerde
teamleden worden opnieuw ingedeeld, met behoud van hun namen en identiteit.
De grootte wordt met de lokale spelinstellingen opgeslagen. De bestaande
handmatige teamindeling, sleepvolgorde en optie ‘Hele team achter elkaar’ blijven
beschikbaar. De lokale HTML werkt nog steeds zonder externe bestanden.


## Schudden om te gooien

Op ondersteunde telefoons kun je schudden inschakelen. Online staat **Schudden**
boven de dobbeltafel; lokaal staat de knop in het spelmenu **•••**. Op iPhones
verschijnt na het aantikken zo nodig de browservraag om toegang tot
bewegingssensoren. De functie gebruikt een beveiligde context (HTTPS of
localhost). Als toegang wordt geweigerd of sensoren ontbreken, blijft de
gewone gooiknop beschikbaar. Opnieuw aantikken schakelt schudden uit.

Een duidelijke schudbeweging met meerdere richtingswisselingen start één worp.
Er geldt een afkoeltijd en een pauze tussen bewegingen; doorlopend schudden
start geen reeks worpen. Schudden werkt alleen wanneer je mag gooien: tijdens
je eigen online beurt, binnen de worplimiet en zonder open straf/uitslagvenster.
Ook bij een geopende online chat of invoerveld wordt niet automatisch gegooid.
Online worden de sensoren in de hoofdpagina gebruikt, zodat een iPhone geen
toestemming vanuit het spel-iframe hoeft te vragen.

Bij de **eerste worp van een beurt** is de kans op van tafel gooien bij schudden
tweemaal de ingestelde kans: standaard 1% wordt 2%, maximaal 5% wordt 10%.
0% blijft uit. De bestaande controle gebeurt nog steeds eenmaal per beurt;
na de eerste worp of een van-tafel-straf wordt niet opnieuw voor die beurt
geloot. Een vierde bonusworp behoudt zijn bestaande regels. De server bepaalt
de kans en bewaakt beurt, worplimiet en vastgezette stenen.

De detectie, permissies, blokkades en bron van online worpen zijn getest met
gesimuleerde bewegingssignalen en iPhone X-emulatie. De knopbediening, lokale
standalone versie, avatars, profielen en teamregels blijven beschikbaar.
