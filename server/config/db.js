const mongoose = require("mongoose");
const env = require("./env");
const { Category } = require("../models");
const { DEFAULT_CATEGORIES } = require("../utils/constants");

mongoose.set("strictQuery", true);

module.exports = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Connected to MongoDB");
    if ((await Category.estimatedDocumentCount()) === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ name })));
    }
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  }
};
