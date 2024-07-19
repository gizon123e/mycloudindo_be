const mongoose = require("mongoose");

const ewalletModel = mongoose.Schema({
    nama_ewallet: {
        type: String
    },
    icon:{
        type: String
    }
});

const Ewallet = mongoose.model("Ewallet", ewalletModel);

module.exports = Ewallet;