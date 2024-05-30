let mongoose = require('mongoose');

let BrandUsersSchema = new mongoose.Schema({
    email: String,
    fullName: String,
    jobTitle: String,
    role: String,
    brand_id: String,
    password: String,
    firstTimePassword: Boolean
});

let BrandsUsersModel = mongoose.model('brands_users', BrandUsersSchema);

module.exports = BrandsUsersModel;