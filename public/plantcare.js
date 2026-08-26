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

  return { assess };
})();
