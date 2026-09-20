// Live weather data — Open-Meteo's free forecast API, no key required.
// Only covers the near-term forecast window (not arbitrary past/future
// dates), which is fine for "should I worry about tonight."

const Weather = (() => {
  const BASE_URL = "https://api.open-meteo.com/v1/forecast";

  async function fetchHourly(lat, lon, dateISO) {
    const url =
      `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,dewpoint_2m,cloudcover,windspeed_10m` +
      `&start_date=${dateISO}&end_date=${dateISO}` +
      `&timezone=auto&temperature_unit=celsius&windspeed_unit=ms`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    const data = await res.json();
    const h = data.hourly;
    if (!h || !h.time || h.time.length === 0) {
      throw new Error("No forecast data for that date");
    }

    // Open-Meteo returns local-time strings like "2026-06-21T14:00" with no
    // offset — read the hour directly from the string instead of feeding it
    // through Date() to avoid the browser reinterpreting it in its own zone.
    return h.time.map((t, i) => ({
      hour: parseInt(t.slice(11, 13), 10),
      temp: h.temperature_2m[i],
      dewpoint: h.dewpoint_2m[i],
      cloudCover: h.cloudcover[i], // percent, 0-100
      windSpeed: h.windspeed_10m[i], // m/s
    }));
  }

  // Same endpoint, a real multi-day range in one request (Open-Meteo's
  // free forecast only covers the near-term window, so this only works for
  // the next ~16 days — fine for a week-ahead projection, not a year one).
  // Returns hours grouped by their own calendar date.
  async function fetchRange(lat, lon, startISO, endISO) {
    const url =
      `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,dewpoint_2m,cloudcover,windspeed_10m` +
      `&start_date=${startISO}&end_date=${endISO}` +
      `&timezone=auto&temperature_unit=celsius&windspeed_unit=ms`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    const data = await res.json();
    const h = data.hourly;
    if (!h || !h.time || h.time.length === 0) {
      throw new Error("No forecast data for that range");
    }

    const byDate = new Map();
    for (let i = 0; i < h.time.length; i++) {
      const date = h.time[i].slice(0, 10);
      const hour = parseInt(h.time[i].slice(11, 13), 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push({
        hour,
        temp: h.temperature_2m[i],
        dewpoint: h.dewpoint_2m[i],
        cloudCover: h.cloudcover[i],
        windSpeed: h.windspeed_10m[i],
      });
    }
    return byDate; // Map<"YYYY-MM-DD", hourEntry[]>
  }

  return { fetchHourly, fetchRange };
})();
