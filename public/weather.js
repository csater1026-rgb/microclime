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

  return { fetchHourly };
})();
