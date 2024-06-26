const mongoose = require('mongoose')

const modelCarts = mongoose.Schema({
    productId: {
        type: mongoose.Types.ObjectId,
        required: [true, "productId harus di isi"],
        ref: 'Product'
    },
    quantity: {
        type: Number,
        min: [1, 'minimal quantity adalah 1'],
        required: [true, 'quantity harus di isi'],
        default: 1
    },
    userId: {
        type: mongoose.Types.ObjectId,
        required: [true, "userId harus di isi"],
        ref: 'User'
    },
    total_price: {
        type: Number,
        required: [true, 'total price harus di isi'],
    }
})

const Carts = mongoose.model('Carts', modelCarts)

module.exports = Carts