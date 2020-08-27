const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2');
var aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const CONFIG = require('../config/config')
const validate = require('mongoose-validator');


let CardRequestSchema = new mongoose.Schema({
    
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    status: {
        type: String,
        default: 'NEW',
    },
    companyName: {
        type: String,
        trim: true,
        required: true
    },
    cardHolderName: {
        type: String,
        trim: true,
        required: true
    },
    city: {
        type: String,
        trim: true,
        required: true
    },
    pincode: {
        type: String,
        required: true,
        validate: [
            validate({
                validator: 'isNumeric',
                arguments: [5, 7],
                message: 'Not a valid pincode.',
            })],
    },
    email: {
        type: String,
        lowercase: true,
        required: true,
        trim: true,
        validate: [
            validate({
                validator: 'isEmail',
                message: 'Not a valid email.',
            })],
    },
    phone: {
        type: String, required: true,
        validate: [
            validate({
                validator: 'isNumeric',
                arguments: [7, 20],
                message: 'Not a valid phone number.',
            })],
    },
    countryCode: {
        type: String,
    },
    panCard: {
        type: String,
        required: true,
    },
    
}, {timestamps: true})

CardRequestSchema.plugin(mongoosePaginate);



CardRequestSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id
    return json
}

let CardRequest = module.exports = mongoose.model('CardRequest', CardRequestSchema)
