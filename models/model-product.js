const mongoose = require("mongoose");
require("./model-auth-user");
require("./model-category");
const productModels = mongoose.Schema(
  {
    name_product: {
      type: String,
      maxlength: [250, "panjang nama harus antara 5 - 250 karakter"],
      minlength: [5, "panjang nama harus antara 5 - 250 karakter"],
      required: [true, "name_product harus di isi"],
    },
    price: {
      type: Number,
      required: [true, "price harus di isi"],
      min: [3, "price yang harus diisi setidaknya 100"],
    },
    total_price: {
      type: Number,
    },
    diskon: {
      type: Number,
      required: false,
    },
    description: {
      type: String,
      required: [true, "deskripsi harus diisi"],
    },
    image_product: {
      type: String,
      required: [true, "product harus memiliki setidaknya 1 gambar"],
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    warna: {
      type: String,
      required: false,
    },
    size: {
      type: String,
      enum: ["small", "medium", "big"],
    },
    categoryId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "Category",
    },
    varianRasa: {
      type: [String],
      required: false,
    },
    stok: {
      type: Number,
      required: true,
    },
    rasaLevel: {
      type: [String],
      required: false,
    },
    pemasok: {
      type: mongoose.Types.ObjectId,
      ref: "Product",
    },
    rating: {
      type: Number,
    },
    komentar: [
      {
        userId: {
          type: mongoose.Types.ObjectId,
          ref: "User",
        },
        content: {
          type: String,
        },
        rating: {
          type: Number,
          enum: [1, 2, 3, 4, 5],
        },
      },
    ],
  },
  { timestamp: true }
);

//Check if there is discon for the product before save
productModels.pre("save", function (next) {
  if (this.diskon) {
    this.total_price = this.price - (this.price * this.diskon) / 100;
    return next();
  }
});

productModels.post("save", function (next) {
  const product = this;

  if (product.komentar && product.komentar.length > 0) {
    const totalRating = product.komentar.reduce(
      (acc, comment) => acc + comment.rating,
      0
    );
    product.rating = totalRating / product.komentar.length;
    product.save();
  } else {
    product.rating = 0;
  }
});

productModels.post("findOneAndUpdate", async function (doc, next) {
  try {
    const document = await this.model.findOne(this.getQuery());

    if (!document) {
      return next();
    }

    const updatedDoc = this._update;
    updatedDoc.total_price =
      updatedDoc.price - (updatedDoc.price * updatedDoc.diskon) / 100;
    await doc.save();
    return next();
  } catch (error) {
    return next(error);
  }
});

const Product = mongoose.model("Product", productModels);

module.exports = Product;
