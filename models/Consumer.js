const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
    meter_no: String,
    balance: Number,
    recorded_at: { type: Date, default: Date.now },
});

const consumerSchema = new mongoose.Schema({
    consumer_id: { type: String, required: true, unique: true },
    site_id: { type: String, required: true },
    consumer_name : { type: String, required: false },
    mobile_no : { type: String, required: false },
    balances: [balanceSchema],
});

const Consumer = mongoose.model('Consumer', consumerSchema);

module.exports = Consumer;
