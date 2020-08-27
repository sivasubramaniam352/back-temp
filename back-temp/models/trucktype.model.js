const mongoose = require('mongoose')
const CONFIG = require('../config/config')
var mongoosePaginate = require('mongoose-paginate')

var subType = new mongoose.Schema({
    
    displayName: {
        type: String,
        required: true,
    },
    capacity: {
        required: true,
        type: Number,
        enum: CONFIG.TruckTypeCapacities,
    },
    noOfTyres: {
        type: Number,
    },
    active: {
        type: Boolean,
        default: true
    }
    
})

let TrucktypeSchema = new mongoose.Schema({
    displayName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    subtypes: [subType],
    active: {
        type: Boolean,
        default: true
    }
    
}, {timestamps: true})

let Trucktype = module.exports = mongoose.model('Trucktype', TrucktypeSchema)
