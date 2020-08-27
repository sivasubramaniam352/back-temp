const {User, Cargo, Truck, Notification, Counter} = require('../models')
const authService = require('../services/auth.service')
const {to, ReE, ReS, isNull, formatLocation, isEmpty} = require(
    '../services/util.service')
const ObjectId = require('mongoose').Types.ObjectId
const CONFIG = require('../config/config')
const validator = require('validator')
const notificationService = require('../services/notification.service')
const admin = require('firebase-admin')
const HttpStatus = require('http-status')
const Excel = require('exceljs')
var path = require('path')
const moment = require('moment')
const {setTruckAvailability} = require('./truck.controller')
const {sendNotification} = require('./notification.controller')
const {createNotification} = require('./notification.controller')

const getCargoes = async function (req, res) {
    
    let user = req.user
    
    let err, cargoes
    
    console.log(user._id);
    
    [err, cargoes] = await to(Cargo.find({
        'shipper': user._id,
        // 'status': {'$ne': 'completed'},
    }).populate({path: 'shipper', select: 'name phone _id'}).populate({
        path: 'carrier',
        select: 'name phone _id',
    }).populate({
        path: 'truck',
        select: 'name registrationNumber transportName _id type subtype',
        populate: {path: 'driver', select: 'name phone'},
    }).sort({
        createdAt: 'desc',
    }))
    
    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, {message: 'Cargo details are', cargoes: cargoes}, 200)
    }
}
module.exports.getCargoes = getCargoes

const getCarrierCargoes = async function (req, res) {
    
    let user = req.user
    
    let err, cargoes;
    
    [err, cargoes] = await to(Cargo.find({
        'carrier': user._id,
        '$and': [
            {'status': {'$ne': 'pending_request'}},
            // , {'status': {'$ne': 'completed'}}
        ],
    }).populate({path: 'shipper', select: 'name phone _id'}).populate({
        path: 'carrier',
        select: 'name phone _id',
    }).populate({
        path: 'truck',
        select: 'name registrationNumber transportName _id type subtype',
        populate: {path: 'driver', select: 'name phone'},
    }).sort({createdAt: -1}))
    
    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, {message: 'Cargo details are', cargoes: cargoes}, 200)
    }
}
module.exports.getCarrierCargoes = getCarrierCargoes

const getCargo = async function (req, res) {
    
    let cargoId = req.params.id
    let user = req.user
    let err, cargo
    
    if (!ObjectId.isValid(cargoId)) {
        return ReE(res, {message: 'please provide valid Cargo Id'}, 400)
    }
    
    [err, cargo] = await to(Cargo.findOne({'_id': cargoId})
        .populate({
            path: 'shipper',
            select: 'name phone _id',
        })
        .populate({
            path: 'truck',
            select: 'name registrationNumber transportName _id type subtype drivers',
            populate: {path: 'drivers', select: 'name phone'},
        }))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!cargo) {
        return ReE(res, {message: 'Cargo not found'}, HttpStatus.BAD_REQUEST)
        
    }
    
    return ReS(res, {message: 'Cargo found', cargo: cargo}, HttpStatus.OK)
    
}
module.exports.getCargo = getCargo

const updateCargoStatus = async function (req, res) {
    let err
    let status = req.body.status
    let cargoId = req.params.id
    
    if (!CONFIG.editableCargoStatuses.includes(status)) {
        return ReE(res, 'Cannot change Cargo status.', HttpStatus.BAD_REQUEST)
    }
    
    console.log('Valid status')
    
    let cargo;
    [err, cargo] = await to(
        Cargo.findById(cargoId))
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!cargo) {
        return ReE(res, {message: 'Cargo not found'}, HttpStatus.BAD_REQUEST)
    }
    
    try {
        validateStatus(status, cargo.status)
    } catch (err) {
        console.log('Validate error:', err.message)
        return ReE(res, err,
            HttpStatus.FORBIDDEN)
    }
    
    try {
        validateStatus(status, cargo.status)
    } catch (err) {
        console.log('Validate error:', err.message)
        return ReE(res, err,
            HttpStatus.FORBIDDEN)
    }
    
    let truck, editedTruck
    
    cargo.status = status
    switch (status) {
        case 'PICKED_UP':
            cargo.actualPickupTime = moment().toISOString()
            
            break
        case 'DELIVERED':
            
            cargo.actualDeliveryTime = moment().toISOString()
            break
        case 'COMPLETED':
            
            // [err, truck] = await to(Truck.updateOne(
            //     {
            //         '_id': new ObjectId(cargo.truck),
            //     },
            //     {
            //         $pull: {cargo: new ObjectId(cargo.id)},
            //     },
            // ))
            
            [err, truck] = await to(
                Truck.findOne({_id: new ObjectId(cargo.truck)}))
            
            if (err) {
                console.log('Unable to remove cargo from truck')
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            truck.cargo.pull(new ObjectId(cargo.id))
            truck = setTruckAvailability(truck, cargo)
            console.log(truck);
            
            [err, editedTruck] = await to(truck.save())
            
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            delete cargo.truck
            break
        case 'CANCELLED':
            
            // [err, truck] = await to(Truck.updateOne(
            //     {
            //         '_id': new ObjectId(cargo.truck),
            //     },
            //     {
            //         $pull: {cargo: new ObjectId(cargo.id)},
            //     },
            // ))
            
            [err, truck] = await to(
                Truck.findOne({_id: new ObjectId(cargo.truck)}))
            
            if (err) {
                console.log('Unable to remove cargo from truck')
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            truck.cargo.pull(new ObjectId(cargo.id))
            truck = setTruckAvailability(truck, cargo)
            console.log(truck);
            
            [err, editedTruck] = await to(truck.save())
            
            delete cargo.truck
            
            break
        default:
            //Do nothing
            break
    }
    
    [err, cargo] = await to(cargo.save())
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    try {
        await generateNotification(status, cargo, req.user)
    } catch (err) {
        console.log(err.message)
    }
    
    return ReS(res,
        {message: 'Cargo status updated', cargo: cargo},
        HttpStatus.OK)
    
}
module.exports.updateCargoStatus = updateCargoStatus

function validateStatus (status, existingStatus) {
    let previousStatuses = []
    switch (status) {
        case 'PAID':
            
            previousStatuses = CONFIG.cargoStatuses.slice(
                CONFIG.cargoStatuses.indexOf('ACCEPTED'),
                CONFIG.cargoStatuses.indexOf('PAID'))
            
            console.log('previousStatuses', previousStatuses)
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            
            break
        case 'PICKED_UP':
            //previousStatuses = ['PAID']
            previousStatuses = CONFIG.cargoStatuses.filter(s => s ===
                CONFIG.cargoStatuses[CONFIG.cargoStatuses.indexOf(status) - 1])
            
            console.log('previousStatuses', previousStatuses)
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            break
        case 'IN_TRANSIT':
            
            previousStatuses = CONFIG.cargoStatuses.filter(s => s ===
                CONFIG.cargoStatuses[CONFIG.cargoStatuses.indexOf(status) - 1])
            
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            
            break
        case 'DELIVERED':
            previousStatuses = CONFIG.cargoStatuses.filter(s => s ===
                CONFIG.cargoStatuses[CONFIG.cargoStatuses.indexOf(status) - 1])
            
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            break
        case 'PENDING_COMPLETION':
            previousStatuses = CONFIG.cargoStatuses.filter(s => s ===
                CONFIG.cargoStatuses[CONFIG.cargoStatuses.indexOf(status) - 1])
            console.log('previousStatuses', previousStatuses)
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            break
        case 'CANCELLED':
            previousStatuses = CONFIG.cargoStatuses.slice(
                CONFIG.cargoStatuses.indexOf('PAID'))
            
            if (previousStatuses.indexOf(existingStatus) !== -1) {
                throw new Error('Cannot cancel cargo at this stage.')
            }
            break
        case 'COMPLETED':
            previousStatuses = CONFIG.cargoStatuses.filter(s => s ===
                CONFIG.cargoStatuses[CONFIG.cargoStatuses.indexOf(status) - 1])
            if (previousStatuses.indexOf(existingStatus) === -1) {
                throw new Error(
                    `Cannot update to specified status (${status}) at this stage (${existingStatus}).`)
            }
            break
        default:
            //"Do nothing"
            throw new Error('Unknown status update requested. ')
    }
}

module.exports.validateStatus = validateStatus

async function generateNotification (status, cargo, user) {
    
    let shipper = cargo.shipper
    let carrier = cargo.carrier
    let err, options, notification
    
    switch (status) {
        case 'PAYMENT_REQUESTED':
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.PAYMENT_REQUESTED.title,
                body: CONFIG.NotificationMessages.PAYMENT_REQUESTED.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            break
        case 'PICKED_UP':
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.PICKED_UP.title,
                body: CONFIG.NotificationMessages.PICKED_UP.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            break
        case 'IN_TRANSIT':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.IN_TRANSIT.title,
                body: CONFIG.NotificationMessages.IN_TRANSIT.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            break
        case 'DELIVERED':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.DELIVERED.title,
                body: CONFIG.NotificationMessages.DELIVERED.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            break
        case 'PENDING_COMPLETION':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.PENDING_COMPLETION.title,
                body: CONFIG.NotificationMessages.PENDING_COMPLETION.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            
            break
        case 'CANCELLED':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.CANCELLED.title,
                body: CONFIG.NotificationMessages.CANCELLED.body,
                cargo: cargo._id,
            }
            
            if (shipper._id.equals(user._id)) {
                options.from = shipper
                options.to = carrier
            } else if (carrier._id.equals(user._id)) {
                options.from = carrier
                options.to = shipper
            }
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            if (shipper._id.equals(user._id)) {
                options.mode = 'carrier'
                sendNotification(carrier, options)
            } else if (carrier._id.equals(user._id)) {
                options.mode = 'shipper'
                sendNotification(shipper, options)
            }
            
            return notification
            break
        case 'COMPLETED':
            options = {
                carrier: carrier,
                shipper: shipper,
                from: shipper,
                to: carrier,
                title: CONFIG.NotificationMessages.COMPLETED.title,
                body: CONFIG.NotificationMessages.COMPLETED.body,
                cargo: cargo._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'carrier'
            
            sendNotification(carrier, options)
            
            return notification
            break
        default:
            //"Do nothing"
            return
    }
}

module.exports.generateNotification = generateNotification

const updateCargo = async function (req, res) {
    let err, user, data, cargo, updateCargo
    user = req.user
    const userId = user._id
    data = req.body
    
    let cargoId = req.params.id
    
    if (!ObjectId.isValid(cargoId)) {
        return ReE(res, {message: 'Please provide valid Cargo Id'}, 400)
    }
    
    [err, cargo] = await to(Cargo.findOne({_id: new ObjectId(cargoId)}))
    if (err) return ReE(res, err, 400)
    else {
        if (cargo) {
            
            CONFIG.editableCargoFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    cargo[field] = data[field]
                }
            });
            
            [err, updateCargo] = await to(cargo.save())
            if (err) {
                return ReE(res, err, 400)
            }
            
            return ReS(res,
                {message: 'cargo is Updated.', cargo: updateCargo}, 200)
        } else {
            return ReE(res, {message: 'cargo is not found'}, 400)
        }
    }
}
module.exports.updateCargo = updateCargo

const getFareEstimate = async function (req, res) {
    
    let pickupLocation = req.body.pickupLocation
    let dropLocation = req.body.dropLocation
    let estimate = 68
    let unit = 'rupees'
    
    var distance
    if (!isNull(req.query.distance)) {
        distance = req.query.distance
    } else {
        return ReS(res, {message: 'Please provide a distance'}, 400)
    }
    
    let fareEstimate = distance * estimate
    return ReS(res, {
        rate: {
            cost: estimate,
            unit: unit,
        },
        // calculation: (distance + 'x' + estimate + unit),
        fare: Math.round(fareEstimate),
    }, 200)
    
}
module.exports.getFareEstimate = getFareEstimate

const getEstimatedTime = async function (req, res) {
    
    let inputDistance = req.query.distance
    let tyre = parseInt(req.query.subtype)
    let inputDate = req.query.date
    
    if (isNull(inputDistance) || isEmpty(inputDistance)) {
        return ReS(res, {message: 'please provide valid distance'}, 400)
    }
    
    // if(!Number(distance)){
    //     return ReS(res, {message: "please provide valid distance"}, 400);
    // }
    
    var distance = parseFloat(inputDistance.replace(/,/g, ''))
    
    let travelledDistance = 0
    
    switch (tyre) {
        case CONFIG.TruckTypeCapacities[0]:
            travelledDistance = 400 / 24
            break
        case CONFIG.TruckTypeCapacities[1]:
            travelledDistance = 400 / 24
            break
        case CONFIG.TruckTypeCapacities[2]:
            travelledDistance = 350 / 24
            break
        case CONFIG.TruckTypeCapacities[3]:
            travelledDistance = 300 / 24
            break
        case CONFIG.TruckTypeCapacities[4]:
            travelledDistance = 275 / 24
            break
        case CONFIG.TruckTypeCapacities[5]:
            travelledDistance = 250 / 24
            break
        case CONFIG.TruckTypeCapacities[6]:
            travelledDistance = 225 / 24
            break
        case CONFIG.TruckTypeCapacities[7]:
            travelledDistance = 300 / 24
            break
        case CONFIG.TruckTypeCapacities[8]:
            travelledDistance = 350 / 24
            break
        case CONFIG.TruckTypeCapacities[9]:
            travelledDistance = 300 / 24
            break
        default:
            var message = false
            break
    }
    
    if (message == false) {
        return ReE(res, {
            message: 'Please provide valid truck subtype',
        }, 400)
    }
    
    var one_day = 3600 //1 hour
    let fareEstimate = (distance / travelledDistance) * (one_day)
    
    var hours = Math.floor(fareEstimate / (60 * 60))
    
    var divisor_for_minutes = fareEstimate % (60 * 60)
    var minutes = Math.floor(divisor_for_minutes / 60)
    
    var divisor_for_seconds = divisor_for_minutes % 60
    var seconds = Math.ceil(divisor_for_seconds)
    
    let converedtIsoDate = moment.utc(inputDate).add(hours, 'hours').format()
    
    let day = 0
    var j = 0
    for (var i = 24; i <= hours; j++) {
        day = day + 1
        hours = hours - 24
    }
    if (12 < hours) {
        day = day + 1
    }
    
    if (inputDate) {
        return ReS(res,
            {
                estimate: {
                    time: (
                        (1 == day) ? (day + ' day') : (1 < day) ? (day +
                            ' days') :
                            (0 < hours) ? (hours + ' hours') : ''),
                    estimatedDelivery: converedtIsoDate,
                },
            }, 200)
    } else {
        return ReS(res, {
            estimate:
                {
                    time: (
                        (1 == day) ? (day + ' day') : (1 < day) ? (day +
                            ' days') :
                            (0 < hours) ? (hours + ' hours') : ''),
                },
        }, 200)
    }
    
}
module.exports.getEstimatedTime = getEstimatedTime

const getAllCargoes = async function (req, res) {
    
    let user = req.user
    //let mode = req.query.mode
    let page = req.query.page || 1
    let limit = req.query.limit || 10

    let err, cargoes

    console.log(user._id)
    
    if (!ObjectId.isValid(user._id)) {
        return ReE(res, {message: 'user id is wrong'}, 400)
    }

    let options = {
        //mode: mode,
        page: page,
        limit: limit,
        populate: [
            {
                path: 'shipper', 
                select: 'name phone _id'
            },
            {
                path: 'carrier',
                select: 'name phone _id'
            },
            {
                path: 'truck',
                select: 'name registrationNumber transportName _id type subtype',
            },
            {
                path: 'driver', 
                select: 'name phone'
            }
        ],
        sort: {
                createdAt: 'desc',
        }, 
    };

    // [err, cargoes] = await to(Cargo.paginate({
    //     shipper: new ObjectId(user._id),
    // }, options))

    [err, cargoes] = await to(Cargo.paginate({}, options))
    
    
    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, {cargoes: cargoes}, HttpStatus.OK)
    }
}
module.exports.getAllCargoes = getAllCargoes