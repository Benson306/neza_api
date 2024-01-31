let mongoose = require('mongoose');

let CreatorsSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    balance: Number,
    country: String,
    isVerified: Boolean,
});

let CreatorsModel = mongoose.model('creators', CreatorsSchema);

module.exports = CreatorsModel;