# Riftline — League of Legends Analytics

Riftline is a Riot API-powered player analytics dashboard. Search public League of Legends accounts using a Riot ID (`GameName#TAG`) and a platform, then inspect ranked status, recent match performance and champion trends.

## Stack

- Static HTML/CSS/JavaScript frontend
- Supabase Edge Function as a secure Riot API proxy
- Riot Account-V1, Summoner-V4, League-V4 and Match-V5
- Data Dragon for champion and profile-icon artwork

## Deploy

### 1. Configure the Riot API key

Create or sign in to a Riot Games developer account at https://developer.riotgames.com/ and generate a development API key.

Set it as a Supabase Edge Function secret. **Never put the Riot API key in index.html, frontend JavaScript, GitHub, or any public repository.**

```sh
supabase secrets set RIOT_API_KEY=RGAPI-your-key
```

Development keys expire regularly. Replace the secret when Riot rotates or expires the key.

### 2. Deploy the Edge Function

From the project root, link the Supabase project and deploy:

```sh
supabase login
supabase link --project-ref mswdpouenugeprkatkfw
supabase functions deploy riot-analytics
```

The function is intentionally callable by the public dashboard and validates request inputs. The Riot key remains server-side. For a public production launch, add rate limiting and abuse monitoring (for example, a per-IP limit at an API gateway or a server-side rate-limit store) before sharing the site widely.

### 3. Publish the frontend

The frontend is the root `index.html`. Enable GitHub Pages for the deployment branch or publish the file through your preferred static host. The dashboard calls:

`https://mswdpouenugeprkatkfw.supabase.co/functions/v1/riot-analytics`

The Supabase publishable key in the frontend is designed for public client use; it is not a substitute for server-side authorization or rate limiting.

## Supported platform routing

EUW1, EUN1, NA1, KR, BR1, JP1, LA1, LA2, OC1, TR1, RU, PH2, SG2, TH2, TW2 and VN2.

Riot ID lookup and Match-V5 use regional routing clusters; Summoner-V4 and League-V4 use platform routing.

## Current dashboard

- Riot ID account search
- Summoner level and profile icon
- Solo/Duo and Flex ranked entries
- Ranked win rate and record
- Recent-match KDA and win rate
- Top champions from the recent match sample
- Recent match list with champion, role, score and result

## Notes

- Match history is limited to the latest 10 games in this first milestone.
- Some accounts may have no ranked entries or no recent match data.
- Riot API rate limits apply. A 429 response is surfaced to the user.
- Riot API policies and key requirements: https://developer.riotgames.com/docs/lol
- Riftline is an independent community project and is not endorsed by Riot Games.
