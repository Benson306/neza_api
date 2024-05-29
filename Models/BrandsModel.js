let mongoose = require('mongoose');

let BrandsSchema = new mongoose.Schema({
    brandName: String,
    companyName: String,
    country: String,
    wallet_balance: Number,
    credit_balance: Number,
    date: String
});

let BrandsModel = mongoose.model('brands', BrandsSchema);

module.exports = BrandsModel;