let mongoose = require('mongoose');

let PayoutsSchema = new mongoose.Schema({
    initiatedBy: String,
    approvedBy: String,
    sender_id: String,
    recepient_id: String,
    sender_email: String,
    recepient_name: String,
    recepient_email: String,
    amount: Number,
    status: Number,
    country: String,
    source: String,
    currency: String,
    description: String,
    date: String
});

let PayoutsModel = mongoose.model('payouts', PayoutsSchema);

module.exports = PayoutsModel;