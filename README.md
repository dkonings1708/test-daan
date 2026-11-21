# DMC mexx

Nederlandstalig dobbelspel in DMC-rood, groen, wit en zwart, met lokale en online
multiplayer-modus. De homepage opent online spelen; **Lokaal spelen** opent `/local`.
De lokale versie staat volledig in `index.html` en heeft geen
installatie of accounts nodig. Online multiplayer gebruikt de meegeleverde
Node.js-server en een lobbycode. Via **Inloggen** of **Mijn profiel → Account koppelen**
kun je met e-mail en wachtwoord hetzelfde profiel op meerdere apparaten gebruiken.
Foto en online statistieken blijven bij het account; gastspelen blijft mogelijk.
Dit vereist de [Supabase Auth-instellingen](SUPABASE.md#inloggen-op-meerdere-apparaten).
De lobbychat deelt tekst, foto’s, video’s en
spraakmemo’s met de deelnemers, ook tijdens het spel. Zie `ONLINE.md` voor starten en publiceren. Open het bestand in een browser met JavaScript ingeschakeld;
een bestandsvoorbeeld in een berichtenapp voert het spel mogelijk niet uit.

## Vrienden en vaste groepen

Via **Vrienden & groepen** beheer je vrienden, clans en een blijvend groepsklassement.
Tik op namen of avatars om profielen te bekijken. Elke online deelnemer kan extra
gast- of accountspelers op hetzelfde apparaat toevoegen. Zie [SOCIAL.md](SOCIAL.md)
voor gebruik, privacy, spelregels en de benodigde Supabase-migratie.

## Instellingen

Het startdashboard heeft de tabbladen **Spelers** en **Spelregels**. De vaste
DMC-ledenlijst staat onder de normale spelinstellingen.
Het clublogo is geen instelling meer; het blijft onderdeel van de kop van de app.
Bij niet-opgeslagen wijzigingen krijg je bij het verlaten van de instellingentab
keuze uit verder bewerken, wegdoen of opslaan. Dit werkt lokaal en online, ook
als je met het toetsenbord van tab wisselt. Een mislukte opslag houdt je wijzigingen vast.

De DMC-ledenlijst bevat standaard Q, Jordan, Lon, Siem, Sef, Robin, Dennis, Ties,
Gijs, Kay, Sem en Daan. Onder Instellingen kun je namen aanpassen, toevoegen en
verwijderen. De schakelaar DMC-leden inladen vult de individuele spelerslijst.
In teammodus worden de leden om en om over de bestaande teams verdeeld; daarna
kun je namen en volgorde aanpassen. Uitschakelen herstelt de handmatige lijsten.

Extra Mexx-scores zijn gelijkwaardig aan 21: ze tellen als hoogste worp, leveren
sterren op en verhogen de straf per ronde. Extra direct-af-scores stoppen de
ronde met RIP, ook zonder Nouri. Het gegooide resultaat blijft 0,8 seconde zichtbaar
voordat de uitslag verschijnt. Gebruik mogelijke getoonde scores, bijvoorbeeld
31, 65 of 400, gescheiden door komma's, puntkomma's of spaties. 21 blijft Mexx en
kan niet direct af zijn. Een score mag niet in beide extra lijsten staan. Nouri-43
gaat vóór een extra Mexx-regel voor 43 wanneer Nouri is ingeschakeld.

Klik op Instellingen opslaan om de ledenlijst en regels lokaal in je
browser te bewaren. Als de browser opslag blokkeert blijven de instellingen
actief voor de sessie.

## Extra tafelregels

De aanvullende regels worden met de andere instellingen opgeslagen:

- Van tafel gooien: standaard 1% kans per beurt bij de eerste normale worp.
  De schuifregelaar gaat van 0 tot 5% in hele stappen; 0% schakelt de regel uit.
  Bestaande opgeslagen keuzes blijven behouden. Alleen de losse stenen
  vliegen met een animatie uit het speelveld. De worp verandert geen score,
  sterren of worplimiet; de werper krijgt een half adtje en mag opnieuw gooien.
- Een vierde worp toestaan: bij een limiet van drie blijft na de derde geldige
  worp nog één extra worp mogelijk. De vierde worp levert altijd een half adtje
  op, telt niet mee voor score, Mexx of RIP en kan niet worden herhaald. De
  derde score blijft staan. Daarna kun je de beurt doorgeven of afsluiten.
- Vastgezette stenen doorgeven: vastgezette stenen worden aan de volgende
  speler overgedragen. Deze kan ze voor de eerste worp aantikken om los te maken.
  Op gooien drukken terwijl er nog een overgenomen steen vaststaat geeft een
  half adtje. De stenen worden dan losgemaakt; dezelfde speler mag opnieuw.

Deze extra straffen zijn per speler, ook in teammodus, en staan los van de
straf voor de verliezer van de ronde. De ronde wordt er niet door beëindigd.
Het overzicht toont de extra halve adtjes en bewaart ze bij de vorige rondes.

## Startdashboard

- Single player: geef de namen op; iedereen speelt individueel.
- Team mode: maak teams en voeg teamleden toe. De teams gooien na elkaar.
- Sleep de greep naast een speler, team of teamlid om de volgorde te wijzigen.
  Dit werkt ook met aanraking. Met de greep gefocust werken de pijltjestoetsen.
- Namen zijn optioneel: lege velden krijgen automatisch Speler 1, Speler 2, enz.
  Lege teamnamen krijgen Team 1, Team 2, enz. Je kunt meteen starten.
- Start het spel gebruikt een directe knopactie, zonder formulierverzending.
  Daardoor werkt de knop ook in een voorbeeldvenster dat scripts toestaat maar
  formulieren blokkeert. Enter in een naamveld start het spel eveneens direct.
- De knop Speler toevoegen staat direct onder de laatste speler. Bij teams
  staat Teamlid toevoegen onder de leden van elk team.
- Met 'Het hele team gooit' uit speelt één teamlid per team per ronde. De
  volgende ronde schuift de beurt altijd door naar het volgende teamlid, ook
  bij het verliezende team. Het verliezende team begint de volgende ronde.
- Met de schakelaar aan gooit eerst één team helemaal, daarna het volgende
  team. Het verliezende team begint de volgende ronde; binnen dat team
  begint de speler met de laagste score, gevolgd door diens teamgenoten.
- Nouri mode is optioneel: bij de combinatie 3 en 4 verliest de speler direct en eindigt de hele
  ronde meteen. De dobbelstenen en de 43 blijven eerst 0,8 seconde zichtbaar.
  Daarna toont de uitslag een kruis met RIP en het getal 34. De gewone
  scoreberekening (hoogste cijfer voorop) blijft gelijk. Doorgeven en verder gooien zijn
  geblokkeerd, maar de uitslag kan worden gesloten om de scores te bekijken.

## Spelregels

De hoogste dobbelsteen komt voorop: 3 en 6 is 63. Dubbel telt als honderdtal:
4 en 4 is 400. Mexx (21) is de hoogste worp, boven dubbel zes. De eerste beurt heeft maximaal drie worpen en bepaalt bij het
Doorgeven de limiet voor alle volgende beurten in de ronde. Eerder stoppen mag;
alleen de laatste worp telt. Elke gegooide 21 geeft een ster, ook bij opnieuw gooien.

Na de eerste worp kun je een dobbelsteen aantikken om hem vast te zetten of los
te maken, ook na de derde worp vóór het doorgeven. Dat geeft geen extra worp
en verandert de score niet. Alleen losse stenen rollen opnieuw. De stenen beginnen alleen bij
het starten van een nieuw spel op 1 en 1. Daarna blijven de gegooide ogen liggen
bij doorgeven en bij een nieuwe ronde. Zonder de vastzetregel worden stenen
bij doorgeven losgemaakt; bij een nieuwe ronde worden ze altijd losgemaakt.
Na alle geplande beurten verschijnt automatisch de uitslag met de verliezer en
straf. Bekijk scores, het kruisje, Escape of klikken buiten de pop-up sluiten
alleen de uitslag; scores, sterren, straf en ronde blijven behouden. Nieuwe ronde
start pas na een expliciete klik op die knop. Dit geldt ook bij RIP. De laatste speler sluit via Ronde afsluiten af, of de ronde eindigt direct
als diens laatste toegestane worp is gebruikt. De laagste eindscore verliest;
bij een gedeelde laagste score gaan alleen die spelers kavelen. Ieder krijgt
één worp met twee losse stenen; de beurt gaat daarna automatisch door. De laagste
kavelscore verliest. Zijn er opnieuw meerdere laagste scores, dan kavelen alleen
die spelers verder. Mexx (ook extra Mexx) blijft het hoogst en telt mee voor de
straf; Nouri en extra direct-af-scores beëindigen ook tijdens kavelen de ronde.
Vastzetten en een vierde worp zijn bij kavelen niet mogelijk. De uiteindelijke
verliezer begint de volgende ronde. Bij Nouri-43 is de werper altijd de
verliezer, ook als anderen nog niet hebben gegooid. In teammodus toont de
uitslag de verliezende teamnaam; de tekst eronder noemt de speler met de laagste
score of de Nouri-43. Bij meerdere verliezers binnen één team wordt die teamnaam
maar één keer genoemd.

De straf per verliezer (of verliezend team) is een half adtje als basis, plus
een half adtje voor
elke Mexx (21) in deze ronde. Alle worpen tellen daarvoor mee, inclusief eerdere
worpen van een beurt. Nul Mexx is een half adtje; één is 1 adtje; twee is 1,5 adtjes.
De Mexx-teller voor deze straf begint elke ronde op nul en gebruikt geen sterren
uit eerdere rondes. Alle kavelworpen tellen binnen dezelfde ronde mee.

Achter iedere naam staat daarnaast het totaal aan opgelegde adtjes, inclusief
halve adtjes en extra straffen. Een rondeverlies telt alleen bij de speler met
de verliezende worp, ook in teammodus. Online blijft deze adt-teller binnen de
lobby behouden bij nieuwe rondes, terugkeer naar de lobby, een nieuw spel,
verversen en een serverherstart. In de lokale modus geldt het totaal voor het
huidige spel; een reset of nieuw spel begint weer op nul.

Nieuwe ronde begint bij de verliezer of het verliezende team; daarna volgt
de ingestelde volgorde in een cirkel. Bij één teamlid per ronde schuift elk team
door naar het volgende lid. Iedereen mag weer meedoen en de worplimiet begint
bij drie.

Nieuwe ronde reset alle scores en Mexx-sterren en archiveert de vorige ronde.
Het keuzemenu in het overzicht laat eerdere rondes met hun eigen sterren
terugzien. Sterren gelden uitsluitend voor de geselecteerde ronde. Een voortijdige nieuwe ronde
vraagt bevestiging en toont daarna eerst de uitslag op basis van de tot dan
gespeelde eindworpen. Als niemand heeft gegooid wordt geen straf toegekend. Reset wist scores, rondes en sterren en opent het dashboard;
ingevulde namen blijven staan. Scores en de lopende partij worden niet na sluiten
of vernieuwen bewaard. Opgeslagen leden en regels blijven wel beschikbaar
via browseropslag of de gedownloade kopie met instellingen.

## Online avatars

Bij het maken van of meedoen aan een lobby kies je optioneel één van tien avatars:
Dobbelduivel, Bierbaas, Feestkikker, Dobbelkat, Gelukseend, Pintpinguïn, Sluwe vos,
Dorstige draak, Nachtuil en Bierhaai. Je kunt ook je initialen houden. Klik in de
lobby op je eigen avatar om hem te veranderen. Wijzigingen via **Mijn profiel**
werken direct door in gekoppelde lobbies en lopende spellen. Een wijziging via
je lobby-avatar wordt ook in je profiel bewaard wanneer je met dat profiel
meespeelt. Gasten houden een eigen lobby-avatar. De keuze blijft na verversen of
een serverherstart behouden. De illustraties zijn ingebouwd. Je kunt ook een eigen foto kiezen: PNG, JPG,
WebP of GIF van maximaal 5 MB. De foto wordt vierkant bijgesneden en verkleind
voordat hij wordt verstuurd. De foto is alleen beschikbaar voor leden van je
lobby en wordt bij vervangen, verwijderen van de deelnemer of verlopen van de
lobby opgeruimd.

De spelerslijst tijdens het spel toont dezelfde avatar naast iedere naam,
met initialen als terugval. Ook lokale spelers krijgen initialen; de lokale
HTML-versie blijft zonder externe bestanden werken.

De chat opent zonder het berichtveld te focussen, zodat je op mobiel eerst kunt
lezen. Foto’s, video’s en spraakmemo’s blijven via de lobbychat beschikbaar.

## Bierpullen en uitslag

Opgelegde adtjes verschijnen als bierpullen: een half gevulde pul voor een half
adtje, een volle pul voor een heel adtje. Grotere aantallen worden compact met
een vermenigvuldiger getoond. De tellers in de lobby en naast je naam in het spel tonen cijfers (bijvoorbeeld
`12,5 adtjes`), ook bij grote aantallen.
De bedragen blijven ook voor schermlezers beschikbaar.

De uitslag toont alleen de verliezer, de bierpullen en de knoppen om verder te
gaan. Rondenummer, optelsom en volgende starter staan niet meer in de popup.
De spelregels, strafberekening en startvolgorde blijven gelijk. Een vastgezette
steen heeft een subtiele transparante rode rand, zonder stip of tekst.

## Bediening en scherm

De rolknop, tikken in het speelveld of de spatiebalk laten de losse stenen rollen.
Knoppen en dobbelstenen zijn ook met Tab en Enter/spatie te bedienen. Het spel
past binnen de schermhoogte. Rollen en Doorgeven staan onder elkaar. Als er
niet meer gerold kan worden verdwijnt de rolknop en neemt Doorgeven exact die
plek in; de ruimte voor twee knoppen blijft gereserveerd. Bij veel spelers scrollt alleen het overzicht;
het dashboard heeft een eigen scrollgebied voor lange namenlijsten.

De dobbelsteenogen worden als SVG-cirkels met vaste posities getekend, zodat ze
niet afhangen van CSS-grid binnen een knop (een compatibiliteitsprobleem in
oudere Safari-versies). De groene en rode ogen blijven ook op uitgeschakelde
stenen zichtbaar. Alle zes waarden, rollen en vastzetten zijn gecontroleerd in
Chromium met iPhone X-emulatie (staand en liggend) en op desktop, zowel lokaal
als online. Dit is geen controle op een fysieke iPhone of in Safari.

Voor ontwikkeling: `python3 -m http.server 8000` vanuit deze map.
Cloudtaken gebruiken de bestaande checkout; een extra Git-worktree is niet nodig.


## Profiel op dit apparaat

**Gratis Render:** stel [Supabase-opslag](SUPABASE.md) in om profielen, foto’s
en statistieken bij een deployment te behouden. Alleen omgevingsvariabelen
invullen is niet genoeg: voer ook het meegeleverde SQL-script uit.

Je kunt op de online homepage een profiel maken met een naam en een avatar of
eigen foto. Op hetzelfde apparaat worden die gegevens voortaan ingevuld. Met
**Als gast** speel je zonder statistieken aan het profiel toe te voegen.
**Mijn profiel** toont je afgeronde online rondes, persoonlijke adtjes (inclusief
halve adtjes en tussentijdse straffen) en de datum waarop je het profiel maakte.
Deze statistieken starten bij het aanmaken; eerdere gastpartijen tellen niet mee.

Een willekeurige HttpOnly-cookie herkent dit apparaat maximaal een jaar. De
profielgegevens en statistieken staan in Supabase wanneer die koppeling is
ingesteld, anders in de lokale SQLite-database, buiten de lobbyvervaltijd. Alleen het apparaat met de cookie kan ze bekijken of
aanpassen. Andere spelers zien alleen je lobbynaam, avatar en de lobbyteller.
Statistieken worden samen met de spelstand opgeslagen en tellen niet opnieuw bij
herladen, opnieuw verbinden of een serverherstart. Via **Profiel verwijderen**
verwijder je het profiel en de statistieken; lopende lobbygegevens blijven bestaan.

Dit is geen account voor meerdere apparaten. Bij het wissen van cookies of een
andere browser wordt het profiel niet herkend. Google/Apple-login is nog niet
ingebouwd en vereist OAuth-configuratie bij die diensten. Lokale spellen tellen
niet mee voor profielstatistieken.


## Chat en tellers op mobiel

Het chatveld gebruikt minimaal 16px tekst om automatisch inzoomen door iOS te
voorkomen. Bij typen volgt het chatvenster de zichtbare schermruimte, inclusief
het schermtoetsenbord. De verstuurknop blijft naast het veld staan; inzoomen met
je vingers blijft beschikbaar.

Onder **Mijn profiel → Statistieken resetten** kun je alleen je persoonlijke
adtjes of zowel adtjes als rondes op nul zetten. Naam, foto en lid-sindsdatum
blijven bewaard. Lobbytellers veranderen niet door een persoonlijke reset.
Eerdere rondes en straffen worden na herladen of een serverherstart niet opnieuw
bijgeteld; nieuwe rondes en straffen tellen weer vanaf de reset.

Op het startscherm staan **Lobby maken** en **Meedoen** voorop. De keuze tussen
profiel en gast staat als kleinere bediening eronder; de slogans zijn verwijderd.


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
