const mongoose = require('mongoose')
const CONFIG = require('../config/config')
const mongoosePaginate = require('mongoose-paginate-v2')
const {ObjectId} = mongoose.Schema.Types

let TruckSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    registrationNumber: {
        type: String,
        unique: true,
        index: true,
        required: true,
    },
    vendor: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    cargo: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'Cargo',
        }],
    drivers: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'Driver',
        }],
    device: {
        type: mongoose.Schema.ObjectId,
        ref: 'Device',
    },
    
    lastLocation: {
        type: [Number],
        index: '2dsphere',
        default: [0, 0],
    },
    
    type: {
        id: {
            type: mongoose.Schema.ObjectId,
            ref: 'TruckType',
            required: true,
        },
        subtype: {
            type: ObjectId,
            required: true,
        },
        displayName: {
            type: String,
            required: true,
        },
    },
    readyToAssign: {
        type: Boolean,
        default: false,
    },
    available: {
        type: Number,
        default: 0,
    },
    active: {
        type: Boolean,
        default: false,
    },
    photoURL: {
        type: String,
    },
    suspend: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    
}, {timestamps: true, virtuals: true})

TruckSchema.virtual('displayName')
    .get(function () {
        return this.name.toString().trim().lowercase()
    })

TruckSchema.plugin(mongoosePaginate)

TruckSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

let Truck = module.exports = mongoose.model('Truck', TruckSchema)




