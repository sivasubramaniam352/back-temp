const mongoose = require('mongoose');

let DeviceSchema = new mongoose.Schema({
    name: {
        type: String
    },
    active:{
        type: Boolean,
        default: true
    },
    shortId: {
        type: String,
        index: true,
        unique: true,
        required: true,
        trim: true
    },
    online: {
        type: Boolean,
        default: true
    },
    type: {
        type: String,
        default: "RealTek"
    },
    addedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
    
}, { timestamps: true })


DeviceSchema.methods.toWeb = function () {
    let json = this.toJSON();
    json.id = this._id;//this is for the front end
    return json;
};


let Device = module.exports = mongoose.model('Device', DeviceSchema);
