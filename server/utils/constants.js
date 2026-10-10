const STATUS = ["pending", "assigned", "in-progress", "completed", "cancelled", "disputed"];
// Allowed status transitions (enforced server-side)
const TRANSITIONS = {
  pending: ["assigned", "cancelled"],
  assigned: ["in-progress", "completed", "cancelled", "pending", "disputed"],
  "in-progress": ["completed", "cancelled", "disputed"],
  completed: ["disputed"],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};
const WORKER_CAN_SET = ["in-progress", "completed"];
const DEFAULT_CATEGORIES = [
  "Plumbing", "Electrical", "Carpentry", "Painting", "Masonry",
  "AC & Appliance Repair", "Cleaning", "Pest Control", "Welding", "Gardening", "Other",
];
const ID_DOC_TYPES = ["aadhaar", "pan", "driving_license", "voter_id", "passport"];
module.exports = { STATUS, TRANSITIONS, WORKER_CAN_SET, DEFAULT_CATEGORIES, ID_DOC_TYPES };
