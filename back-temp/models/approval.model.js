const mongoose = require('mongoose')
const CONFIG = require('../config/config')
const mongoosePaginate = require('mongoose-paginate-v2');

let BankAccountApprovalSchema = new mongoose.Schema({
    
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    bankAccount:  {
        id: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        accountHolderName: {
            type: String,
            required: true,
        },
        bankName: {
            type: String,
            required: true,
        },
        accountType: {
            type: String,
            required: true,
        },
        accountNumber: {
            type: String,
            required: true,
        },
        ifscCode: {
            type: String,
            required: true,
        },
        branchAddress: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
    },
    authorizedBy:{
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    status: {
        type: String,
        required: true,
        enum: CONFIG.bankAccountApprovalStatuses,
    },


}, {timestamps: true})

BankAccountApprovalSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    return json
}

BankAccountApprovalSchema.plugin(mongoosePaginate)

let BankAccountApproval = module.exports = mongoose.model('BankAccountApproval', BankAccountApprovalSchema)
