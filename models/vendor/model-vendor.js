const mongoose = require("mongoose");

const vendorModel = mongoose.Schema({
    nama: {
        type: String,
        required: false
    },
    namaBadanUsaha: {
        type: String,
        required: false
    },
    penanggungJawab:{
        type: String,
        required: false
    },
    addressId:{
        type: mongoose.Types.ObjectId,
        ref: "Address",
        required: [true, "Harus memiliki alamat"]
    },
    userId: {
        type: mongoose.Types.ObjectId,
        required: [true, 'userId harus di isi'],
        ref: 'User'
    },
    noTeleponKantor:{
        type: String,
        required: false
    },
    legalitasBadanUsaha:{
        type: String, 
        required: false
    }
})

const Vendor = mongoose.model("Vendor", vendorModel)

module.exports = Vendor