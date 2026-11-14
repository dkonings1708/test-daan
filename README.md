# DMC mexx

Nederlandstalig dobbelspel in DMC-rood, groen, wit en zwart, met lokale en online
multiplayer-modus. De lokale versie staat volledig in `index.html` en heeft geen
installatie of accounts nodig. Online multiplayer gebruikt de meegeleverde
Node.js-server en een lobbycode. De lobbychat deelt tekst, foto’s, video’s en
spraakmemo’s met de deelnemers, ook tijdens het spel. Zie `ONLINE.md` voor starten en publiceren. Open het bestand in een browser met JavaScript ingeschakeld;
een bestandsvoorbeeld in een berichtenapp voert het spel mogelijk niet uit.

## Soundboard

Rechtsboven staat een uitklapbaar Soundboard, op het startdashboard en tijdens
het spel. De knop SCHEIKUNDEEEE speelt eerst een Nederlandse gesproken kreet en
daarná een laag, onregelmatig borrelend potion-geluid. Er zijn geen hoge muzikale
noten of belletjes. Een Nederlandse browserstem wordt gebruikt wanneer die
beschikbaar is; een ingebouwde synthetische Nederlandse stem werkt als reserve,
ook zonder internet. Er is geen microfoon of los audiobestand nodig.

Volume en Stop staan in hetzelfde paneel. Opnieuw klikken begint weer bij de
kreet. Stop annuleert zowel de stem als het borrelen, ook als de stem nog niet is
begonnen. Het paneel sluit via de sluitknop, Escape of een klik erbuiten.
Afspelen en het paneel bedienen veranderen geen worpen, scores of speelvolgorde.

### Zelf inspreken

Het voorbeeldvenster van de chat kan microfoontoegang blokkeren. Open het
HTML-bestand rechtstreeks in Chrome buiten de chat, of gebruik je HTTPS-website.
De app controleert deze beperking vóór het aanvragen van de microfoon en geeft
een gerichte melding in plaats van tijdelijk een opnamestatus te tonen.

Open Soundboard > Eigen tekst inspreken. Opnemen vraagt microfoontoestemming;
Stop opname rondt de opname af, of de opname stopt na acht seconden vanzelf.
Via Terugluisteren hoor je alleen je eigen opname. Gebruik mijn opname laat de
soundboardknop jouw stem spelen in plaats van de standaardkreet, gevolgd door
het borrelen. Je kunt de opname uitzetten, vervangen of verwijderen.

De opname wordt lokaal als mono-WAV bewaard. Download spel met instellingen
neemt de opname mee in het zelfstandige spelbestand. Opnemen gebruikt geen
spraakherkenning en stuurt de opname niet naar een server. Stoppen, annuleren,
het soundboard sluiten of de pagina verlaten maakt de microfoon vrij. Opnemen
werkt in ondersteunde browsers via HTTPS (zoals Netlify) of een ondersteund
lokaal bestand. Zonder microfoontoestemming blijft de rest van het spel werken.

## Instellingen

Het startdashboard heeft de tabbladen Spel instellen en Instellingen.
Het logo staat alleen onder Instellingen. Kies daar een PNG-, JPG- of WebP-bestand.

De DMC-ledenlijst bevat standaard Q, Jordan, Lon, Siem, Sef, Robin, Dennis, Ties,
Gijs, Kay en Sem. Onder Instellingen kun je namen aanpassen, toevoegen en
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

Klik op Instellingen opslaan om de ledenlijst, regels en het logo lokaal in je
browser te bewaren. Als de browser opslag blokkeert blijven de instellingen
actief voor de sessie. Download spel met instellingen maakt een zelfstandige
HTML-kopie met alle instellingen en het originele logo erin. Zo kun je ze ook
naar een andere browser of computer meenemen, zonder externe bestanden.

## Extra tafelregels

Drie nieuwe schakelaars in Instellingen staan standaard uit en worden met de
andere instellingen opgeslagen en geëxporteerd:

- Van tafel gooien: elke normale worp heeft 5% kans. Alleen de losse stenen
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
- Gebruik de pijltjes om spelers, teams en teamleden te verplaatsen.
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
bij gelijkspel verliezen alle laagst geëindigde spelers. De eerste van hen in
de speelvolgorde begint de nieuwe ronde. Bij Nouri-43 is de werper altijd de
verliezer, ook als anderen nog niet hebben gegooid. In teammodus toont de
uitslag de verliezende teamnaam; de tekst eronder noemt de speler met de laagste
score of de Nouri-43. Bij meerdere verliezers binnen één team wordt die teamnaam
maar één keer genoemd.

De straf per verliezer (of verliezend team) is een half adtje als basis, plus
een half adtje voor
elke Mexx (21) in deze ronde. Alle worpen tellen daarvoor mee, inclusief eerdere
worpen van een beurt. Nul Mexx is een half adtje; één is 1 adtje; twee is 1,5 adtjes.
De teller begint elke ronde op nul en gebruikt geen sterren uit eerdere rondes.

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
of vernieuwen bewaard. Opgeslagen leden, regels en logo blijven wel beschikbaar
via browseropslag of de gedownloade kopie met instellingen.

## Bediening en scherm

De rolknop, tikken in het speelveld of de spatiebalk laten de losse stenen rollen.
Knoppen en dobbelstenen zijn ook met Tab en Enter/spatie te bedienen. Het spel
past binnen de schermhoogte. Rollen en Doorgeven staan onder elkaar. Als er
niet meer gerold kan worden verdwijnt de rolknop en neemt Doorgeven exact die
plek in; de ruimte voor twee knoppen blijft gereserveerd. Bij veel spelers scrollt alleen het overzicht;
het dashboard heeft een eigen scrollgebied voor lange namenlijsten.

Voor ontwikkeling: `python3 -m http.server 8000` vanuit deze map.
Cloudtaken gebruiken de bestaande checkout; een extra Git-worktree is niet nodig.
