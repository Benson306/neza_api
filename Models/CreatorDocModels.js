let mongoose = require('mongoose');

let CreatorDocSchema = new mongoose.Schema({
    creator_id: String,
    kra_file: String,
    id_file: String,
    id_number: String,
    kra_number: String,
});

let CreatorDocModel = mongoose.model('creator_docs', CreatorDocSchema);

module.exports = CreatorDocModel;