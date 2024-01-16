let mongoose = require('mongoose');

let AdminUsersSchema = new mongoose.Schema({
    email: String,
    password: String,
    date: String,
    firstTimePassword: Boolean
});

let AdminUsersModel = mongoose.model('admin_users', AdminUsersSchema);

module.exports = AdminUsersModel;