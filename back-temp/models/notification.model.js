const mongoose = require('mongoose')
const CONFIG = require('../config/config')
const mongoosePaginate = require('mongoose-paginate-v2')

let NotificationSchema = new mongoose.Schema({
    
    type: {
        enum: CONFIG.NotificationTypes,
        type: String,
    },
    title: {
        type: String,
    },
    body: {
        type: String,
    },
    from: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    to: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    shipper: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    carrier: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    cargo: {
        type: mongoose.Schema.ObjectId,
        ref: 'Cargo',
    },
    inquiry: {
        type: mongoose.Schema.ObjectId,
        ref: 'Inquiry',
    },
    readStatus: {
        type: Boolean,
        default: false,
    },
    
}, {timestamps: true})

NotificationSchema.plugin(mongoosePaginate)

let Notification = module.exports = mongoose.model('Notification',
    NotificationSchema)
