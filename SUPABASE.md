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

Er hoeven geen Storage-buckets, publieke RLS-policies of Auth-providers te worden
aangemaakt. De kleine, bijgesneden profielfoto staat in het privéprofiel. De
Render-server beheert toegang via de bestaande HttpOnly-cookie; de Supabase
secret key blijft uitsluitend op de server. Publieke en ingelogde Supabase-
clientrollen hebben geen lees- of schrijfrechten op de profieltabellen/functies.

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
