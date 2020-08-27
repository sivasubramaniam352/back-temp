const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const bcrypt_p = require('bcrypt-promise')
const jwt = require('jsonwebtoken')
const validate = require('mongoose-validator')
const {TE, to} = require('../services/util.service')
const CONFIG = require('../config/config')
const {isNull} = require('../services/util.service')
const {admin} = require('../services/notification.service')     
const mongoosePaginate = require('mongoose-paginate-v2')
var aggregatePaginate = require('mongoose-aggregate-paginate-v2')
let UserSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    displayName: {
        type: String,
    },
    photoURL: {
        type: String,
    },
    businessName: {
        type: String,
        // required: true,
        trim: true,
    },
    role:{
        type:mongoose.Schema.ObjectId,
        ref:'Role'
    },
    organization: {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organization",
        },
        displayName: {
          type: String
        },
        active: {
          type: Boolean,
          default: false,
        },
    },
    billing: [
        {
            active: {
                type: Boolean,
                default: true,
            },
            name: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                lowercase: true,
                // required: true,
                trim: true,
                validate: [
                    validate({
                        validator: 'isEmail',
                        message: 'Not a valid email.',
                    })],
            },
            address: {
                type: String,
                required: true,
            },
            country: {
                type: String,
                required: true,
            },
            state: {
                type: String,
                required: true,
            },
            city: {
                type: String,
                required: true,
            },
            organisation:{
                type: String
            },
            zip: {
                type: String,
                required: true,
            },
            tel: {
                type: String,
                required: true,
            },
        }],
    email: {
        type: String,
        lowercase: true,
        trim: true,
        index: true,
        unique: true,
        sparse: true,
        validate: [
            validate({
                validator: 'isEmail',
                message: 'Not a valid email.',
            })],
    },
    password: {
        type: String,
    },
    phone: {
        type: String, //sparse is because now we have two possible unique keys that are optional
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
    otp: {
        type: String,
    },
    verificationCode: {
        type: String,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    type: [
        {
            type: String,
            enum: CONFIG.UserTypes,
        }],
    notificationToken: {
        type: String,
    },
    active: {
        type: Boolean,
        default: true,
    },
    lastOtpRequestedAt: {
        type: Date,
    },
    admin: {
        type: Boolean,
        default: false,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    bankAccounts: [
        mongoose.Schema({
            active: {
                type: Boolean,
                default: true,
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
                unique: true,
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
            attachment: {
                type: String,
                required: true,
            },
            description: {
                type: String,
            },
            verified: {
                type: String,
                default: false,
            },
            gstNumber: {
                type: String,
            },
            transporterId: {
                type: String,
            },
            status: {
                type: String,
                required: true,
                enum: CONFIG.bankAccountApprovalStatuses,
                default: "PENDING"
            },
            authorizedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User',
            },
        }, {timestamps: true})
    ],
}, {timestamps: true})
UserSchema.pre('save', async function (next) {
    if (isNull(this.password)) {
        return
    }
    if (this.isModified('password') || this.isNew) {
        let err, salt, hash;
        [err, salt] = await to(bcrypt.genSalt(10))
        if (err) TE(err.message, true);
        [err, hash] = await to(bcrypt.hash(this.password, salt))
        if (err) TE(err.message, true)
        this.password = hash
    } else {
        return next()
    }
})
UserSchema.methods.comparePassword = async function (pw) {
    let err, pass
    if (!this.password) TE('password not set');
    [err, pass] = await to(bcrypt_p.compare(pw, this.password))
    if (err) TE(err)
    if (!pass) TE('Email/password did not match. Please try again.')
    return this
}
UserSchema.methods.getJWT = function () {
    let expiration_time = parseInt(CONFIG.jwt_expiration)
    return 'Bearer ' + jwt.sign({user_id: this._id}, CONFIG.jwt_encryption,
        {expiresIn: expiration_time})
}
UserSchema.methods.getMobileJWT = function () {
    return 'Bearer ' + jwt.sign({user_id: this._id}, CONFIG.jwt_encryption)
}
UserSchema.methods.getFirebaseAuthToken = async function () {
    // var error, token
    // var uid = this._id.toString()
    // console.log('Firebase uid', uid);
    // [error, token] = await to(admin.auth().createCustomToken(uid))
    // if (error) {
    //     console.log('Error creating custom token:', error)
    // }
    //  console.log('token:', token)
    // return token

    var token
    token = 'Bearer ' + jwt.sign({ user_id: this._id }, CONFIG.jwt_encryption,
        { expiresIn: '2h' })
    console.log('token:', token)

    return token
}
UserSchema.methods.toWeb = function () {
    let json = this.toJSON()
    json.id = this._id//this is for the front end
    // json.password = undefined
    return json
}
UserSchema.plugin(mongoosePaginate)
UserSchema.plugin(aggregatePaginate)
let User = module.exports = mongoose.model('User', UserSchema)