const mongoose = require("mongoose");
require("./model-product");

const salesReport = mongoose.Schema({
  productId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Product",
  },
  track: [
    {
      _id: false,
      time: {
        type: Date,
        required: true,
      },
      soldAtMoment: {
        type: Number,
        required: true,
        min: 1,
      },
    },
  ],
});

const SalesReport = mongoose.model("SalesReport", salesReport);
module.exports = SalesReport;
