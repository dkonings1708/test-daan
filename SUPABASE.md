# Profielen bewaren op gratis Render

Render Free vervangt zijn lokale bestanden bij deployments. De browsercookie
blijft bestaan, maar een profiel in alleen de lokale SQLite-database verdwijnt.
Met de volgende koppeling bewaart Supabase de profielen, profielfoto's,
lid-sindsdatum, rondetellers en persoonlijke adtjes. De bestaande apparaatcookie
blijft gelijk. Google/Apple-login is hiervoor niet nodig.

## Eenmalig instellen

1. Maak een Supabase-project. Zet **Enable Data API** aan,
   **Automatically grant API access to new tables** uit en **Enable RLS on new
   tables** aan.
2. Open **SQL Editor → New query**. Kopieer de volledige inhoud van
   [supabase/profiles.sql](supabase/profiles.sql), plak die in de editor en kies
   **Run**. Dit maakt de tabellen, functies en serverrechten aan. Het script mag
   opnieuw worden uitgevoerd; bestaande profielen blijven behouden.
3. Stel bij de **bestaande** Render-webservice onder **Environment** beide
   servervariabelen in:

   | Naam | Waarde |
   | --- | --- |
   | `SUPABASE_URL` | Project URL, zoals `https://jouw-project.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Secret key uit Settings → API Keys, `sb_secret_…` |

   Gebruik hiervoor geen publishable/anon-key. Zet de secret key niet in
   JavaScript, GitHub, screenshots of chatberichten.
4. Deploy de versie met deze koppeling. Gebruik hetzelfde websiteadres zodat
   de browser zijn bestaande profielcookie blijft meesturen.
5. Open `/healthz`: `profileStorage` moet `supabase` zijn. Dit bevestigt de
   gekozen opslagmodus; controleer de verbinding door een profiel op te slaan.
6. Maak een profiel met foto, speel een ronde, deploy dezelfde service opnieuw
   en herlaad in dezelfde browser. Profiel, foto en tellers moeten blijven staan.

Er hoeven geen Storage-buckets of publieke RLS-policies te worden
aangemaakt. Voor inloggen met e-mail stel je ook Auth in zoals hieronder.
De kleine, bijgesneden profielfoto staat in het privéprofiel. De
Render-server beheert toegang via HttpOnly-cookies; de Supabase
secret key blijft uitsluitend op de server. Publieke en ingelogde Supabase-
clientrollen hebben geen lees- of schrijfrechten op de profieltabellen/functies.

## Inloggen op meerdere apparaten

Ook bij een bestaande installatie: voer het **volledige bijgewerkte**
[supabase/profiles.sql](supabase/profiles.sql) opnieuw uit. Dit voegt de
accountkoppeling toe zonder bestaande profielen te verwijderen. De twee
Render-variabelen blijven hetzelfde; er is geen extra API-key nodig.

1. Open **Authentication → Sign In / Providers → Email** (in sommige dashboards
   **Providers → Email**). Schakel e-mail/wachtwoord en nieuwe aanmeldingen in.
   Laat **Confirm email** aan staan.
2. Open **Authentication → URL Configuration**. Vul bij **Site URL** het vaste
   HTTPS-adres van de app in, met een afsluitende `/`. Voeg datzelfde adres toe
   aan **Redirect URLs**, bijvoorbeeld `https://jouw-app.onrender.com/`.
   Gebruik het adres waarop je vrienden daadwerkelijk spelen. Voeg bij een
   eigen domein ook dat adres toe. Gebruik geen brede wildcard.
3. Laat de standaard e-mailtemplates met `{{ .ConfirmationURL }}` intact voor
   bevestiging en wachtwoordherstel. De app verwerkt de standaard e-maillink;
   er is geen PKCE- of SSR-template nodig.
4. Stel onder **Authentication → Email / SMTP Settings** eigen SMTP in voor
   gebruik door vrienden. De ingebouwde Supabase-maildienst is voor testen,
   heeft een lage limiet en verstuurt zonder eigen SMTP alleen naar adressen
   van projectteamleden. Gebruik daarvoor een mailprovider en een geverifieerd
   afzenderadres; nodig spelers niet uit als projectbeheerder. Zie
   [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
5. Open op het **oorspronkelijke apparaat** de app → **Mijn profiel → Account
   koppelen**. Maak een account, bevestig de e-mail en log eerst in diezelfde
   browser in. De bestaande naam, foto, lid-sindsdatum, rondes en adtjes gaan mee.
   Zonder apparaatprofiel kun je direct via **Inloggen → Account maken** starten.
6. Open de app op een tweede apparaat en kies **Inloggen** met hetzelfde
   e-mailadres en wachtwoord. Controleer naam, foto en statistieken. Een later
   aanwezige apparaatgast wordt niet over een bestaand accountprofiel geschreven.
7. Test **Wachtwoord vergeten?**, log opnieuw in en doe een nieuwe Render-deploy.
   Het profiel hoort op beide apparaten behouden te blijven.

Na een bevestigingslink hoort de app weer te openen. Een link die naar localhost
of een verkeerd domein gaat betekent dat de URL-instellingen nog niet kloppen.
Bij te veel e-mails moet je de SMTP- en Auth-limieten controleren; die limieten
staan los van Render.

Supabase Auth bewaart de wachtwoorden. De app verifieert elke accountsessie bij
Supabase en bewaart sessietokens in HttpOnly, SameSite-cookies (Secure op HTTPS).
Verlopen toegang wordt met het refresh-token vernieuwd. E-mailadressen en
sessietokens worden niet met lobbygenoten gedeeld. Gasten en apparaatprofielen
blijven mogelijk. Een account blijft bestaan als je de browsercookies wist;
log daarna opnieuw in. Een apparaatprofiel zonder account werkt alleen zolang
de oorspronkelijke cookie beschikbaar is.

In- en uitloggen kan in de lobby. Tijdens een lopend spel moet je eerst terug
naar de lobby; bij uitloggen of wisselen van account verlaat je die lobby.
**Profiel verwijderen** verwijdert foto en statistieken en logt je uit, maar
verwijdert de Supabase Auth-inloggegevens niet. Opnieuw inloggen maakt dan een
leeg profiel aan. Statistieken resetten blijft afzonderlijk beschikbaar.

## Wat wordt bewaard?

- Supabase: profielen, profielfoto's, gehashte profielidentiteiten, rondetellers,
  adtjes en de registratie waarmee dubbele gebeurtenissen worden voorkomen.
- Render lokaal: lopende lobbies, spelstanden, lobby-avatarbestanden en chatmedia.
  Op gratis Render worden die nog steeds beëindigd/verwijderd bij een deployment.
  Een bewaard profiel kan daarna een nieuwe lobby maken of aan een nieuwe lobby
  meedoen; zijn profielfoto wordt opnieuw als privé-lobby-avatar klaargezet.
- Zonder Supabase-variabelen blijft de bestaande SQLite-modus beschikbaar. Die
  heeft op Render een permanente schijf nodig om profielen te bewaren.

Nog aanwezige SQLite-profielen worden bij gebruik automatisch geïmporteerd,
zonder cookies te vervangen of bestaande Supabase-tellers te overschrijven.
Een eerder verdwenen Render-database kan hiermee niet worden teruggehaald.

## Bij een storing

Als Supabase niet bereikbaar is, toont de app een fout bij profielacties. Een
bestaande cookie wordt dan niet verwijderd en er wordt geen vervangend lokaal
profiel aangemaakt. Controleer in Render Logs de statusmelding:

- `401`: controleer de secret key en Project URL.
- `403` of `404`: voer het volledige SQL-script uit en controleer Data API.
- `5xx` of time-out: controleer of het Supabase-project actief en bereikbaar is.

Het gratis Supabase-plan kan na inactiviteit pauzeren; hervat het project dan
via het Supabase-dashboard. Gastspelen blijft onafhankelijk van profielopslag.

Statistiekupdates krijgen een vast gebeurtenis-ID en worden in Supabase binnen
één transactie verwerkt. Opnieuw proberen telt niet dubbel. De server bewaart
mislukte updates in een lokale wachtrij en probeert opnieuw, ook bij afsluiten.
Als Supabase langdurig uitvalt en Render daarna de lokale bestanden verwijdert,
kunnen nog niet bevestigde updates verloren gaan. Bevestigde cloudgegevens
blijven onafhankelijk van Render bewaard. Het spel gebruikt één serverinstance.

Zie ook [Supabase API keys](https://supabase.com/docs/guides/api/api-keys) en
[Render persistent disks](https://render.com/docs/disks).

## Vrienden en groepen toevoegen

Voer voor deze update het volledige [SQL-script](supabase/profiles.sql) opnieuw
uit. Dit voegt vriendschappen, groepen, beheerders, uitnodigingen en blijvende
groepsscores toe. Bestaande gegevens blijven behouden. Render heeft geen nieuwe
omgevingsvariabelen nodig. Zie [SOCIAL.md](SOCIAL.md) voor gebruik en validatie.

## Uitnodigingen en push

Voer voor lobby-uitnodigingen en push het volledige bijgewerkte SQL-script opnieuw
uit. De bestaande servervariabelen blijven gelijk; pushsleutels worden automatisch
privé in Supabase bewaard. Er is hiervoor geen SMTP nodig. Zie [PUSH.md](PUSH.md).
