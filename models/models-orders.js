const mongoose = require('mongoose');

const modelOrder = mongoose.Schema({
    product: [{
        productId: {
            type: mongoose.Types.ObjectId,
            required: [true, 'Productid harus di isi'],
            ref: 'Product',
        },
        quantity: {
            type: Number,
            required: [true, 'Quantity harus di isi'],
            min: 1,
            default: 1
        }
    }],
    userId: {
        type: mongoose.Types.ObjectId,
        required: [true, 'userId harus di isi'],
        ref: 'User'
    },
    total_price: {
        type: Number,
        required: [true, 'total Price harus di isi']
    },
    addressId: {
        type: mongoose.Types.ObjectId,
        required: [true, 'addressId harus di isi'],
        ref: 'Address'
    },
    date_order: {
        type: String,
        required: [true, 'date Order harus di isi']
    },
    status: {
        type: String,
        required: [true, 'status harus di isi'],
        enum: ["Belum Bayar", "Sedang diproses", "Dikirim", "Selesai", "Dibatalkan"],
        default: "Belum Bayar"
    }
}, { timestamp: true })

const Orders = mongoose.model('Orders', modelOrder)

module.exports = Orders