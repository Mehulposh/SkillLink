const router = require("express").Router();
const { Category } = require("../models");
const { asyncHandler } = require("../utils/helpers");
router.get("/", asyncHandler(async (req, res) => {
  const categories = await Category.find({ active: true }).sort({ name: 1 }).select("name").lean();
  res.send({ success: true, categories });
}));
module.exports = router;
