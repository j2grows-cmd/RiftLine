const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const platformRouting: Record<string, string> = {
  BR1: "americas", LA1: "americas", LA2: "americas", NA1: "americas",
  EUN1: "europe", EUW1: "europe", RU: "europe", TR1: "europe",
  JP1: "asia", KR: "asia",
  OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeSegment(value: string) {
  return encodeURIComponent(value.trim());
}

async function riotGet(url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: { "X-Riot-Token": apiKey, "Accept": "application/json" },
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Riot rejected the request. Check the Riot ID and server.",
      401: "The Riot API key is invalid or expired. Update RIOT_API_KEY in Supabase secrets.",
      403: "Riot denied access to this endpoint. Check the API key permissions.",
      404: "We couldn't find that Riot account or its match history.",
      429: "Riot API rate limit reached. Please wait a moment and try again.",
      500: "Riot's API is temporarily unavailable.",
      503: "Riot's API is temporarily unavailable.",
    };
    const error = new Error(messages[response.status] ?? `Riot API returned HTTP ${response.status}.`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const apiKey = Deno.env.get("RIOT_API_KEY");
  if (!apiKey) return json({ error: "The server is missing its RIOT_API_KEY secret. Add it to Supabase Edge Function secrets." }, 503);

  try {
    const body = await req.json();
    const platform = typeof body.platform === "string" ? body.platform.toUpperCase() : "EUW1";
    const routing = platformRouting[platform];
    if (!routing) return json({ error: "Unsupported server selection." }, 400);

    // Fetch one match and its timeline on demand when a user opens a match report.
    if (typeof body.matchId === "string") {
      const matchId = body.matchId.trim();
      if (!/^[A-Z0-9]+_\\d+$/.test(matchId) || matchId.length > 64) {
        return json({ error: "Invalid match identifier." }, 400);
      }
      const regionHost = `https://${routing}.api.riotgames.com`;
      const match = await riotGet(`${regionHost}/lol/match/v5/matches/${safeSegment(matchId)}`, apiKey);
      let timeline = null;
      try {
        timeline = await riotGet(`${regionHost}/lol/match/v5/matches/${safeSegment(matchId)}/timeline`, apiKey);
      } catch (timelineError) {
        console.warn("Match timeline unavailable:", timelineError);
      }
      return json({ match, timeline, retrievedAt: new Date().toISOString() });
    }

    const riotId = typeof body.riotId === "string" ? body.riotId.trim() : "";
    const matchCount = Math.min(20, Math.max(1, Number.isInteger(body.matchCount) ? body.matchCount : 10));
    const splitAt = riotId.lastIndexOf("#");
    if (splitAt < 1 || splitAt === riotId.length - 1 || riotId.length > 64) {
      return json({ error: "Enter a Riot ID in GameName#TAG format." }, 400);
    }
    const gameName = riotId.slice(0, splitAt);
    const tagLine = riotId.slice(splitAt + 1);
    const account = await riotGet(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${safeSegment(gameName)}/${safeSegment(tagLine)}`,
      apiKey,
    );
    const puuid = account.puuid;
    if (!puuid) return json({ error: "Riot returned an account without a PUUID." }, 502);

    const host = `https://${platform.toLowerCase()}.api.riotgames.com`;
    const [summoner, ranked, matchIds] = await Promise.all([
      riotGet(`${host}/lol/summoner/v4/summoners/by-puuid/${safeSegment(puuid)}`, apiKey),
      riotGet(`${host}/lol/league/v4/entries/by-puuid/${safeSegment(puuid)}`, apiKey),
      riotGet(`https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${safeSegment(puuid)}/ids?start=0&count=${matchCount}`, apiKey),
    ]);

    const matches = await Promise.all(
      (Array.isArray(matchIds) ? matchIds : []).map((id: string) =>
        riotGet(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${safeSegment(id)}`, apiKey)
      ),
    );

    return json({
      account: { ...account, puuid },
      summoner,
      ranked: Array.isArray(ranked) ? ranked : [],
      matches: Array.isArray(matches) ? matches : [],
      platform,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    console.error("riot-analytics error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, status === 429 ? 429 : 502);
  }
});
