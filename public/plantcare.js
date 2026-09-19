// Plant/grass burn-risk assessment — built from the same hour-by-hour
// sun-status + heat-risk data Microclime already computes. "Hot sun hours"
// (direct sun during elevated/high heat risk) drive both a severity rating
// and a real watering-time suggestion: water before the hot stretch starts
// (so roots have moisture before the heat hits) and again after it ends —
// standard, real horticultural timing, not an AI guess.

const PlantCare = (() => {
  function assess(rows) {
    const hotSunHours = rows.filter(
      (r) => r.status === "sun" && r.risk && (r.risk.heat === "high" || r.risk.heat === "elevated")
    );

    if (hotSunHours.length === 0) {
      return {
        severity: "none",
        label: "No burn risk today",
        summary: "This spot isn't getting hot, full sun today — no extra watering needed beyond your normal routine.",
        waterBefore: null,
        waterAfter: null,
      };
    }

    const hours = hotSunHours.map((r) => r.h);
    const earliest = Math.min(...hours);
    const latest = Math.max(...hours);
    const anySevere = hotSunHours.some((r) => r.risk.heat === "high");
    const severity = anySevere ? "severe" : hotSunHours.length >= 3 ? "moderate" : "mild";

    const waterBefore = Math.max(0, earliest - 2);
    const waterAfter = Math.min(23, latest + 1);

    const labels = {
      mild: "Mild scorch risk",
      moderate: "Moderate scorch risk",
      severe: "High scorch risk",
    };
    const summaries = {
      mild: `${hotSunHours.length} hour${hotSunHours.length === 1 ? "" : "s"} of hot, full sun today. Leaf edges can dry out a little — nothing serious, but a bit of extra water helps.`,
      moderate: `${hotSunHours.length} hours of hot, full sun today. Plants and grass here are likely to wilt or show real leaf burn without extra water.`,
      severe: `${hotSunHours.length} hours of intense sun and heat today. Real risk of scorched leaves and stressed grass — this spot needs real attention.`,
    };

    return { severity, label: labels[severity], summary: summaries[severity], waterBefore, waterAfter };
  }

  const PLANTS = [
    { id: "lawn", label: "Lawn", min: 4, max: 14, wants: "at least 4 hours of sun", water: "about 1 inch of water a week (roughly half a gallon per sq ft), less if it's rained", frostSensitive: false },
    { id: "tomato", label: "Tomato", min: 6, max: 14, wants: "6+ hours of sun", water: "1-2 inches a week, deep watering 2-3x rather than a little every day", frostSensitive: true },
    { id: "pepper", label: "Peppers", min: 6, max: 14, wants: "6+ hours of sun", water: "about 1-1.5 inches a week, deep and less frequent", frostSensitive: true },
    { id: "greens", label: "Lettuce / greens", min: 3, max: 6, wants: "3–6 hours of sun", water: "frequent light watering, keep the soil consistently moist", frostSensitive: false },
    { id: "herbs", label: "Herbs", min: 4, max: 10, wants: "about 4–6 hours of sun", water: "let the top inch of soil dry between waterings, most herbs hate soggy roots", frostSensitive: true },
    { id: "flowers", label: "Flowers", min: 4, max: 10, wants: "about 4–6 hours of sun", water: "about 1 inch a week, more in containers which dry out faster", frostSensitive: true },
    { id: "shade", label: "Hostas / shade plants", min: 0, max: 4, wants: "under 4 hours of sun", water: "about 1 inch a week, shade spots hold moisture longer so check before watering", frostSensitive: false },
    { id: "unsure", label: "Not sure yet", min: 0, max: 14, wants: "any amount", water: "water deeply but less often once you know what's growing here", frostSensitive: true },
  ];

  // Sunburn severity scaled to whether THIS plant is even in the sun enough
  // to burn — a shade plant sitting in a full-sun spot is what actually
  // burns; a shade plant in a shade spot has no burn risk regardless of
  // what the spot's raw hot-sun-hour count says.
  function burnRiskFor(plant, sunHours, burn) {
    if (!burn || burn.severity === "none" || sunHours < plant.min) return null;
    return burn;
  }

  function advise(plant, sunHours, burn, frostHours, frostRange) {
    if (!plant) return "";
    const bits = [];

    if (plant.id === "unsure") {
      if (sunHours >= 6) bits.push("This is a full-sun bed. Tomatoes, peppers, and most vegetables will be happy here. Skip hostas.");
      else if (sunHours >= 4) bits.push("This is partial sun. Herbs, leafy greens, and many flowers fit. Tomatoes will be a stretch.");
      else bits.push("This is a shade spot. Hostas, ferns, and woodland plants fit. Don't put tomatoes or peppers here.");
    } else {
      const fits = sunHours >= plant.min && sunHours <= plant.max;
      if (fits) {
        bits.push(`<span class="fit-yes">This spot gets enough sun.</span> ${plant.label} wants ${plant.wants}, and you have ${sunHours} hour${sunHours === 1 ? "" : "s"} today.`);
      } else if (sunHours < plant.min) {
        bits.push(`<span class="fit-no">Not enough sun here.</span> ${plant.label} wants ${plant.wants}. This spot only gets ${sunHours} hour${sunHours === 1 ? "" : "s"}.`);
      } else {
        bits.push(`<span class="fit-no">More sun than ${plant.label.toLowerCase()} needs.</span> This spot gets ${sunHours} hours; watch for scorching in the hottest part of the day.`);
      }
    }

    bits.push(`<b>Watering:</b> ${plant.water}${burn && burn.waterBefore !== null ? `, and water before ${formatHourFn(burn.waterBefore)} / after ${formatHourFn(burn.waterAfter)} on hot days like today` : ""}.`);

    const risk = burnRiskFor(plant, sunHours, burn);
    if (risk) {
      bits.push(`<b>Sunburn risk:</b> <span class="fit-no">${risk.label}.</span> ${risk.summary}`);
    } else {
      bits.push(`<b>Sunburn risk:</b> low today.`);
    }

    if (frostHours > 0) {
      if (plant.frostSensitive) {
        bits.push(`<b>Frost risk:</b> <span class="fit-no">Yes — ${frostHours} hour${frostHours === 1 ? "" : "s"} of frost risk tonight${frostRange ? ` (${frostRange})` : ""}.</span> ${plant.label} can be damaged or killed by frost; cover it or bring it in before then.`);
      } else {
        bits.push(`<b>Frost risk:</b> ${frostHours} hour${frostHours === 1 ? "" : "s"} of frost risk tonight${frostRange ? ` (${frostRange})` : ""}, but ${plant.label.toLowerCase()} generally tolerates a light frost.`);
      }
    } else {
      bits.push(`<b>Frost risk:</b> none expected tonight.`);
    }

    return bits.join(" ");
  }

  // formatHour lives in app.js; injected here to avoid a circular <script> load-order dependency.
  let formatHourFn = (h) => `${h}:00`;
  function setFormatHour(fn) { formatHourFn = fn; }

  return { assess, PLANTS, advise, setFormatHour };
})();
