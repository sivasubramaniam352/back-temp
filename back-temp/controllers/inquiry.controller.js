const {User, Cargo, Inquiry, Truck, Trucktype} = require('../models')
const {to, ReE, ReS, isNull, formatLocation, isEmpty} = require(
    '../services/util.service')
const {ObjectId} = require('mongoose').Types
const CONFIG = require('../config/config')
const validator = require('validator')
const shortid = require('shortid')
shortid.characters(
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#*')
// const {isISO8601} = validator
const HttpStatus = require('http-status')
const {getNextSequence} = require('../services/util.service')
const {setTruckAvailability} = require('./truck.controller')
const {sendNotification} = require('./notification.controller')
const mdistanceMultiplier = 0.001
const {createNotification} = require('./notification.controller')

const create = async function (req, res) {
    const shipper = req.user
    const reqCargo = req.body
    
    if (!req.user.type.includes('shipper')) {
        return ReE(res,
            {message: 'Unable to process. You need to be a shipper to create inquiry.'},
            HttpStatus.FORBIDDEN)
    }
    
    if (isNull(reqCargo.fromAddress1)) {
        return ReE(res, {message: 'Please provide a from Address'}, 400)
    }
    
    if (isNull(reqCargo.fromCity)) {
        return ReE(res, {message: 'Please provide a from City'}, 400)
    }
    
    if (isNull(reqCargo.toAddress1)) {
        return ReE(res, {message: 'Please provide a to Address'}, 400)
    }
    
    if (isNull(reqCargo.toCity)) {
        return ReE(res, {message: 'Please provide a to City'}, 400)
    }
    
    if (isNull(reqCargo.proposedFare)) {
        return ReE(res, {message: 'Please provide a proposedFare'},
            HttpStatus.BAD_REQUEST)
    }
    
    if (isNull(reqCargo.subtype)) {
        return ReE(res, {message: 'Please provide a valid subtype'}, 400)
    }
    
    let err, truckType;
    [err, truckType] = await to(Trucktype.findOne({
        'subtypes._id': reqCargo.subtype,
    }))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!truckType) {
        return ReE(res, {message: 'Cannot find specified truckType.'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    var existingSubtype = truckType.subtypes.id(reqCargo.subtype)
    
    if (!existingSubtype) {
        return ReE(res, {message: 'Cannot find specified subtype.'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    reqCargo.type = {}
    reqCargo.type.id = truckType._id
    reqCargo.type.subtype = existingSubtype._id
    reqCargo.type.displayName = `${existingSubtype.displayName} | ${truckType.displayName}`
    
    console.log(reqCargo)
    
    if ((isNull(reqCargo.requestedPickupTime)) ||
        (!validator.isISO8601(reqCargo.requestedPickupTime))) {
        return ReE(res, {message: 'Please provide a valid requestedPickupTime'},
            400)
    }
    
    if ((isNull(reqCargo.estimatedDeliveryTime)) ||
        (!validator.isISO8601(reqCargo.estimatedDeliveryTime))) {
        return ReE(res,
            {message: 'Please provide a valid estimatedDeliveryTime'}, 400)
    }
    
    if (typeof reqCargo.fromLocation !== 'undefined' &&
        reqCargo.fromLocation !== '') {
        
        if (typeof reqCargo.fromLocation.latitude === 'undefined' ||
            typeof reqCargo.fromLocation.longitude === 'undefined') {
            return ReE(res, {message: 'Please provide a starting location.'},
                400)
        }
        
        if (!validator.isLatLong(
            reqCargo.fromLocation.latitude.toString() + ',' +
            reqCargo.fromLocation.longitude.toString())) {
            return ReE(res, {message: 'Invalid starting location'}, 400)
        }
        
        reqCargo.fromLocation = [
            parseFloat(reqCargo.fromLocation.longitude),
            parseFloat(reqCargo.fromLocation.latitude)]
    }
    
    if (typeof reqCargo.toLocation !== 'undefined' && reqCargo.toLocation !==
        '') {
        
        if (typeof reqCargo.toLocation.latitude === 'undefined' ||
            typeof reqCargo.toLocation.longitude === 'undefined') {
            return ReE(res, {message: 'Please provide a destination location.'},
                400)
        }
        
        if (!validator.isLatLong(reqCargo.toLocation.latitude.toString() + ',' +
            reqCargo.toLocation.longitude.toString())) {
            return ReE(res, {message: 'Invalid destination location'}, 400)
        }
        
        reqCargo.toLocation = [
            parseFloat(reqCargo.toLocation.longitude),
            parseFloat(reqCargo.toLocation.latitude)]
    }
    
    [err, cargoCount] = await to(getNextSequence('Cargo'))
    
    if (err) {
        console.log('Unable to get count for cargo')
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    reqCargo.readableId = 'WFO' + `${cargoCount.seq}`.padStart(8, '0')
    reqCargo.shipper = req.user._id
    
    let cargo;
    
    [err, cargo] = await to(Cargo.create(reqCargo))
    if (err) {
        return ReE(res, err, 500)
    }
    
    console.log('Cargo created', cargo)
    
    try {
        var searchLocation = formatLocation(reqCargo.fromLocation)
        
    } catch (e) {
        console.log(e)
        return ReE(res, 'Invalid pickup location format.',
            HttpStatus.BAD_REQUEST)
    }
    
    // console.log("Search location", searchLocation)
    var limit = reqCargo.limit
    
    var query = [
        {
            '$geoNear': {
                'near': searchLocation,
                'distanceField': 'dis',
                'maxDistance': (parseInt(CONFIG.default_radius) * 1000),
                'distanceMultiplier': mdistanceMultiplier,
                'limit': limit || 1024,
                'spherical': true,
            },
        },
        {
            '$project': {
                _id: 1,
                'name': 1,
                registrationNumber: 1,
                vendor: 1,
                'subtype': '$type.subtype',
                'readyToAssign': 1,
                'disabled': 1,
            },
        },
        {
            '$match': {
                'subtype': new ObjectId(existingSubtype._id),
                'vendor': {
                    '$ne': req.user._id,
                },
                'readyToAssign': true,
                'disabled': false,
                // 'drivers': {$exists: true, $not: {$size: 0}},
                // 'cargo': {
                //     '$size': 0,
                // },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'vendor',
                foreignField: '_id',
                as: 'vendor',
            },
        },
        {$unwind: {path: '$vendor'}},
        {
            '$sort': {
                'dis': 1,
            },
        },
        {
            '$group': {
                '_id': '$vendor', 'trucks': {'$push': '$_id'},
            },
        },
    ]
    
    // console.log('query: ', JSON.stringify(query, null, '\t'))
    
    var vendors;
    [err, vendors] = await to(Truck.aggregate(query))
    
    if (err) {
        console.log(err)
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    
    // console.log('vendors matched', vendors)
    
    let newInquiry = {
        cargo: cargo,
        shipper: req.user._id,
        proposedFare: cargo.proposedFare,
        matchedCarriers: [],
    }
    
    vendors.map(vendor => {
        newInquiry.matchedCarriers.push(
            {
                id: vendor._id._id,
                shipperProposedFare: cargo.proposedFare,
                trucks: vendor.trucks,
            })
    })
    
    // console.log('newInquiry', newInquiry)
    
    var inquiry;
    [err, inquiry] = await to(Inquiry.create(newInquiry))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    inquiry.matchedCarriers.map(async carrier => {
        
        cargo.carrier = carrier.id
        
        try {
            await generateInquiryNotification(carrier.status, cargo, inquiry,
                req.user)
        } catch (err) {
            console.log(err.message)
        }
        
    })
    
    return ReS(res,
        {message: 'Inquiry created.', inquiry: inquiry},
        HttpStatus.OK)
    
}
module.exports.create = create

async function generateInquiryNotification (status, cargo, inquiry, user) {
    
    let shipper = cargo.shipper
    let carrier = cargo.carrier
    let err, options, notification
    
    switch (status) {
        
        case 'CREATED':
            options = {
                carrier: carrier,
                shipper: shipper,
                from: shipper,
                to: carrier,
                title: CONFIG.NotificationMessages.NEW_INQUIRY.title,
                body: CONFIG.NotificationMessages.NEW_INQUIRY.body,
                inquiry: inquiry._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'carrier'
            
            sendNotification(carrier, options)
            
            return notification
            break
        case 'SHIPPER_PENDING':
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.INQUIRY_SHIPPER_PENDING.title,
                body: CONFIG.NotificationMessages.INQUIRY_SHIPPER_PENDING.body,
                inquiry: inquiry._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            break
        case 'CARRIER_PENDING':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: shipper,
                to: carrier,
                title: CONFIG.NotificationMessages.INQUIRY_CARRIER_PENDING.title,
                body: CONFIG.NotificationMessages.INQUIRY_CARRIER_PENDING.body,
                inquiry: inquiry._id,
            };
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'carrier'
            
            sendNotification(carrier, options)
            
            return notification
            break
        case 'ACCEPTED':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: shipper,
                to: carrier,
                title: CONFIG.NotificationMessages.INQUIRY_ACCEPTED.title,
                body: CONFIG.NotificationMessages.INQUIRY_ACCEPTED.body,
                inquiry: inquiry._id,
            }
            
            if (shipper._id.equals(user._id)) {
                
                console.log('from shipper')
                options.from = shipper
                options.to = carrier
                options.mode = 'carrier'
                console.log('options', options)
                sendNotification(carrier, options)
            } else if (carrier._id.equals(user._id)) {
                console.log('from carrier')
                options.from = carrier
                options.to = shipper
                options.mode = 'shipper'
                console.log('options', options)
                sendNotification(shipper, options)
            } else {
                console.log('no match')
            }
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            return notification
            break
        case 'CANCELLED':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: carrier,
                to: shipper,
                title: CONFIG.NotificationMessages.INQUIRY_CANCELLED.title,
                body: CONFIG.NotificationMessages.INQUIRY_CANCELLED.body,
                inquiry: inquiry._id,
            }
            
            if (shipper._id.equals(user._id)) {
                
                console.log('from shipper')
                options.from = shipper
                options.to = carrier
                options.mode = 'carrier'
                console.log('options', options)
                sendNotification(carrier, options)
            } else if (carrier._id.equals(user._id)) {
                console.log('from carrier')
                options.from = carrier
                options.to = shipper
                options.mode = 'shipper'
                console.log('options', options)
                sendNotification(shipper, options)
            } else {
                console.log('no match')
            }
            
            [err, notification] = await to(createNotification(options))
            
            if (err) {
                throw new Error(`Cannot save notification: ${err.message}`)
            }
            
            options.mode = 'shipper'
            
            sendNotification(shipper, options)
            
            return notification
            
            break
        case 'EXPIRED':
            
            options = {
                carrier: carrier,
                shipper: shipper,
                from: shipper,
                to: carrier,
                title: CONFIG.NotificationMessages.INQUIRY_EXPIRED.title,
                body: CONFIG.NotificationMessages.INQUIRY_EXPIRED.body,
                inquiry: inquiry._id,
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
            
            options.mode = 'carrier'
            
            sendNotification(carrier, options)
            
            return notification
            break
        default:
            //"Do nothing"
            return
    }
}

const get = async function (req, res) {
    
    let user = req.user
    let mode = req.query.mode
    let inquiryId = req.params.id
    let err, inquiry
    
    if (!ObjectId.isValid(inquiryId)) {
        return ReE(res, {message: 'Please provide valid Inquiry id'},
            HttpStatus.BAD_REQUEST)
    }
    
    [err, inquiry] = await to(Inquiry.findById(inquiryId)
        .populate([
            {path: 'shipper', select: 'name phone _id'},
            {path: 'cargo'}]))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!inquiry) {
        return ReE(res, 'Inquiry not found', HttpStatus.BAD_REQUEST)
    }
    
    if (!user._id.equals(inquiry.shipper._id)) {
        
        var existingMatch = inquiry.matchedCarriers.find(c => {
            return user._id.equals(c.id)
        })
        
        if (!existingMatch) {
            return ReE(res,
                {message: 'You dont have access to request this inquiry.'},
                HttpStatus.FORBIDDEN)
        }
        
        console.log('existingMatch', existingMatch)
        
        inquiry.matchedCarriers = [existingMatch]
        
        if (!inquiry) {
            return ReE(res, 'Inquiry not found', HttpStatus.BAD_REQUEST)
        }
        
        return ReS(res,
            {inquiry: inquiry}, HttpStatus.OK)
        
    }
    
    if (!inquiry) {
        return ReE(res, 'Inquiry not found', HttpStatus.BAD_REQUEST)
    }
    
    return ReS(res,
        {inquiry: inquiry}, HttpStatus.OK)
    
}
module.exports.get = get
const getv2 = async function (req, res) {
    
    let user = req.user
    let mode = req.query.mode
    let inquiryId = req.params.id
    let err, inquiry
    
    if (!ObjectId.isValid(inquiryId)) {
        return ReE(res, {message: 'Please provide valid Inquiry id'},
            HttpStatus.BAD_REQUEST)
    }
    
    [err, inquiry] = await to(Inquiry.findById(inquiryId)
        .populate([
            {path: 'shipper', select: 'name phone _id'},
            {path: 'cargo'},
            {path: 'matchedCarriers.trucks'}]))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!inquiry) {
        return ReE(res, 'Inquiry not found', HttpStatus.BAD_REQUEST)
    }
    
    if (!user._id.equals(inquiry.shipper._id)) {
        
        var existingMatch = inquiry.matchedCarriers.find(c => {
            return user._id.equals(c.id)
        })
        
        if (!existingMatch) {
            return ReE(res,
                {message: 'You dont have access to request this inquiry.'},
                HttpStatus.FORBIDDEN)
        }
        
        console.log('existingMatch', existingMatch)
        
        inquiry.matchedCarriers = [existingMatch]
        
        if (!inquiry) {
            return ReE(res, 'Inquiry not found', HttpStatus.BAD_REQUEST)
        }
        
        return ReS(res,
            {inquiry: inquiry}, HttpStatus.OK)
        
    }
    
    return ReS(res,
        {inquiry: inquiry}, HttpStatus.OK)
    
}
module.exports.getv2 = getv2

const getAll = async function (req, res) {
    
    let mode = req.query.mode
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let user = req.user
    let err
    
    if (mode === 'shipper' || isNull(mode)) {
        
        if (!req.user.type.includes('shipper')) {
            return ReE(res,
                {message: 'Unable to process. You need to be a shipper to get shipper inquiries.'},
                HttpStatus.FORBIDDEN)
        }
        
        let inquiries
        
        let options = {
            page: page,
            limit: limit,
            populate: [
                {path: 'shipper', select: 'name phone _id'},
                {path: 'cargo'}],
            sort: {
                createdAt: 'desc',
            },
        };
        [err, inquiries] = await to(Inquiry.paginate({
            shipper: new ObjectId(user._id),
        }, options))
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        return ReS(res,
            {inquiries: inquiries}, HttpStatus.OK)
    } else if (mode === 'carrier') {
        if (!req.user.type.includes('carrier')) {
            return ReE(res,
                {message: 'Unable to process. You need to be a carrier to get carrier inquiries.'},
                HttpStatus.FORBIDDEN)
        }
        
        let inquiries
        
        let options = {
            page: page,
            limit: limit,
            populate: [
                {path: 'shipper', select: 'name phone _id'},
                {path: 'cargo'}],
            sort: {
                createdAt: 'desc',
            },
        }
        
        let query = [
            {
                $unwind: '$matchedCarriers',
            },
            {
                $match: {
                    'matchedCarriers.id': new ObjectId(user._id),
                    $or: [
                        {'matchedCarriers.ignored': {'$exists': false}},
                        {'matchedCarriers.ignored': false}],
                },
            },
            {
                $lookup: {
                    from: 'cargos',
                    localField: 'cargo',
                    foreignField: '_id',
                    as: 'cargo',
                    
                },
                
            },
            {
                $unwind: '$cargo',
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'shipper',
                    foreignField: '_id',
                    as: 'shipper',
                    
                },
                
            },
            {
                $unwind: '$shipper',
            },
            {
                $group: {
                    _id: '$_id',
                    'status': {
                        $first: '$status',
                    },
                    'cargo': {
                        $first: '$cargo',
                    },
                    'shipper': {
                        $first: '$shipper',
                    },
                    'matchedCarriers': {
                        '$push': '$matchedCarriers',
                    },
                    'createdAt': {
                        $first: '$createdAt',
                    },
                    'updatedAt': {
                        $first: '$updatedAt',
                    },
                    
                },
            },
            {
                $project: {
                    status: 1,
                    cargo: 1,
                    'shipper.name': '$shipper.name',
                    'shipper._id': '$shipper._id',
                    'shipper.email': '$shipper.email',
                    matchedCarriers: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    
                },
            },
            
        ];
        [err, inquiries] = await to(
            Inquiry.aggregatePaginate(Inquiry.aggregate(query), options))
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        return ReS(res,
            {inquiries: inquiries}, HttpStatus.OK)
        
    }
    
}
module.exports.getAll = getAll

const update = async function (req, res) {
    
    let err, inquiry, data
    const id = req.params.id
    const mId = req.params.mId
    const selectedTruck = req.body.truck
    data = req.body
    
    if (!ObjectId.isValid(id)) {
        return ReE(res, {message: 'Please provide a valid id'},
            HttpStatus.BAD_REQUEST)
    }
    
    [err, inquiry] = await to(Inquiry.findById(id))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!inquiry) {
        return ReE(res, {message: 'Cannot find Inquiry with that id'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    var existingMatch = inquiry.matchedCarriers.id(mId)
    
    if (!existingMatch) {
        return ReE(res, {message: 'Cannot find specified match.'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    console.log('existingMatch', existingMatch)
    
    CONFIG.editableMatchFields.forEach(function (field) {
        if (typeof field === 'string' && data[field] !== undefined) {
            existingMatch[field] = data[field]
        }
    })
    let cargo
    
    [err, cargo] = await to(Cargo.findById(new ObjectId(inquiry.cargo)))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!cargo) {
        return ReE(res, 'Unable update inquiry. Cargo not found.',
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (data.status === 'ACCEPTED') {
        
        if (isNull(existingMatch.carrierProposedFare)) {
            existingMatch.carrierProposedFare = existingMatch.shipperProposedFare
        }
        
        inquiry.acceptedFare = existingMatch.carrierProposedFare
        inquiry.status = 'ACCEPTED'
        
        cargo.status = 'ACCEPTED'
        cargo.acceptedFare = existingMatch.carrierProposedFare
        cargo.carrier = existingMatch.id
        
        console.log('existingMatch', existingMatch)
        
        if (!isNull(selectedTruck)) {
            let found = existingMatch.trucks.find(t => t == selectedTruck)
            
            console.log('found', found)
            
            if (!found) {
                return ReE(res,
                    {message: 'Please provide a valid truck id to accept inquiry.'},
                    HttpStatus.BAD_REQUEST)
                
            }
            
            cargo.truck = found
        } else {
            console.log('No truck selected, Automatically assigning truck')
            cargo.truck = existingMatch.trucks[0]
        }
        
        let truck;
        [err, truck] = await to(Truck.findById(new ObjectId(cargo.truck)))
        
        if (err) {
            console.log('Cannot assign cargo to truck')
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        if (!truck) {
            return ReE(res, 'Unable to update inquiry. Truck not found.',
                HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        let existingCargo = truck.cargo[0]
        
        console.log('existingCargo', existingCargo)
        
        if (existingCargo) {
            
            console.log('before truck', truck)
            
            // if (previousStatuses.indexOf(existingCargo.status) === -1) {
            //     console.log('Truck in use, cannot accept inquiry.')
            //     return ReE(res,
            //         "Truck already in use, unable to accept inquiry.",
            //         HttpStatus.INTERNAL_SERVER_ERROR)
            // }
            
            truck = setTruckAvailability(truck, existingCargo)
            
            if (!truck.readyToAssign) {
                return ReE(res,
                    'Truck already in use, unable to accept inquiry.',
                    HttpStatus.INTERNAL_SERVER_ERROR)
            } else {
                truck.cargo.pull(new ObjectId(cargo._id))
                truck.cargo.addToSet(cargo)
            }
            
            console.log('after truck', truck)
            
            return
        } else {
            
            truck.cargo.addToSet(cargo)
            
            let otherMatches = inquiry.matchedCarriers.filter(
                match => {
                    return match._id.toString() !== mId
                })
            
            otherMatches.map(m => {
                m.status = 'EXPIRED'
            })
            
            console.log('otherMatches', otherMatches);
            
            [err, cargo] = await to(cargo.save())
            if (err) {
                console.log('Unable to save cargo when accepting quote.')
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            truck = setTruckAvailability(truck, cargo)
            console.log(truck);
            
            [err, truck] = await to(truck.save())
            if (err) {
                console.log('Unable to save truck when accepting quote.')
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
        }
        
    } else if (data.status === 'CARRIER_PENDING') {
        cargo.carrier = existingMatch.id
    }
    
    console.log('inquiry', inquiry);
    
    [err, inquiry] = await to(inquiry.save())
    
    if (isNull(data.ignored)) {
        
        try {
            await generateInquiryNotification(existingMatch.status, cargo,
                inquiry,
                req.user)
        } catch (err) {
            console.log(err.message)
        }
    }
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    return ReS(res,
        {message: 'Inquiry updated', inquiry: inquiry},
        HttpStatus.OK)
    
}
module.exports.update = update

const updatev2 = async function (req, res) {
    
    let err, inquiry, data
    const id = req.params.id
    const mId = req.params.mId
    const selectedTruck = req.body.truck
    data = req.body
    
    if (!ObjectId.isValid(id)) {
        return ReE(res, {message: 'Please provide a valid id'},
            HttpStatus.BAD_REQUEST)
    }
    
    let existingInquiry;
    [err, existingInquiry] = await to(Inquiry.findById(id))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!existingInquiry) {
        return ReE(res, {message: 'Cannot find Inquiry with that id'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    [err, inquiry] = await to(Inquiry.findOneAndUpdate({
            _id: new ObjectId(id),
            processing: false,
        },
        {processing: true},
        {new: true},
    ))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!inquiry) {
        return ReE(res,
            {message: 'Inquiry is being processed. Please try again later.'},
            HttpStatus.CONFLICT)
    }
    
    if (inquiry.processing === true) {
        console.log('Inquiry is being processed. Please try again later.')
    } else {
        console.log('Inquiry available to process.')
    }
    
    console.log('inquiry', inquiry)
    
    var existingMatch = inquiry.matchedCarriers.id(mId)
    
    if (!existingMatch) {
        
        inquiry.processing = false;
        
        [err, inquiry] = await to(inquiry.save())
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        return ReE(res, {message: 'Cannot find specified match.'},
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    console.log('existingMatch', existingMatch)
    
    CONFIG.editableMatchFields.forEach(function (field) {
        if (typeof field === 'string' && data[field] !== undefined) {
            existingMatch[field] = data[field]
        }
    })
    let cargo
    
    [err, cargo] = await to(Cargo.findById(new ObjectId(inquiry.cargo)))
    
    if (err) {
        inquiry.processing = false;
        
        [err, inquiry] = await to(inquiry.save())
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!cargo) {
        
        inquiry.processing = false;
        
        [err, inquiry] = await to(inquiry.save())
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        return ReE(res, 'Unable update inquiry. Cargo not found.',
            HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (data.status === 'ACCEPTED') {
        
        if (isNull(existingMatch.carrierProposedFare)) {
            existingMatch.carrierProposedFare = existingMatch.shipperProposedFare
        }
        
        inquiry.acceptedFare = existingMatch.carrierProposedFare
        inquiry.status = 'ACCEPTED'
        
        cargo.status = 'ACCEPTED'
        cargo.acceptedFare = existingMatch.carrierProposedFare
        cargo.carrier = existingMatch.id
        
        console.log('existingMatch', existingMatch)
        
        if (!isNull(selectedTruck)) {
            let found = existingMatch.trucks.find(t => t == selectedTruck)
            
            console.log('found', found)
            
            if (!found) {
                
                inquiry.processing = false;
                
                [err, inquiry] = await to(inquiry.save())
                
                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                
                return ReE(res,
                    {message: 'Please provide a valid truck id to accept inquiry.'},
                    HttpStatus.BAD_REQUEST)
                
            }
            
            cargo.truck = found
        } else {
            console.log('No truck selected, Automatically assigning truck')
            cargo.truck = existingMatch.trucks[0]
        }
        
        let truck;
        [err, truck] = await to(Truck.findById(new ObjectId(cargo.truck)))
        
        if (err) {
            
            inquiry.processing = false;
            
            [err, inquiry] = await to(inquiry.save())
            
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            console.log('Cannot assign cargo to truck')
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        if (!truck) {
            
            inquiry.processing = false;
            
            [err, inquiry] = await to(inquiry.save())
            
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            return ReE(res, 'Unable to update inquiry. Truck not found.',
                HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        let existingCargo = truck.cargo[0]
        
        console.log('existingCargo', existingCargo)
        
        if (existingCargo) {
            
            console.log('before truck', truck)
            
            // if (previousStatuses.indexOf(existingCargo.status) === -1) {
            //     console.log('Truck in use, cannot accept inquiry.')
            //     return ReE(res,
            //         "Truck already in use, unable to accept inquiry.",
            //         HttpStatus.INTERNAL_SERVER_ERROR)
            // }
            
            truck = setTruckAvailability(truck, existingCargo)
            
            if (!truck.readyToAssign) {
                
                inquiry.processing = false
                
                console.log('ta inqui', inquiry);
                
                [err, inquiry] = await to(inquiry.save())
                
                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                
                return ReE(res,
                    'Truck already in use, unable to accept inquiry.',
                    HttpStatus.INTERNAL_SERVER_ERROR)
            } else {
                truck.cargo.pull(new ObjectId(cargo._id))
                truck.cargo.addToSet(cargo)
            }
            
            console.log('after truck', truck)
            
            return
        } else {
            
            truck.cargo.addToSet(cargo)
            
            let otherMatches = inquiry.matchedCarriers.filter(
                match => {
                    return match._id.toString() !== mId
                })
            
            otherMatches.map(m => {
                m.status = 'EXPIRED'
            })
            
            console.log('otherMatches', otherMatches);
            
            [err, cargo] = await to(cargo.save())
            if (err) {
                
                console.log('Unable to save cargo when accepting quote.')
                
                inquiry.processing = false;
                
                [err, inquiry] = await to(inquiry.save())
                
                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
            truck = setTruckAvailability(truck, cargo)
            console.log(truck);
            
            [err, truck] = await to(truck.save())
            if (err) {
                console.log('Unable to save truck when accepting quote.')
                
                inquiry.processing = false;
                
                [err, inquiry] = await to(inquiry.save())
                
                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            
        }
        
    } else if (data.status === 'CARRIER_PENDING') {
        cargo.carrier = existingMatch.id
    }
    
    console.log('inquiry', inquiry)
    
    if (isNull(data.ignored)) {
        
        try {
            await generateInquiryNotification(existingMatch.status, cargo,
                inquiry,
                req.user)
        } catch (err) {
            console.log(err.message)
        }
    }
    
    inquiry.processing = false;
    
    [err, inquiry] = await to(inquiry.save())
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    return ReS(res,
        {message: 'Inquiry updated', inquiry: inquiry},
        HttpStatus.OK)
    
}
module.exports.updatev2 = updatev2

const getAllInquiry = async function (req, res) {
    
    //let mode = req.query.mode
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let user = req.user
    let err, inquiries
    
    let options = {
        page: page,
        limit: limit,
        populate: [
            {
                path: 'shipper', 
                //select: 'name phone _id'
            },
            {
                path: 'carrier'
            }
        ],
        sort: {
            createdAt: 'desc',
        },
    };
    
    [err, inquiries] = await to(Inquiry.paginate({}, options))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    return ReS(res,
        {inquiries: inquiries}, HttpStatus.OK)

}
module.exports.getAllInquiry = getAllInquiry
