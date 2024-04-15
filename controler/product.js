const Product = require("../models/model-product");
const User = require("../models/model-auth-user");
const Category = require("../models/model-category");

module.exports = {
  list_product: async (req, res, next) => {
    try {
      const { search, filter } = req.query;

      let handlerFilter = {};

      if (search) {
        handlerFilter = {
          ...handlerFilter,
          name_product: { $regex: new RegExp(search, "i") },
        };
      }

      if (filter) {
        const categoryResoul = await Category.findOne({
          name: { $regex: filter, $options: "i" },
        });

        handlerFilter = { ...handlerFilter, categoryId: categoryResoul._id };
      }

      const list_product = await Product.find(handlerFilter)
        .populate("userId", "-password")
        .populate("categoryId");

      return res.status(200).json({ datas: list_product });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  listProductAdmin: async (req, res, next) => {
    try {
      const { search, filter } = req.query;

      let handlerFilter = {};

      if (search) {
        handlerFilter = {
          ...handlerFilter,
          name_product: { $regex: new RegExp(search, "i") },
        };
      }

      if (filter) {
        const categoryResoul = await Category.findOne({
          name: { $regex: filter, $options: "i" },
        });

        handlerFilter = { ...handlerFilter, categoryId: categoryResoul._id };
      }

      handlerFilter = {
        ...handlerFilter,
        userId: req.user.id,
      };

      const dataProduct = await Product.find(handlerFilter).populate(
        "userId",
        "-password"
      );

      return res.status(200).json({ datas: dataProduct });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "internal server error" });
    }
  },

  productDetail: async (req, res, next) => {
    try {
      const dataProduct = await Product.findOne({ _id: req.params.id });

      if (!dataProduct)
        return res.status(404).json({ message: "product Not Found" });

      return res.status(200).json({ datas: dataProduct });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "internal server error" });
    }
  },

  upload: async (req, res, next) => {
    try {
      const dataProduct = req.body;
      const user = await User.findById(req.user.id);
      if (user) {
        dataProduct.userId = user._id;
        const newProduct = await Product.create(dataProduct);
        return res.status(201).json({
          error: false,
          message: "Upload Product Success",
          datas: newProduct,
        });
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  addComment: async (req, res, next) => {
    try {
      const { product_id, komentar } = req.body;
      komentar.userId = req.user.id;
      if (!product_id)
        return res
          .status(400)
          .json({ message: "Diperlukan payload product_id dan komentar" });
      const produk = await Product.findById(product_id);
      if (!produk)
        return res
          .status(404)
          .json({ message: `Produk dengan id: ${product_id} tidak ditemukan` });
      const sameUser = produk.komentar.find((komen) => {
        console.log(komen.userId.toString(), req.user.id);
        return komen.userId.toString() == req.user.id;
      });

      if (sameUser)
        return res
          .status(403)
          .json({
            message:
              "User yang sama tidak bisa memberikan komentar dan rating lebih dari satu kali",
          });
      produk.komentar.push(komentar);
      await produk.save();
      return res
        .status(200)
        .json({ message: "Berhasil menambahkan komentar untuk produk ini" });
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  pemasok: async (req, res, next) => {
    try {
      const { product_id, pemasok } = req.body;
      const produk = await Product.findByIdAndUpdate(product_id, { pemasok });
      if (!produk) {
        return res
          .status(404)
          .json({ message: `Produk dengan id: ${product_id} tidak ditemukan` });
      }
      if (produk.userId.toString() !== req.user.id)
        return res
          .status(403)
          .json({ message: "Tidak bisa mengubah produk orang lain!" });
      return res
        .status(200)
        .json({
          message: "Berhasil mengubah pemasok untuk produk ini produk ini",
          data: produk,
        });
    } catch (err) {
      console.log(err);
      next(err);
      next(err);
    }
  },

  edit: async (req, res, next) => {
    try {
      const updateData = req.body;
      const productId = req.body.product_id;
      if (!productId)
        return res
          .status(400)
          .json({ message: "Diperlukan payload product_id" });
      delete req.body.product_id;
      const product = await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true }
      );
      if (!product) {
        return res.status(404).json({
          error: true,
          message: `Produk dengan id: ${productId} tidak ditemukan`,
          datas: product,
        });
      }
      if (product.userId.toString() !== req.user.id)
        return res
          .status(403)
          .json({ message: "Tidak bisa mengubah produk orang lain!" });

      return res.status(201).json({
        error: false,
        message: "Berhasil Mengubah Data Produk",
        datas: product,
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  },
  addComment: async (req, res, next) => {
    try {
      const { product_id, komentar } = req.body;
      komentar.userId = req.user.id;
      if (!product_id)
        return res
          .status(400)
          .json({ message: "Diperlukan payload product_id dan komentar" });
      const produk = await Product.findById(product_id);
      if (!produk)
        return res
          .status(404)
          .json({ message: `Produk dengan id: ${product_id} tidak ditemukan` });
      const sameUser = produk.komentar.find((komen) => {
        console.log(komen.userId.toString(), req.user.id);
        return komen.userId.toString() == req.user.id;
      });

      if (sameUser)
        return res
          .status(403)
          .json({
            message:
              "User yang sama tidak bisa memberikan komentar dan rating lebih dari satu kali",
          });
      produk.komentar.push(komentar);
      await produk.save();
      return res
        .status(200)
        .json({ message: "Berhasil menambahkan komentar untuk produk ini" });
    } catch (err) {
      console.log(err);
      next(err);
    }
  },
  pemasok: async (req, res, next) => {
    try {
      const { product_id, pemasok } = req.body;
      const produk = await Product.findByIdAndUpdate(product_id, { pemasok });
      if (!produk) {
        return res
          .status(404)
          .json({ message: `Produk dengan id: ${product_id} tidak ditemukan` });
      }
      if (produk.userId.toString() !== req.user.id)
        return res
          .status(403)
          .json({ message: "Tidak bisa mengubah produk orang lain!" });
      return res
        .status(200)
        .json({
          message: "Berhasil mengubah pemasok untuk produk ini produk ini",
          data: produk,
        });
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const productId = req.body.product_id;
      const deleted = await Product.findByIdAndDelete(productId);
      if (deleted) {
        return res.status(201).json({
          error: false,
          message: "Berhasil Menghapus Data Produk",
          datas: deleted,
        });
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  },
};
