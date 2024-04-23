let mongoose = require('mongoose');

let DepositSchema = new mongoose.Schema({
    brand_id: String,
    brand_email: String,
    amount: Number,
    currency: String,
    status: String,
    date: String,
    time: String
});

let DepositModel = mongoose.model('deposit', DepositSchema);

module.exports = DepositModel;