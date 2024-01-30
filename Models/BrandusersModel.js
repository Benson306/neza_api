let mongoose = require('mongoose');

let BrandUsersSchema = new mongoose.Schema({
    email: String,
    brandName: String,
    companyName: String,
    country: String,
    wallet_balance: Number,
    credit_balance: Number,
    date: String,
    password: String,
    firstTimePassword: Boolean
});

let BrandUsersModel = mongoose.model('brands', BrandUsersSchema);

module.exports = BrandUsersModel;