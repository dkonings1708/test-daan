# Lobby-uitnodigingen en pushmeldingen

## Bestaande installatie bijwerken

1. Voer het **hele bijgewerkte** [supabase/profiles.sql](supabase/profiles.sql)
   opnieuw uit in Supabase → SQL Editor. Bestaande profielen, vrienden en groepen
   blijven behouden. Dit voegt uitnodigingen, pushabonnementen en de privéconfiguratie
   voor push toe. De Data API moet ingeschakeld blijven.
2. Deploy de nieuwe versie naar de bestaande Render-service. De bestaande
   `SUPABASE_URL` en `SUPABASE_SECRET_KEY` blijven gelijk. Er zijn **geen nieuwe
   geheime Render-variabelen**, e-mailinstellingen of betaalde pushdiensten nodig.
3. Open de app op het vaste HTTPS-adres, log in en open **🔔 Notificaties**.
   Kies **Pushmeldingen aanzetten** en geef toestemming in de browser.
4. Laat een geaccepteerde vriend vanuit een lobby op **Vriend uitnodigen** tikken.
   Selecteer de ontvanger en verstuur. Controleer de uitnodiging in de app en
   test daarna met de app gesloten of naar de achtergrond.

De eerste pushinstelling maakt automatisch een VAPID-sleutelpaar aan in de
privétabel `dmc_push_config`. Dat blijft gelijk bij Render-deployments. De
private sleutel blijft op de server en in Supabase; alleen de publieke sleutel
wordt aan de browser gegeven. Verwijder deze configuratie niet bij een gewone
release. Als het sleutelpaar ooit bewust wordt vervangen, moeten apparaten push
opnieuw inschakelen. Optioneel kun je `VAPID_SUBJECT` als servervariabele instellen
op een `mailto:`-adres of HTTPS-contactpagina. Standaard wordt de projectpagina
gebruikt. Stuur private sleutels of pushabonnementen niet in chat of screenshots.

## Installeren en de eerste pushvraag

Op het openingsscherm en in het menu staat **Zet op beginscherm**. Waar de browser
een installatievenster ondersteunt, opent de knop dat venster. Op iPhone toont
de app de stappen via Safari → Deel → Zet op beginscherm. Na installatie verdwijnt
de knop wanneer je de app vanaf het beginscherm opent.

Een ingelogde speler krijgt in de geïnstalleerde app eenmalig de vraag om
pushmeldingen aan te zetten, als de browser push ondersteunt en nog geen keuze
voor toestemming is gemaakt. De systeemvraag verschijnt pas na **Meldingen
aanzetten**. **Later**, het kruisje en Escape onthouden de keuze op dit apparaat;
de vraag verschijnt niet bij iedere start. Je kunt push daarna altijd beheren
via **🔔 Notificaties**. Tijdens een spel of bovenop een ander venster verschijnt
de vraag niet. Gasten krijgen geen pushvraag, omdat uitnodigingen aan accounts
zijn gekoppeld.

Nieuwe pushmeldingen hebben de titel **DMC mexx - Uitnodiging voor lobby 🍺**.
Deze tekstwijziging vereist geen nieuwe SQL-migratie.

## Telefoons en browsers

- **iPhone/iPad:** iOS/iPadOS **16.4 of nieuwer**. Open de app via Safari, kies
  **Deel → Zet op beginscherm**, open die beginschermapp en schakel daar push in.
  Een gewoon Safari-tabblad kan op iPhone geen webpush ontvangen.
- **Android en desktop:** ondersteunde Chrome-, Edge-, Firefox- en Safari-versies
  kunnen via HTTPS push ontvangen. De app toont de optie alleen als de browser
  de benodigde functies ondersteunt.
- Toestemming wordt uitsluitend na het aantikken van de inschakelknop gevraagd.
  Bij geblokkeerde meldingen moet je de browser-/systeeminstellingen aanpassen.
- Zonder push blijven uitnodigingen in de app beschikbaar. De bel toont het
  aantal openstaande uitnodigingen. Een zichtbare app controleert iedere tien
  seconden en bij terugkeren naar de app op nieuwe uitnodigingen.

Push verschijnt via de browser en het besturingssysteem. Niet storen, energiebesparing,
internetverbinding en instellingen van het toestel kunnen bezorging vertragen of
verbergen. De automatische tests simuleren toestemming en de pushdienst; een
werkelijke melding op jouw telefoon moet na de installatie worden gecontroleerd.

## Uitnodigen en meedoen

**Vriend uitnodigen** staat in de spelerslijst van een lobby wanneer je met je
accountprofiel speelt. Kies maximaal tien geaccepteerde vrienden. Wie al in de
lobby zit kan niet opnieuw worden toegevoegd. Voor een groepslobby moeten beide
accounts lid zijn van de groep; de uitnodiging omzeilt geen groepsgoedkeuring.

De ontvanger kiest bij de bel **Meedoen** of **Afwijzen**. Meedoen gebruikt diens
eigen naam, avatar en profielstatistieken. Een ontvangen push opent dezelfde
uitnodiging; zonder login vraagt de app eerst om het juiste account. De link
voegt nooit automatisch iemand toe zonder op Meedoen te tikken.

Bij overstappen vanuit een andere lobby vraagt de app om bevestiging. Een lopend
spel op het ontvangende apparaat wordt niet onderbroken. Een volle of al gestarte
lobby is niet toegankelijk via een uitnodiging. Na een mislukte poging blijft
de uitnodiging beschikbaar zolang deze geldig is.

Uitnodigingen gelden één uur. Herhaald versturen binnen één minuut geeft geen
extra push. Er gelden verzendlimieten tegen spam. De inbox toont de vijftig
nieuwste openstaande uitnodigingen. Afgehandelde en verlopen records worden
na zeven dagen opgeruimd bij een volgende inboxcontrole.

## Opslag, uitloggen en privacy

De drie nieuwe tabellen hebben RLS en geen rechten voor publieke of ingelogde
Supabase-clientrollen. Alleen de Render-server kan de meldingsfuncties aanroepen.
De server controleert de accountsessie, vriendschap, lobbydeelname, groepstoegang,
beurt-/spelstatus en capaciteit. Uitnodigingen zijn alleen voor de beoogde ontvanger.
Een opgeslagen lobby-identiteit voorkomt dat een oude uitnodiging toegang geeft
tot een nieuwe lobby met toevallig dezelfde code.

Push staat per apparaat aan, met maximaal tien apparaten per account. **Push op
dit apparaat uitzetten** verwijdert de koppeling en het lokale browserabonnement.
Uitloggen of van account wisselen verwijdert de koppeling van dit apparaat;
andere apparaten blijven beschikbaar. Een browserabonnement wordt niet zomaar
aan een ander account op een ander apparaat overgedragen.

De pushwachtrij staat in Supabase. De server verwerkt deze op de achtergrond,
probeert tijdelijke fouten maximaal drie keer en verwijdert verlopen/ongeldige
browserabonnementen na een 404/410 van de pushdienst. Gesloten of gestarte lobbies
krijgen geen nieuwe push vanuit de wachtrij. Ook als push niet lukt blijft de
uitnodiging in de app beschikbaar.

De service worker gebruikt **geen offline cache** voor spelbestanden, API's of
accounts. Push verandert niets aan de bestaande profielopslag of release-updates.
Op gratis Render blijven lopende partijen en lobbycodes tijdelijk; een uitnodiging
voor een verdwenen lobby toont dat deze gesloten is. Render kan bij het openen
van een slapende gratis dienst extra opstarttijd nodig hebben.

## Validatie

`npm test` bevat tests voor toegestane pushdiensten, sleutels, de daadwerkelijke
versleutelde Web Push-aanvraag en de service worker. Deze tests versturen geen
berichten naar externe ontvangers.

De integratietests draaien met de echte PostgreSQL-migratie en een lokale Auth-
en pushfixture: `DMC_TEST_POSTGRES=<testcontainer> npm test`. Ze controleren
ontvangerprivacy, toestemming, dubbel versturen, herhaald accepteren, volle en
gestarte lobbies, groepsrechten, uitloggen per apparaat, verlopen endpoints,
uitnodigingen na een deployment en blijvende pushsleutels. Browsercontroles
omvatten desktop en iPhone-emulatie, de toestemmingsknop, echte service-worker-
registratie met een gesimuleerd pushabonnement, en inloggen via een uitnodiging.
