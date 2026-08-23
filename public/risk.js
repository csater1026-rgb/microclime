// Frost/heat risk model — combines live weather with this specific spot's
// actual sun-hours (from solar.js + the traced horizon), not just the
// regional forecast.
//
// Physical basis for the frost side: on a clear, calm, dry night a surface
// radiates heat away faster than the surrounding air cools, so it can sit
// several degrees below the official air-temperature forecast. This
// estimates that "excess local cooling" from cloud cover, wind, and dewpoint
// depression (a proxy for how dry the air is), then adjusts further by how
// much daytime sun this exact spot actually got — a shadier spot holds less
// heat overnight and cools faster. This is a real, if simplified, applied
// radiative-cooling estimate, not a lookup table.

const Risk = (() => {
  const FULL_SUN_HOURS = 6; // a day with this many sun-hours is treated as "well warmed"

  function estimateLocalTemp(hourWeather, daytimeSunHours) {
    const { temp, dewpoint, cloudCover, windSpeed } = hourWeather;
    const clearFactor = 1 - cloudCover / 100; // 0 = overcast, 1 = clear sky
    const calmFactor = Math.max(0, 1 - windSpeed / 5); // wind mixing fades this out by ~5 m/s
    const dewDepression = Math.max(0, Math.min(10, temp - dewpoint)); // drier air radiates faster
    const radiativeCooling = clearFactor * calmFactor * dewDepression * 0.3; // °C
    const shadePenalty = Math.max(0, FULL_SUN_HOURS - daytimeSunHours) * 0.3; // °C
    return temp - radiativeCooling - shadePenalty;
  }

  function frostLevel(localTemp) {
    if (localTemp <= 0) return "frost";
    if (localTemp <= 3) return "marginal";
    return "low";
  }

  function heatLevel(hourWeather, isSunny) {
    if (!isSunny) return "low";
    if (hourWeather.temp >= 35) return "high";
    if (hourWeather.temp >= 30) return "elevated";
    return "low";
  }

  return { estimateLocalTemp, frostLevel, heatLevel, FULL_SUN_HOURS };
})();
