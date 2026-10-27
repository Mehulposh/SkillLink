// Minimum base prices in INR. Update these values to change platform-wide price floors.
const CATEGORY_MINIMUM_PRICES = Object.freeze({
  "Plumbing": 250,
  "Electrical": 300,
  "Carpentry": 400,
  "Painting": 500,
  "Masonry": 500,
  "AC & Appliance Repair": 350,
  "Cleaning": 300,
  "Pest Control": 500,
  "Welding": 500,
  "Gardening": 250,
  "Other": 300,
});

function getMinimumPrice(category) {
  if (!category) return null;
  const key = Object.keys(CATEGORY_MINIMUM_PRICES).find(
    (name) => name.toLowerCase() === String(category).trim().toLowerCase()
  );
  return key ? CATEGORY_MINIMUM_PRICES[key] : null;
}

module.exports = { CATEGORY_MINIMUM_PRICES, getMinimumPrice };
