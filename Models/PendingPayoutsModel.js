let mongoose = require('mongoose');

let PendingPayoutsSchema = new mongoose.Schema({
    initiatedBy: String,
    sender_id: String,
    sender_email: String,
    recepient_name: String,
    recepient_email: String,
    amount: Number,
    country: String,
    source: String,
    currency: String,
    description: String,
    status: Number,
    date: String
});

let PendingPayoutsModel = mongoose.model('pendingpayouts', PendingPayoutsSchema);

module.exports = PendingPayoutsModel;