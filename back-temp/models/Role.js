const mongoose = require('mongoose')

let RoleSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        require: true
    },
    role: {

        name: {
            type: String,
            required: true
        },

        read: {
            type: Array
        },
        write: {
            type: Array
        }
    }
},{timestamps: true})
let Role = module.exports = mongoose.model('Role', RoleSchema)