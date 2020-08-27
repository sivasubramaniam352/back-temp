const mongoosePaginate = require('mongoose-paginate-v2')
const mongoose = require('mongoose')
const validate = require('mongoose-validator');
const CONFIG = require('../config/config')

let OrganizationSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true,
    },
    type: [
        {
            type: String,
            enum: CONFIG.UserTypes,
        }
    ],
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        require: true
    }
}, { timestamps: true, virtuals: true })


OrganizationSchema.virtual('displayName')
    .get(function () {
        return this.name.toString().trim().lowercase()
    })

OrganizationSchema.plugin(mongoosePaginate)

OrganizationSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

let Organization = module.exports = mongoose.model('Organization', OrganizationSchema)