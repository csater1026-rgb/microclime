// Multi-zone classification — the real "clustering" step from Phase 5:
// bucket each saved spot by its actual computed sun-hours into a plain-
// language zone with a genuinely useful planting suggestion, instead of
// treating every spot in the yard as the same.

const Zones = (() => {
  function classify(sunHours) {
    if (sunHours >= 6) {
      return {
        label: "Full sun",
        suggestion: "Good for tomatoes, peppers, squash, and most vegetables — they want 6+ hours of direct sun.",
      };
    }
    if (sunHours >= 3) {
      return {
        label: "Partial sun",
        suggestion: "Good for leafy greens, herbs, and root vegetables — they tolerate 3-6 hours of direct sun.",
      };
    }
    return {
      label: "Mostly shade",
      suggestion: "Tough for food crops. Better suited to shade-tolerant plants like ferns, hostas, or native woodland species.",
    };
  }

  return { classify };
})();
