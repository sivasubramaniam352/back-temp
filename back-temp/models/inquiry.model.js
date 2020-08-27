const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2');
var aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const CONFIG = require('../config/config')

let InquirySchema = new mongoose.Schema({
    cargo: {
        type: mongoose.Schema.ObjectId,
        ref: 'Cargo',
    },
    shipper: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    matchedCarriers: [
        {
            id: {
                type: mongoose.Schema.ObjectId,
                ref: 'User',
            },
            carrierProposedFare:{
                type: String,
            },
            shipperProposedFare:{
                type: String,
                required: true
            },
            status: {
                type: String,
                enum: CONFIG.inquiryStatuses,
                default: 'CREATED',
            },
            ignored: {
                type: Boolean,
                required: true,
                default: false
            },
            trucks: [
                {
                    type: mongoose.Schema.ObjectId,
                    ref: 'Truck',
                }
            ]
        }
        ],
    status: {
        type: String,
        enum: CONFIG.inquiryStatuses,
        default: 'CREATED',
    },
    proposedFare: {
        type: String,
        required: true
    },
    acceptedFare: {
        type: String,
    },
    processing: {
        type: Boolean,
        default: false,
    },
    
}, {timestamps: true})

InquirySchema.plugin(mongoosePaginate);
InquirySchema.plugin(aggregatePaginate);



InquirySchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id
    return json
}

let Inquiry = module.exports = mongoose.model('Inquiry', InquirySchema)
