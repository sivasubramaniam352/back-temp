const mongoose = require('mongoose')
const CONFIG = require('../config/config')
var mongoosePaginate = require('mongoose-paginate');


let PaymentSchema = new mongoose.Schema({
    
    totalAmount: {
        type: Number,
        required: true,
    },
    advanceAmount: {
        type: Number,
        required: true,
    },
    remainingAmount: {
        type: Number,
    },
    currency: {
        type: String,
        required: true,
        default: "INR"
    },
    description: {
        type: String,
    },
    cargo: {
        type: mongoose.Schema.ObjectId,
        ref: 'Cargo',
    },
    readableCargoId: {
        type: String,
        required: true,
    },
    truck:{
        registrationNumber: {
            type:String,
            required: true
        },
        name: {
            type:String,
            required: true
        },
        typeDisplayName: {
            type:String,
            required: true
        },
        subtype: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
    },
    carrierPANCardNumber: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    completedTime: {
        type: Date,
    },
    
    transactions : [
        {
            gatewayType: {
                type: String,
                required: true,
                enum: CONFIG.paymentGateways,
                default: 'HDFC',
            },
            type: {
                type: String,
                required: true,
                enum: CONFIG.paymentTypes,
            },
            amount: {
                type: Number,
                required: true,
            },
            convenienceFee: {
                type: Number,
                required: true,
            },
            gst: {
                type: Number,
                required: true,
            },
            totalAmount: {
                type: Number,
                required: true,
            },
            description: {
                type: String,
            },
            transactionStatus: {
                type: String,
                required: true,
                enum: CONFIG.paymentTransactionStatuses,
            },
            remoteTransactionId: {
                type: String,
                required: true
            },
            razorpayPublicKey: {
                type: String,
            },
            hdfcAccessCode: {
                type: String,
            },
            remotePaymentDetails: {},
            initiatedTime: {
                type: Date,
                required: true
            },
            completedTime: {
                type: Date,
            },
        }
    ],
    status: {
        type: String,
        enum: CONFIG.paymentStatuses,
        default: 'INITIATED',
    },
}, {timestamps: true})

PaymentSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

PaymentSchema.plugin(mongoosePaginate)

let Payment = module.exports = mongoose.model('Payment', PaymentSchema)
