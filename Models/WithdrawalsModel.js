let mongoose = require('mongoose');

let WithdrawalsSchema = new mongoose.Schema({
    creator_id: String,
    amount: Number,
    date: String
});

let WithdrawalsModel = mongoose.model('withdrawals', WithdrawalsSchema);

module.exports = WithdrawalsModel;