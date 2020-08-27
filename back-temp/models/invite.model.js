const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userRef = { type: mongoose.Schema.Types.ObjectId, ref: "User" };

const InviteSchema = new Schema({
  userRef: userRef,
  email: {
    type: String,
    required: true,
  },
  organizationName: {
    type: String,
    required: true,
  },
  verified:{
    type: Boolean,
    default: false
  },
  referalCode: {
    type: Number,
    required: true,
  }
}, {timestamps: true});
//invitemodel
module.exports = new mongoose.model("invite", InviteSchema);
