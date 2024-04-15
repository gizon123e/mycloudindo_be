const mongoose = require('mongoose')
require('./model-auth-user')
require('./model-category')
const productModels = mongoose.Schema({
    name_product: {
        type: String,
        maxlength: [250, 'panjang nama harus antara 5 - 250 karakter'],
        minlength: [5, 'panjang nama harus antara 5 - 250 karakter'],
        required: [true, 'name_product harus di isi']
    },
    price: {
        type: Number,
        required: [true, 'price harus di isi'],
        min: [3, 'price yang harus diisi setidaknya 100'],
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
        required: [true, 'deskripsi harus diisi']
    },
    image_product: {
        type: String,
        required: [true, 'product harus memiliki setidaknya 1 gambar']
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true
    },
    warna: {
        type: [String],
        required: false,
    },
    size: {
        type: String,
        enum: ['small', 'medium', 'big']
    },
    categoryId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'Category'
    },
    varianRasa: {
        type: [String],
        required: false,
    },
    stok: {
        type: Number,
        required: true
    },
    rasaLevel: {
        type: [String],
        required: false,
    },
    pemasok: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    }
}, { timestamp: true })

//Check if there is discon for the product before save
productModels.pre('save', function (next) {
    if (this.diskon) {
        this.total_price = this.price - (this.price * this.diskon / 100)
    }
    next()
})

//Check if there is discon for the product before update(edit)
productModels.pre('findOneAndUpdate', async function (next) {
    const docToUpdate = this.getUpdate()
    await this.model.updateOne(this.getQuery(), { total_price: docToUpdate.price - (docToUpdate.price * docToUpdate.diskon / 100) });
    next()
})

const Product = mongoose.model('Product', productModels)

module.exports = Product