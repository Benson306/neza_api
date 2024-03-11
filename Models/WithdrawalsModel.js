let mongoose = require('mongoose');

let WithdrawalsSchema = new mongoose.Schema({
    creator_id: String,
    amount: Number,
    currency: String,
    status: String,
    date: String
});

let WithdrawalsModel = mongoose.model('withdrawals', WithdrawalsSchema);

module.exports = WithdrawalsModel;