const mongoose = require('mongoose')
const CONFIG = require('../config/config')

let RazorpayCallbackSchema = new mongoose.Schema({
    
    payment: {
        type: mongoose.Schema.ObjectId,
        ref: 'Payment',
    },
    remotePaymentDetails: {
    
    },
    status: {
        type: String,
    },


}, {timestamps: true})

RazorpayCallbackSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

let RazorpayCallback = module.exports = mongoose.model('RazorpayCallback', RazorpayCallbackSchema)
