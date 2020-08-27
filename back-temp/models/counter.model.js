const mongoose = require('mongoose')
const CONFIG = require('../config/config')

let CounterSchema = new mongoose.Schema({
    
    collectionName: {
        type: String,
    },
    seq: {
        type: Number,
        default : 0
    }

}, {timestamps: true})

let Counter = module.exports = mongoose.model('Counter', CounterSchema)
