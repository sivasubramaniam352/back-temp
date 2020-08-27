const mongoose = require('mongoose')
const CONFIG = require('../config/config')

let HdfcCallbackSchema = new mongoose.Schema({
    
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

HdfcCallbackSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

let HdfcCallback = module.exports = mongoose.model('HdfcCallback', HdfcCallbackSchema)
