const mongoose = require('mongoose')
const CONFIG = require('../config/config')
const {isISO8601} = require('validator')
const mongoosePaginate = require('mongoose-paginate-v2');
const mongooseValidator = require('mongoose-validator')
const {ObjectId} = mongoose.Schema.Types


let CargoSchema = new mongoose.Schema({
    
    shipper: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    carrier: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    readableId:{
        'type': String,
        required: true
    },
    payment: {
        type: mongoose.Schema.ObjectId,
        ref: 'Payment',
    },
    truck: {
        type: mongoose.Schema.ObjectId,
        ref: 'Truck',
    },
    type: {
        id: {
            type: mongoose.Schema.ObjectId,
            ref: 'TruckType',
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
    fromLocation: {
        required: true,
        type: [Number],
        index: '2dsphere',
        default: [0, 0],
    },
    toLocation: {
        required: true,
        type: [Number],
        index: '2dsphere',
        default: [0, 0],
    },
    fromAddress1: {
        type: String,
        required: true,
        validate: [
            {
                validator: function validator (val) {
                    return val.length >= 8
                }, msg: 'Please enter an address with min 8 characters',
            }
            ,
        
        ],
    },
    fromCity: {
        type: String,
    },
    toAddress1: {
        type: String,
    },
    toCity: {
        type: String,
    },
    fareEstimate: {
        type: Number,
    },
    proposedFare: {
        type: Number,
        required: true,
    },
    acceptedFare: {
        type: Number,
    },
    requestedPickupTime: {
        type: Date,
        required: true,
    },
    actualPickupTime: {
        type: Date,
    },
    estimatedDeliveryTime: {
        type: Date,
        required: true,
    },
    requestedDeliveryTime: {
        type: Date,
    },
    actualDeliveryTime: {
        type: Date,
    },
    status: {
        type: String,
        enum: CONFIG.cargoStatuses,
        default: 'CREATED',
    },
    remarks: {
        type: String,
        maxLength: CONFIG.cargoRemarksLimit
    },
    
}, {timestamps: true})

CargoSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

CargoSchema.plugin(mongoosePaginate)


let Cargo = module.exports = mongoose.model('Cargo', CargoSchema)
