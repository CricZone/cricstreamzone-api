const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = "https://www.sofascore.com/api/v1";

// Cache
const cache = new Map();

const CACHE_TIME = {
  live: 10 * 1000,
  today: 60 * 1000,
  upcoming: 60 * 1000,
  event: 10 * 1000
};


// ==============================
// SOFASCORE FETCH
// ==============================

async function sofaFetch(path, cacheKey, cacheTime) {

  const now = Date.now();

  if (cache.has(cacheKey)) {

    const item = cache.get(cacheKey);

    if (now - item.time < cacheTime) {
      return item.data;
    }
  }

  const response = await fetch(BASE_URL + path, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Sofascore returned HTTP ${response.status}`
    );
  }

  const data = await response.json();

  cache.set(cacheKey, {
    time: now,
    data
  });

  return data;
}


// ==============================
// TEAM LOGO
// ==============================

function teamLogo(team) {

  if (!team || !team.id) {
    return null;
  }

  return `https://api.sofascore.com/api/v1/team/${team.id}/image`;
}


// ==============================
// FORMAT MATCH
// ==============================

function formatMatch(event) {

  const home = event.homeTeam || {};
  const away = event.awayTeam || {};

  return {

    eventId: event.id,

    sport: event.sport?.name || "Football",

    tournament: {
      id:
        event.tournament?.id ||
        event.uniqueTournament?.id ||
        null,

      name:
        event.tournament?.name ||
        event.uniqueTournament?.name ||
        "",

      country:
        event.tournament?.category?.country?.name ||
        event.category?.country?.name ||
        ""
    },

    home: {
      id: home.id || null,
      name: home.name || "",
      shortName: home.shortName || "",
      slug: home.slug || "",
      logo: teamLogo(home)
    },

    away: {
      id: away.id || null,
      name: away.name || "",
      shortName: away.shortName || "",
      slug: away.slug || "",
      logo: teamLogo(away)
    },

    score: {
      home:
        event.homeScore?.current ??
        event.homeScore?.display ??
        null,

      away:
        event.awayScore?.current ??
        event.awayScore?.display ??
        null,

      period1Home:
        event.homeScore?.period1 ??
        null,

      period1Away:
        event.awayScore?.period1 ??
        null
    },

    status: {
      type: event.status?.type || "",
      description:
        event.status?.description || "",
      code:
        event.status?.code || null
    },

    startTimestamp:
      event.startTimestamp || null,

    startTimeUTC:
      event.startTimestamp
        ? new Date(
            event.startTimestamp * 1000
          ).toISOString()
        : null,

    startTimeBD:
      event.startTimestamp
        ? new Date(
            event.startTimestamp * 1000
          ).toLocaleString(
            "en-GB",
            {
              timeZone: "Asia/Dhaka"
            }
          )
        : null,

    venue:
      event.venue?.name ||
      event.arena?.name ||
      null,

    round:
      event.roundInfo?.name ||
      event.roundInfo?.round ||
      null,

    slug:
      event.slug || "",

    sofascoreUrl:
      event.slug && event.id
        ? `https://www.sofascore.com/event/${event.id}`
        : null,

    stream: null
  };
}


// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {

  res.json({

    success: true,

    name: "CricStreamZone Sports API",

    source: "Sofascore",

    streaming: false,

    endpoints: {

      live:
        "/api/live",

      today:
        "/api/today",

      date:
        "/api/date/YYYY-MM-DD",

      upcoming:
        "/api/upcoming",

      event:
        "/api/event/EVENT_ID",

      incidents:
        "/api/event/EVENT_ID/incidents",

      statistics:
        "/api/event/EVENT_ID/statistics",

      lineup:
        "/api/event/EVENT_ID/lineups"
    }

  });

});


// ==============================
// LIVE
// ==============================

app.get("/api/live", async (req, res) => {

  try {

    const data = await sofaFetch(
      "/sport/football/events/live",
      "football-live",
      CACHE_TIME.live
    );

    const matches =
      (data.events || [])
        .map(formatMatch);

    res.json({

      success: true,

      source: "Sofascore",

      streaming: false,

      type: "live",

      updatedAt:
        new Date().toISOString(),

      count:
        matches.length,

      matches

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


// ==============================
// TODAY
// ==============================

app.get("/api/today", async (req, res) => {

  try {

    const today =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Dhaka"
        }
      ).format(new Date());

    const data = await sofaFetch(

      `/sport/football/scheduled-events/${today}`,

      `today-${today}`,

      CACHE_TIME.today

    );

    const matches =
      (data.events || [])
        .map(formatMatch);

    res.json({

      success: true,

      source: "Sofascore",

      streaming: false,

      date: today,

      count:
        matches.length,

      matches

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


// ==============================
// DATE
// ==============================

app.get("/api/date/:date", async (req, res) => {

  try {

    const date =
      req.params.date;

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Date format must be YYYY-MM-DD"

      });

    }

    const data = await sofaFetch(

      `/sport/football/scheduled-events/${date}`,

      `date-${date}`,

      CACHE_TIME.today

    );

    const matches =
      (data.events || [])
        .map(formatMatch);

    res.json({

      success: true,

      source: "Sofascore",

      streaming: false,

      date,

      count:
        matches.length,

      matches

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


// ==============================
// UPCOMING
// ==============================

app.get("/api/upcoming", async (req, res) => {

  try {

    const result = [];

    const now = new Date();

    for (let i = 0; i < 3; i++) {

      const date =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Dhaka"
          }
        ).format(
          new Date(
            now.getTime() +
            i * 86400000
          )
        );

      const data = await sofaFetch(

        `/sport/football/scheduled-events/${date}`,

        `upcoming-${date}`,

        CACHE_TIME.upcoming

      );

      const matches =
        (data.events || [])
          .map(formatMatch);

      result.push(...matches);
    }

    const currentTime =
      Math.floor(Date.now() / 1000);

    const upcoming =
      result
        .filter(
          match =>
            match.startTimestamp &&
            match.startTimestamp >
              currentTime
        )
        .sort(
          (a, b) =>
            a.startTimestamp -
            b.startTimestamp
        );

    res.json({

      success: true,

      source: "Sofascore",

      streaming: false,

      count:
        upcoming.length,

      matches:
        upcoming

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


// ==============================
// EVENT DETAILS
// ==============================

app.get("/api/event/:id", async (req, res) => {

  try {

    const id =
      req.params.id;

    const data = await sofaFetch(

      `/event/${id}`,

      `event-${id}`,

      CACHE_TIME.event

    );

    res.json({

      success: true,

      source: "Sofascore",

      streaming: false,

      match:
        formatMatch(
          data.event
        )

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


// ==============================
// INCIDENTS
// ==============================

app.get(
  "/api/event/:id/incidents",
  async (req, res) => {

    try {

      const id =
        req.params.id;

      const data = await sofaFetch(

        `/event/${id}/incidents`,

        `incidents-${id}`,

        CACHE_TIME.live

      );

      res.json({

        success: true,

        source: "Sofascore",

        streaming: false,

        eventId: id,

        incidents:
          data.incidents || []

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        error: error.message

      });

    }

  }
);


// ==============================
// STATISTICS
// ==============================

app.get(
  "/api/event/:id/statistics",
  async (req, res) => {

    try {

      const id =
        req.params.id;

      const data = await sofaFetch(

        `/event/${id}/statistics`,

        `statistics-${id}`,

        CACHE_TIME.live

      );

      res.json({

        success: true,

        source: "Sofascore",

        streaming: false,

        eventId: id,

        statistics:
          data.statistics || []

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        error: error.message

      });

    }

  }
);


// ==============================
// LINEUPS
// ==============================

app.get(
  "/api/event/:id/lineups",
  async (req, res) => {

    try {

      const id =
        req.params.id;

      const data = await sofaFetch(

        `/event/${id}/lineups`,

        `lineups-${id}`,

        CACHE_TIME.live

      );

      res.json({

        success: true,

        source: "Sofascore",

        streaming: false,

        eventId: id,

        lineups:
          data || {}

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        error: error.message

      });

    }

  }
);


// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {

  console.log(
    `CricStreamZone API running on port ${PORT}`
  );

});
