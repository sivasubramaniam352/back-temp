const mongoose = require('mongoose');
const CONFIG = require('../config/config');
const mongoosePaginate = require('mongoose-paginate-v2')
const validate = require('mongoose-validator');


let DriverSchema = new mongoose.Schema({

  vendor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  truck: {
    type: mongoose.Schema.ObjectId,
    ref: 'Truck'
  },
  name: {
    type: String
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
    sparse: true, //sparse is because now we have two possible unique keys that are optional
    validate: [
      validate({
        validator: 'isNumeric',
        arguments: [7, 20],
        message: 'Not a valid phone number.',
      })
    ],
  },
  countryCode: {
    type: String,
  },
  active: {
    type: Boolean,
    default: false
  },
  photoURL: {
    type: String
  },
  sharingId: {
    type: String
  },
  drivingLicenseNumber: {
    type: String,
    required: true
  },
  drivingLicensePhoto: {
    type: String
  },
  secret_code: {
    type: String,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true
})


DriverSchema.methods.toWeb = function() {
  let json = this.toJSON();
  json.id = this._id; //this is for the front end
  return json;
};

DriverSchema.plugin(mongoosePaginate)


let Driver = module.exports = mongoose.model('Driver', DriverSchema);
