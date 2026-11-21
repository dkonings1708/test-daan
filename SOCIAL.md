# Vrienden, groepen en samen op één apparaat

## Installatie op de bestaande Render/Supabase-app

Voer het **volledige bijgewerkte** [supabase/profiles.sql](supabase/profiles.sql)
opnieuw uit in Supabase → SQL Editor. Het script is herhaalbaar en behoudt
bestaande accounts, profielen en statistieken. Er komen drie privé-tabellen en
twee functies bij. Bestaande `SUPABASE_URL` en `SUPABASE_SECRET_KEY` blijven gelijk;
er zijn geen nieuwe sleutels, buckets of publieke policies nodig. De Data API
blijft ingeschakeld. Alle nieuwe tabellen hebben RLS; alleen de Render-server
heeft toegang. E-maillogin blijft de bestaande [Auth-configuratie](SUPABASE.md)
gebruiken.

## Vrienden en profielkaarten

Tik op een naam/avatar in de lobby, of op een avatar bij de dobbeltafel, om de
profielkaart te openen. Die toont naam, foto, lid-sindsdatum, rondes, persoonlijke
adtjes en clan tags. E-mailadres, Supabase-identiteit, cookies en profielhashes
worden nooit met andere spelers gedeeld. Een gastkaart toont alleen de
lobbygegevens. Apparaatprofielen kunnen worden bekeken, maar vriendschappen
en groepslidmaatschappen vereisen een ingelogd account.

Via **Vrienden & groepen → Vrienden** kun je ontvangen verzoeken accepteren of
afwijzen, verzonden verzoeken intrekken en vrienden verwijderen. Een verzoek
wordt pas een vriendschap na acceptatie door de ontvanger. De knop toont het
aantal ontvangen verzoeken; tijdens gebruik wordt dit periodiek bijgewerkt.
De app verstuurt hiervoor geen e-mails of pushmeldingen.

## Een vaste groep

Maak onder **Vrienden & groepen → Groepen** een groep met een naam en een unieke
clan tag van 2–6 letters/cijfers. Je kunt van meerdere groepen lid zijn; de tags
staan bij je profiel. In een groepslobby staat de tag van die groep als badge achter de spelersnaam.

- **Openbaar:** accounts kunnen direct lid worden.
- **Op aanvraag:** een groepsbeheerder moet de aanvraag goedkeuren. Deze groepen
  zijn ook vindbaar; de ledenlijst en het klassement zijn alleen voor leden.
- Beheerders kunnen de naam en toegang wijzigen, leden verwijderen en meerdere
  beheerders aanwijzen. De laatste beheerder kan zichzelf niet verwijderen of
  degraderen zonder een opvolger aan te wijzen.
- Een beheerder kan een uitnodigingslink maken. Die geeft een ingelogd account
  direct toegang, ook tot een groep op aanvraag. Een nieuwe link maakt eerdere
  links ongeldig. De database bewaart uitsluitend de hash van de uitnodiging.
- Bij verwijderen van het accountprofiel van de enige beheerder krijgt een
  ander bestaand lid automatisch het beheer. Heeft de groep geen andere leden,
  dan wordt die lege groep verwijderd.

**Open groepslobby** brengt leden bij dezelfde actieve speeltafel. De maker van
die speeltafel en de aanwezige groepsbeheerders kunnen de partij beheren.
Een account kan niet tweemaal aan dezelfde tafel meespelen. Nieuwe spelers kunnen
alleen vóór het starten aansluiten; bestaande deelnemers kunnen met hun account
hervatten. De laatst opgeslagen groepsspelregels worden hergebruikt.

De groep, uitnodiging, lidmaatschappen, rollen, spelregels en stand blijven in
Supabase bewaard, ook na een Render-release of als iedereen de lobby verlaat.
De vaste groepslink blijft werken. Op gratis Render blijven **lopende partijen,
lobbycodes en chatmedia** afhankelijk van de tijdelijke appopslag. Na een
vervangende deployment open je vanuit dezelfde groep een nieuwe speeltafel;
je groep en eerdere stand blijven bestaan. De app gebruikt één serverinstance.

## Klassement en kroon

Het groepsklassement telt de adtjes die tijdens spellen **in die groep** aan
accountleden zijn uitgedeeld. Dat omvat rondeverlies, Mexx-verhogingen en extra
halve adtjes. Adtjes uit andere lobbies worden niet toegevoegd. De stand toont
hele en halve aantallen; de meeste adtjes staan bovenaan. De hoogste positieve
stand krijgt een kroon en gouden avatarrand in het klassement, de groepslobby
en het spel. Bij een gelijke hoogste stand krijgen die spelers allebei de kroon.
Bij alleen nullen heeft niemand een kroon.

Persoonlijke tellers resetten wijzigt het groepsklassement niet. Keer voor het verlaten of verwijderen van een meespelend lid eerst terug naar
de lobby. Groepsscores
blijven bij verlaten/verwijderen van een lid opgeslagen en komen terug bij
opnieuw toetreden; alleen huidige leden staan in de lijst. Het definitief
verwijderen van een profiel verwijdert ook diens groepsscores. Herhaalde
spelgebeurtenissen worden met hetzelfde event-ID niet dubbel geteld.

## Extra speler op je telefoon

In iedere online lobby heeft elke deelnemer **＋ Speler toevoegen**. Kies een
lokale gast met naam/avatar of laat iemand met een bestaand account zelf
inloggen. Die tweede login verandert jouw eigen login niet. Het wachtwoord en
de tijdelijke tweede accountsessie worden niet opgeslagen; die sessie wordt
na controle bij Supabase uitgelogd. Bij groepsspellen moet een extra account
ook lid zijn van de groep.

Iedere speler heeft een eigen plek in de volgorde en eigen straffen. Het apparaat
kan alleen gooien, vastzetten en doorgeven tijdens de beurt van zichzelf of
zijn eigen extra spelers. Ook schudden werkt voor deze beurten. Accountspelers
bouwen hun eigen profiel- en groepsstatistieken op. Gasten tellen mee in de
partij, maar niet in het blijvende groepsklassement. Je kunt maximaal negen
extra spelers bedienen, binnen de bestaande limiet van dertig lobbyspelers.

Extra spelers kunnen vóór het starten door hun eigen apparaat of een beheerder
worden verwijderd. Als de hoofdspeler de lobby verlaat of wordt verwijderd,
verdwijnen ook diens extra spelers. Een extra speler kan geen afzonderlijke
lobbybeheerder worden; diens bediening hoort bij de hoofdspeler. Handmatige
volgorde, random teams, chat en bestaande spelregels blijven beschikbaar.

## Validatie

`npm test` test de bestaande functionaliteit en extra spelers met lokale
Auth/opslagfixtures. De aanvullende integratietest gebruikt de **echte**
PostgreSQL-tabellen en functies, met uitsluitend een lokale Auth-fixture:

1. Start een tijdelijke PostgreSQL-container met rollen `anon`, `authenticated`
   en `service_role BYPASSRLS`; voer het volledige SQL-script uit.
2. Gebruik `DMC_TEST_POSTGRES=<containernaam> node --test test/social.test.mjs`.
   Hiervoor moeten Docker CLI, Node 24 en de testcontainer beschikbaar zijn.

De integratietest controleert toestemming, uitnodigingen, beheerderswissels,
profielprivacy, daadwerkelijke groepsrondes, idempotentie, onafhankelijk resetten
en herstel met een lege Render-datamap. De browsercontroles omvatten desktop en
iPhone X-emulatie, gedeelde bediening, vrienden, profielkaarten en kronen.

## Mobiele bediening en formulieren

Op mobiel zitten profiel, vrienden/groepen en lokaal spelen achter één menu.
Ben je ingelogd, dan is je avatar de menuknop; anders verschijnt een hamburger.
Account maken en wachtwoordherstel vragen tweemaal hetzelfde wachtwoord; gewoon
inloggen vraagt dit eenmaal. De accountteller toont adtjes numeriek, ook halve.
Deze vormgevingsupdate vraagt geen aanvullende Supabase-migratie.
