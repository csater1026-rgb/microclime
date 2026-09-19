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
    { id: "lawn", label: "Lawn", min: 4, max: 14, wants: "at least 4 hours of sun" },
    { id: "tomato", label: "Tomato", min: 6, max: 14, wants: "6+ hours of sun" },
    { id: "pepper", label: "Peppers", min: 6, max: 14, wants: "6+ hours of sun" },
    { id: "greens", label: "Lettuce / greens", min: 3, max: 6, wants: "3–6 hours of sun" },
    { id: "herbs", label: "Herbs", min: 4, max: 10, wants: "about 4–6 hours of sun" },
    { id: "flowers", label: "Flowers", min: 4, max: 10, wants: "about 4–6 hours of sun" },
    { id: "shade", label: "Hostas / shade plants", min: 0, max: 4, wants: "under 4 hours of sun" },
    { id: "unsure", label: "Not sure yet", min: 0, max: 14, wants: "any amount" },
  ];

  function advise(plant, sunHours, burn) {
    if (!plant) return "";
    if (plant.id === "unsure") {
      if (sunHours >= 6) return "This is a full-sun bed. Tomatoes, peppers, and most vegetables will be happy here. Skip hostas.";
      if (sunHours >= 4) return "This is partial sun. Herbs, leafy greens, and many flowers fit. Tomatoes will be a stretch.";
      return "This is a shade spot. Hostas, ferns, and woodland plants fit. Don't put tomatoes or peppers here.";
    }
    const fits = sunHours >= plant.min && sunHours <= plant.max;
    if (fits) {
      let text = `<span class="fit-yes">This spot fits.</span> ${plant.label} wants ${plant.wants}. You have ${sunHours} hour${sunHours === 1 ? "" : "s"} of sun today.`;
      if (burn && burn.waterBefore !== null) {
        text += ` Water before the hot stretch, then again after it cools.`;
      }
      return text;
    }
    if (sunHours < plant.min) {
      return `<span class="fit-no">Not enough sun here.</span> ${plant.label} wants ${plant.wants}. This spot only gets ${sunHours} hour${sunHours === 1 ? "" : "s"}. Save a brighter spot or pick a shade-friendlier plant.`;
    }
    return `<span class="fit-no">Too much sun here.</span> ${plant.label} wants ${plant.wants}. This spot gets ${sunHours} hours. A shadier corner will treat it better.`;
  }

  return { assess, PLANTS, advise };
})();
