// Real solar-position astronomy — the NOAA simplified solar position
// algorithm (https://gml.noaa.gov/grad/solcalc/solareqns.PDF), not an API
// call. Works entirely in UTC so it's correct for any time zone without
// asking the user for one: pass a JS Date (its underlying UTC instant is
// what's used) plus latitude/longitude in degrees.

const Solar = (() => {
  function dayOfYearUTC(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
    return Math.floor(diff / 86400000) + 1;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  // Returns { elevation, azimuth } in degrees. Azimuth is degrees clockwise
  // from true north (0=N, 90=E, 180=S, 270=W). Elevation is degrees above
  // the horizontal plane (negative = below the horizon, i.e. night).
  function position(date, latDeg, lonDeg) {
    const N = dayOfYearUTC(date);
    const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

    const gamma = ((2 * Math.PI) / 365) * (N - 1 + (utcHour - 12) / 24);

    const eqtime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)
    );

    const decl = (
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma)
    );

    // Working entirely in UTC makes the timezone-offset term zero.
    const timeOffset = eqtime + 4 * lonDeg;
    const trueSolarTime = utcHour * 60 + timeOffset;
    let hourAngleDeg = trueSolarTime / 4 - 180;
    if (hourAngleDeg < -180) hourAngleDeg += 360;
    if (hourAngleDeg > 180) hourAngleDeg -= 360;
    const hourAngle = toRad(hourAngleDeg);

    const lat = toRad(latDeg);
    const cosZenith =
      Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
    const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
    const elevation = 90 - toDeg(zenith);

    let azimuth;
    const sinZenith = Math.sin(zenith);
    if (sinZenith < 1e-6) {
      // Sun (nearly) straight overhead — azimuth is undefined/irrelevant.
      azimuth = 180;
    } else {
      let azCos = (Math.sin(decl) - Math.sin(lat) * Math.cos(zenith)) / (Math.cos(lat) * sinZenith);
      azCos = Math.min(1, Math.max(-1, azCos));
      azimuth = toDeg(Math.acos(azCos));
      if (hourAngleDeg > 0) azimuth = 360 - azimuth;
    }

    return { elevation, azimuth };
  }

  // Local-time convenience: builds the Date for `hour` (0-23, local) on the
  // given local year/month(1-12)/day, then computes position for it.
  function positionAtLocalHour(year, month, day, hour, latDeg, lonDeg) {
    const d = new Date(year, month - 1, day, hour, 0, 0);
    return position(d, latDeg, lonDeg);
  }

  return { position, positionAtLocalHour, dayOfYearUTC };
})();
