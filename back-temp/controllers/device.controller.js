const {User, Device, Truck} = require('../models');
const {to, ReE, ReS, isNull, isEmpty} = require('../services/util.service');
const {ObjectId} = require('mongoose').Types
const CONFIG = require('../config/config');
const validator = require('validator');
const HttpStatus = require('http-status');


const addDevice = async function (req, res) {

    let deviceRequest = req.body;
    let err, device;

    console.log("Add device", deviceRequest)
    
    if (isNull(deviceRequest.shortId)) {
        return ReE(res, {message: 'Please provide a shortId'}, 400);
    }
    
    deviceRequest.addedBy = req.user._id;
    

    [err, device] = await to(Device.create(deviceRequest));
    if (err) {
        if (err.message.includes('E11000') &&
            err.message.includes('shortId')) {
            return ReE(res,
                `ShortId ${deviceRequest.shortId} already exists`,
                HttpStatus.BAD_REQUEST)
        }
        return ReE(res, err, HttpStatus.BAD_REQUEST);
    }
        return ReS(res, {message: 'Device added.', device: device}, 200);
    
}
module.exports.addDevice = addDevice;

const getDevices = async function (req, res) {

    let user = req.user;

    let err, drivers;

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, {message: "user id is wrong"}, 400);
    }

    [err, drivers] = await to(Driver.find({'vendor': user._id}).populate({
        path: 'truck',
        select: 'name registrationNumber transportName _id'
    }).populate({path: 'vendor', select: 'name email _id'}).sort({createdAt: -1}));

    if (err) {
        return ReE(res, err, 400);
    } else {
        return ReS(res, {message: "Driver details are", drivers: drivers}, 200);
    }
    
}
module.exports.getDevices = getDevices;

const getDevice = async function (req, res) {
    
    let deviceId = req.params.id
    let err, device;
    
    [err, device] = await to(Device.findOne({"shortId": deviceId}));
    
    if (err) {
        return ReE(res, err, 400)
    } else {
        if (!device) {
            return ReE(res, {message: 'Device is not found'}, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        ReS(res, {message: 'Device found', device: device}, 200)
        
    }
    
}
module.exports.getDevice = getDevice;

const updateDevice = async function (req, res) {
    let err, user, data, updateDriver, driver, truck;
    user = req.user;
    const userId = user._id;
    data = req.body;

    let driverId = req.params.id;

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, {message: "please provide valid Driver id"}, 400);
    };

    if (typeof data.truck !== 'undefined' && data.truck !== '') {

        if (!ObjectId.isValid(data.truck)) {
            return ReE(res, {message: "please provide valid Truck id"}, 400);
        };

        [err, truck] = await to(Truck.findOne({_id: new ObjectId(data.truck)}));
        if (err) return ReE(res, err, 400);
        else {
            if (truck) {

                data.truck = data.truck;

            } else {
                return ReE(res, {message: "Truck is not found"}, 400);
            }
        }
    }

    [err, driver] = await to(Driver.findOne({_id: new ObjectId(driverId)}));
    if (err) {
        return ReE(res, err, 400);
    } else {
        if (driver) {
            CONFIG.editableDriverFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    driver[field] = data[field]
                }
            });

            [err, updateDriver] = await to(driver.save())

            if (err) {
                return ReE(res, err, 400);
            }

            return ReS(res, {message: 'Driver is Updated.', driver: updateDriver}, 200);
        } else {
            return ReE(res, {message: "Driver is not found"}, 400);
        }

    }
}
module.exports.updateDevice = updateDevice;


