const { User, Cargo, Truck, Driver, Trucktype } = require('../models')
const authService = require('../services/auth.service')
const { to, ReE, ReS, isNull, isEmpty, formatLocation } = require(
    '../services/util.service')
const { ObjectId } = require('mongoose').Types
const CONFIG = require('../config/config')
const shortid = require('shortid')
const validator = require('validator')
const crypto = require('crypto')
const maps = require('@google/maps')
const HttpStatus = require('http-status')

const googleMapsClient = maps.createClient({
    key: CONFIG.googleMap_key,
})

const add = async function (req, res) {

    let name = req.body.name
    let registrationNumber = req.body.registrationNumber
    let truckSubType = req.body.subtype
    let location = req.body.location
    let photo = req.body.photoURL
    let drivers = req.body.drivers

    if (isNull(name) || name.toString().trim().length < 3) {
        return ReE(res, 'Please enter a name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(registrationNumber)) {
        return ReE(res, { message: 'Please provide a registration number' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(registrationNumber)) {
        return ReE(res, { message: 'Please provide a registration number' },
            HttpStatus.BAD_REQUEST)
    }

    if (!ObjectId.isValid(truckSubType)) {
        return ReE(res, { message: 'Please enter a valid subtype Id.' },
            HttpStatus.BAD_REQUEST)
    }

    let err, truckType;
    [err, truckType] = await to(Trucktype.findOne({
        'subtypes._id': truckSubType,
    }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!truckType) {
        return ReE(res, { message: 'Cannot find specified truckType.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    var existingSubtype = truckType.subtypes.id(truckSubType)

    if (!existingSubtype) {
        return ReE(res, { message: 'Cannot find specified subtype.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    console.log('Valid')

    let newTruck = {
        name: name,
        registrationNumber: registrationNumber,
        vendor: req.user._id,
        'type.id': truckType._id,
        'type.subtype': existingSubtype._id,
        'type.displayName': `${existingSubtype.displayName} | ${truckType.displayName}`,
        drivers: [],
    }

    if (!isNull(location)) {

        if (isNull(location.latitude) ||
            isNull(location.longitude)) {
            return ReE(res, { message: 'latitude/longitude not entered' },
                HttpStatus.BAD_REQUEST)
        }

        if (!validator.isLatLong(location.latitude.toString() + ',' +
            location.longitude.toString())) {
            return ReE(res, { message: 'Invalid latitude or longitude' },
                HttpStatus.BAD_REQUEST)
        }

        newTruck.lastLocation = [location.longitude, location.latitude]
    }

    let foundDrivers = []
    if (!isNull(drivers) && drivers.length !== 0) {

        let driverIds = []
        try {
            drivers.map(driver => {
                try {
                    driverIds.push(new ObjectId(driver))
                } catch (e) {
                    throw new Error('One or more driver Id is Invalid.')
                }
            })

        } catch (err) {
            return ReE(res, err,
                HttpStatus.BAD_REQUEST)
        }

        [err, foundDrivers] = await to(Driver.find({ _id: { $in: driverIds } }))
        if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

        foundDrivers.map(d => {
            newTruck.drivers.push(d._id)
        })

    }

    let existingTruck, truck;
    [err, existingTruck] = await to(
        Truck.findOne({ registrationNumber: registrationNumber }))

    if (existingTruck) {
        console.log('Truck with that registration number already exists.')

        if (existingTruck.disabled === false) {
            return ReE(res, {
                message: 'Truck with that Registration number already exists. Please verify your truck number and try again.',
            }, HttpStatus.BAD_REQUEST)
        }

        existingTruck.disabled = false
        existingTruck.drivers = foundDrivers
        console.log(existingTruck);

        [err, existingTruck] = await to(existingTruck.save())

        if (err) {
            return ReS(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

    } else {
        newTruck.drivers = foundDrivers

        if (foundDrivers.length !== 0) {
            newTruck.readyToAssign = true
        }
        console.log(newTruck);

        [err, truck] = await to(Truck.create(newTruck))
        if (err) {
            return ReS(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

        }

    }

    let driverTruck = truck || existingTruck

    if (foundDrivers.length !== 0) {
        foundDrivers.map(async d => {
            d.truck = driverTruck._id
            var driver;
            [err, driver] = await to(d.save())
        })
    }

    return ReS(res, { message: 'Truck added.', truck: truck }, HttpStatus.OK)

}
module.exports.add = add

const getTrucks = async function (req, res) {

    let from = req.query.from
    let user = req.user

    let err, trucks

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }

    let query = {
        'vendor': user._id,
        disabled: false,
    }

    if (from === 'MAP') {
        console.log('Query from map, prevent showing trucks at 0,0')
        query.lastLocation = { $ne: [0, 0] }
    }

    [err, trucks] = await to(Truck.find(query)
        .populate({ path: 'driver vendor', select: 'name email _id phone' })
        .populate({
            path: 'cargo',
            select: 'fromLocation toLocation fromAddress1 fromCity toAddress1 toCity',
        })
        .sort({ createdAt: -1 }))

    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, { message: 'Trucks list', trucks: trucks }, HttpStatus.OK)
    }

}
module.exports.getTrucks = getTrucks

const getTruck = async function (req, res) {

    let truckId = req.params.id
    let user = req.user
    let err, truck

    if (!ObjectId.isValid(truckId)) {
        return ReE(res, { message: 'please provide valid Truck id' }, 400)
    }
    ;

    [err, truck] = await to(Truck.findOne(
        {
            '_id': truckId,
            // disabled: false,
        })
        .populate({ path: 'drivers vendor', select: 'name email phone _id' })
        .populate({
            path: 'cargo',
            select: 'fromLocation toLocation fromAddress1 fromCity toAddress1 toCity',
        }))

    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    } else {
        if (truck) {

            return ReS(res, { message: 'Truck found', truck: truck },
                HttpStatus.OK)

        } else {
            return ReE(res, { message: 'Truck not found' },
                HttpStatus.BAD_REQUEST)
        }

    }

}
module.exports.getTruck = getTruck

const updateTruck = async function (req, res) {
    let err, user, data, updatedTruck, truck, driver, truckData
    user = req.user
    const userId = user._id
    data = req.body

    let truckId = req.params.id

    if (!ObjectId.isValid(truckId)) {
        return ReE(res, { message: 'please provide valid Truck id' }, 400)
    }

    if (typeof data.location !== 'undefined' && data.location !== '') {

        if (typeof data.location.latitude === 'undefined' ||
            typeof data.location.longitude === 'undefined') {
            return ReE(res, { message: 'latitude/longitude not entered' }, 400)
        }

        if (!validator.isLatLong(data.location.latitude.toString() + ',' +
            data.location.longitude.toString())) {
            return ReE(res, { message: 'Invalid latitude or longitude' }, 400)
        }

        data.lastLocation = [data.location.longitude, data.location.latitude]
    }
    ;

    [err, truck] = await to(
        Truck.findOne({ _id: new ObjectId(truckId) }).populate('cargo'))
    if (err) {
        return ReE(res, err, 400)
    } else {

        if (truck) {

            if (!isNull(data.subtype)) {

                let truckType;
                [err, truckType] = await to(Trucktype.findOne({
                    'subtypes._id': data.subtype,
                }))

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                if (!truckType) {
                    return ReE(res,
                        { message: 'Cannot find truckType with specified subtype.' },
                        HttpStatus.INTERNAL_SERVER_ERROR)
                }

                var existingSubtype = truckType.subtypes.id(data.subtype)

                if (!existingSubtype) {
                    return ReE(res, { message: 'Cannot find specified subtype.' },
                        HttpStatus.INTERNAL_SERVER_ERROR)
                }

                truck.type.id = truckType._id
                truck.type.subtype = existingSubtype._id
                truck.type.displayName = `${existingSubtype.displayName} | ${truckType.displayName}`

            }

            if (typeof data.driver !== 'undefined' && data.driver !== '') {

                if (!ObjectId.isValid(data.driver)) {
                    return ReE(res, { message: 'Please provide valid Driver id' },
                        400)
                }
                ;

                [err, driver] = await to(
                    Driver.findOne({ _id: new ObjectId(data.driver) }))
                if (err) return ReE(res, err, 400)
                else {
                    if (driver) {

                        data.driver = driver
                        driver.truck = new ObjectId(truck._id)
                        driver.save()

                    } else {
                        return ReE(res, { message: 'Driver is not found' }, 400)
                    }
                }
            }

            CONFIG.editableTruckFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    truck[field] = data[field]
                }
            })

            truck = setTruckAvailability(truck, truck.cargo[0]);

            // console.log(truck)

            [err, updatedTruck] = await to(truck.save())

            if (err) {

                console.log(err)

                if (err.code === 11000) {
                    return ReE(res,
                        'Truck with that registration number already exists. please contact support if this is your truck.',
                        422)
                }

                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }

            return ReS(res, { message: 'Truck Updated.' }, HttpStatus.OK)

        } else {
            return ReE(res, { message: 'Truck not found' },
                HttpStatus.BAD_REQUEST)
        }
    }
}
module.exports.updateTruck = updateTruck

const deleteTruck = async function (req, res) {

    let err, truck
    const id = req.params.id

    if (!ObjectId.isValid(id)) {
        return ReE(res, { message: 'Please provide a valid truck id' },
            HttpStatus.BAD_REQUEST)
    }

    [err, truck] = await to(Truck.findById(id))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!truck) {
        return ReE(res, { message: 'Truck not found' },
            HttpStatus.BAD_REQUEST)
    }

    truck.disabled = true;

    [err, truck] = await to(truck.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res, {
        message: 'Truck Deleted',
    })

}
module.exports.deleteTruck = deleteTruck

const assignDriver = async function (req, res) {
    let user = req.user
    const userId = user._id
    let drivers = req.body.drivers

    let truckId = req.params.id

    if (!ObjectId.isValid(truckId)) {
        return ReE(res, { message: 'please provide valid Truck id' }, 400)
    }

    let err, truck;

    [err, truck] = await to(
        Truck.findOne({ _id: new ObjectId(truckId) }).populate({ path: 'cargo' }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!truck) {
        return ReE(res, { message: 'Truck not found.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let driverIds = []
    try {
        drivers.map(driver => {
            try {
                driverIds.push(new ObjectId(driver))
            } catch (e) {
                throw new Error('One or more driver Id is Invalid.')
            }
        })

    } catch (err) {
        return ReE(res, err,
            HttpStatus.BAD_REQUEST)
    }
    let foundDrivers;
    [err, foundDrivers] = await to(Driver.find({ _id: { $in: driverIds } }))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    foundDrivers.map(async d => {

        d.truck = truck._id
        truck.drivers.addToSet(d._id)

        var editedD;

        [err, editedD] = await to(d.save())

        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

    })

    truck = setTruckAvailability(truck, truck.cargo[0])

    // console.log(truck)

    let editedTruck
    [err, editedTruck] = await to(truck.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        { message: 'Drivers added', truck: editedTruck },
        HttpStatus.OK)

}
module.exports.assignDriver = assignDriver

const removeDriver = async function (req, res) {
    let user = req.user
    const userId = user._id
    let drivers = req.body.drivers

    let truckId = req.params.id

    if (!ObjectId.isValid(truckId)) {
        return ReE(res, { message: 'Please provide a valid Truck id' },
            HttpStatus.BAD_REQUEST)
    }

    let err, truck;

    [err, truck] = await to(Truck.findOne({ _id: new ObjectId(truckId) }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!truck) {
        return ReE(res, { message: 'Truck not found.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let driverIds = []
    try {
        drivers.map(driver => {
            try {
                driverIds.push(new ObjectId(driver))
            } catch (e) {
                throw new Error('One or more driver Id is Invalid.')
            }
        })

    } catch (err) {
        return ReE(res, err,
            HttpStatus.BAD_REQUEST)
    }

    [err, foundDrivers] = await to(Driver.find({ _id: { $in: driverIds } }))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    foundDrivers.map(async d => {
        d.truck = undefined

        truck.drivers.pull(d._id)

        var editedD;

        [err, editedD] = await to(d.save())

        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

    })

    console.log(truck)

    let editedTruck;
    [err, editedTruck] = await to(truck.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        { message: 'Drivers removed', truck: editedTruck },
        HttpStatus.OK)

}
module.exports.removeDriver = removeDriver

const filterTruck = async function (req, res) {

    let keyword = req.query.keyword

    let err, trucks

    if (isNull(keyword) || isEmpty(keyword)) {
        return ReS(res, { message: 'please provide keyword' }, 400)
    }

    [err, trucks] = await to(Truck.find({
        '$or': [
            { 'name': { '$regex': '^' + keyword, '$options': 'gi' } },
            {
                'registrationNumber': {
                    '$regex': '^' + keyword,
                    '$options': 'gi',
                },
            }],
    }).select('_id name registrationNumber secret_code'))

    if (err) {
        return ReE(res, err, 400)
    } else {
        if (trucks) {
            if (trucks.length > 0) {
                return ReS(res, { message: 'Truck details are', trucks: trucks },
                    200)
            } else {
                return ReE(res, { message: 'Searching truck is not found' }, 400)
            }
        } else { return ReE(res, { message: 'Truck is not found' }, 400) }
    }

}
module.exports.filterTruck = filterTruck

function setTruckAvailability(truck, cargo) {

    if (truck.drivers.length === 0) {
        console.log('No drivers in truck - truck not ready')
        truck.readyToAssign = false
    } else {
        if (truck.cargo.length === 0) {
            console.log('No cargo but driver is present in truck - truck ready')
            truck.readyToAssign = true
        } else {

            console.log('Cargo', cargo)

            let previousStatuses = CONFIG.cargoStatuses.slice(0,
                CONFIG.cargoStatuses.indexOf('PAID'))

            const remainingStatuses = CONFIG.cargoStatuses.slice(
                CONFIG.cargoStatuses.indexOf('COMPLETED'))

            previousStatuses = previousStatuses.concat(remainingStatuses)
            // console.log('previous', previousStatuses)

            console.log('Cargo status', cargo.status)

            if (isNull(cargo.status)) {
                console.log(
                    'Invalid cargo status, Cannot set truck ready status')
            }

            if (previousStatuses.indexOf(cargo.status) === -1) {
                console.log(
                    'Cargo in use, driver is present in truck - truck not ready')
                truck.readyToAssign = false
            } else {
                console.log(
                    'Cargo present but not active in truck, Driver present - truck ready')
                truck.readyToAssign = true
            }

        }

    }

    return truck
}

module.exports.setTruckAvailability = setTruckAvailability

const googleMapAddress = async function (req, res) {

    const googleMapsAddress = maps.createClient({
        key: CONFIG.googleMap_key,
    })

    let address = req.query.address

    if (isNull(address) || isEmpty(address)) {
        return ReS(res, { message: 'please provide valid address' }, 400)
    }

    googleMapsAddress.geocode({
        address: address,
    }, function (err, response) {
        if (err) {
            return ReE(res, err, 400)
        } else {
            console.log(response)
            return ReS(res, { message: 'Address', result: response.json.results },
                200)
        }
    })
}
module.exports.googleMapAddress = googleMapAddress

const googleMapsLatlng = async function (req, res) {

    const googleMapsLatlng = maps.createClient({
        key: CONFIG.googleMap_key,
    })

    let latlng = req.query.latlng

    if (isNull(latlng) || isEmpty(latlng)) {
        return ReS(res, { message: 'please provide valid latitude/longitude' },
            400)
    }

    console.log(latlng)
    googleMapsLatlng.reverseGeocode({
        latlng: latlng,
        result_type: ['country', 'street_address', 'locality'],
    }, function (err, response) {

        // console.log("Call",err, response)

        console.log('response: ', JSON.stringify(response, null, '\t'))

        if (err) {
            return ReE(res, err, 400)
        } else {
            console.log('Response', response.json.status)

            if (response.json.status == 'OK') {

                console.log('res ok')
                var addressComponents = response.json.results[0].address_components

                var address = {
                    address1: addressComponents[0].long_name,
                    city: addressComponents[1].long_name,
                    fullAddress: response.json.results[0].formatted_address,
                }

                console.log('Address', address)

                return ReS(res, { message: 'Address found', address: address },
                    200)

            } else if (response.json.status == 'ZERO_RESULTS') {
                return ReE(res,
                    { message: 'No results ' }, 500)
            } else {
                return ReE(res,
                    { message: 'No results, Unknown error.' }, 500)
            }
        }
    })
}
module.exports.googleMapsLatlng = googleMapsLatlng

const getDistanceBetweenPoints = async function (req, res) {

    let startLocation = req.body.startLocation
    let endLocation = req.body.endLocation

    if (isEmpty(startLocation)) {
        return ReS(res, { message: 'Please provide a start location' }, 400)
    }

    if (isEmpty(endLocation)) {
        return ReS(res, { message: 'Please provide a end location' }, 400)
    }

    if (isNull(startLocation.latitude) ||
        isNull(startLocation.longitude)) {
        return ReE(res, { message: 'Start latitude/longitude not entered' },
            HttpStatus.BAD_REQUEST)
    }

    if (!validator.isLatLong(startLocation.latitude.toString() + ',' +
        startLocation.longitude.toString())) {
        return ReE(res, { message: 'Invalid Start latitude or longitude' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(endLocation.latitude) ||
        isNull(endLocation.longitude)) {
        return ReE(res, { message: 'End latitude/longitude not entered' },
            HttpStatus.BAD_REQUEST)
    }

    if (!validator.isLatLong(endLocation.latitude.toString() + ',' +
        endLocation.longitude.toString())) {
        return ReE(res, { message: 'Invalid End latitude or longitude' },
            HttpStatus.BAD_REQUEST)
    }

    var start = `${startLocation.latitude},${startLocation.longitude}`
    var end = `${endLocation.latitude},${endLocation.longitude}`

    googleMapsClient.distanceMatrix({
        origins: [start],
        destinations: [end],
    }, function (err, response) {

        if (err) {
            return ReE(res, err, 400)
        } else {
            console.log('Response', JSON.stringify(response, null, '\t'))

            var distanceElements = response.json.rows[0].elements

            console.log('distanceElements: ', distanceElements)

            if (response.json.status == 'OK') {

                if (distanceElements[0].status == 'ZERO_RESULTS') {
                    return ReE(res,
                        { message: 'No results ' }, 500)
                }

                return ReS(res, {
                    message: 'Calculated distance on road',
                    distanceMatrix: distanceElements,
                }, 200)

            } else if (response.json.status == 'ZERO_RESULTS') {
                return ReE(res,
                    { message: 'No results ' }, 500)
            } else {
                return ReE(res,
                    { message: 'No results, Unknown error.' }, 500)
            }
        }
    })
}
module.exports.getDistanceBetweenPoints = getDistanceBetweenPoints

const getNearbyTrucks = async function (req, res) {

    let err, trucks

    let latitude = req.query.latitude
    let longitude = req.query.longitude
    if (isNull(latitude) || isEmpty(latitude)) {
        return ReS(res, { message: 'please provide valid latitude' }, 400)
    }

    if (isNull(longitude) || isEmpty(longitude)) {
        return ReS(res, { message: 'please provide valid longitude' }, 400)
    }
    if (!Number(latitude)) {
        return ReS(res, { message: 'please provide a latitude in float/number' },
            400)
    }

    if (!Number(longitude)) {
        return ReS(res, { message: 'please provide a longitude in float/number' },
            400)
    }

    var Location = [parseFloat(longitude), parseFloat(latitude)]

    try {
        var userLocation = formatLocation(Location)

    } catch (e) {
        console.log(e)
        return ReE(res, 'Invalid location format.', HttpStatus.BAD_REQUEST)
    }
    var limit = 10
    const mdistanceMultiplier = 0.001

    var query = [
        {
            '$geoNear': {
                'near': userLocation,
                'distanceField': 'dis',
                'maxDistance': (parseInt(CONFIG.default_radius) * 1000),
                'distanceMultiplier': mdistanceMultiplier,
                'limit': limit || 1024,
                'spherical': true,
            },
        },
        {
            '$match': {
                // 'cargo': {
                //     '$size': 0,
                // },
                'readyToAssign': true,
                // 'drivers': {$exists: true, $not: {$size: 0}},
                // 'vendor': {
                //     '$ne': req.user._id,
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
        { $unwind: { path: '$vendor' } },
        {
            '$sort': {
                'dis': 1,
            },
        },
    ];

    // console.log('query: ', JSON.stringify(query, null, '\t'));

    [err, trucks] = await to(Truck.aggregate(query))
    if (err) {
        console.log(err)
        return ReE(res, err, 500)
    }

    if (!trucks) {
        return ReE(res, 'Cannot find Nearby trucks.', 500)
    }

    if (0 == trucks.length) {
        return ReE(res, 'There are no nearby trucks, please try again later.',
            500)
    }

    return ReS(res, { message: 'Found trucks nearby', nearbyTrucks: trucks }, 200)

}
module.exports.getNearbyTrucks = getNearbyTrucks

const getLiveLocation = async function (req, res) {

    let sharingId = req.params.id
    let user = req.user
    let err, truck

    if (!shortid.isValid(sharingId)) {
        return ReE(res, { message: 'Please provide a valid Sharing id' },
            HttpStatus.BAD_REQUEST)
    }

    let driver;

    [err, driver] = await to(
        Driver.findOne({ 'sharingId': sharingId }).populate({
            path: 'truck',
            select: ' lastLocation',
        }))

    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    if (!driver) {
        return ReE(res, { message: 'Cannot get live tracking for this id' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(driver.truck) || isEmpty(driver.truck)) {
        return ReE(res,
            { message: 'Live location currently unavailable. Please contact carrier.' },
            HttpStatus.BAD_REQUEST)
    }

    return ReS(res,
        { message: 'Location', lastLocation: driver.truck.lastLocation },
        HttpStatus.OK)

}
module.exports.getLiveLocation = getLiveLocation

//Admin

const addTruckAdmin = async function (req, res) {

    let name = req.body.name
    let registrationNumber = req.body.registrationNumber
    let truckSubType = req.body.subtype
    let location = req.body.location
    let photo = req.body.photoURL
    let drivers = req.body.drivers
    let userPhone = req.user.userPhone

    if (isNull(name) || name.toString().trim().length < 3) {
        return ReE(res, 'Please enter a name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(registrationNumber)) {
        return ReE(res, { message: 'Please provide a registration number' },
            HttpStatus.BAD_REQUEST)
    }

    if (!ObjectId.isValid(truckSubType)) {
        return ReE(res, { message: 'Please enter a valid subtype Id.' },
            HttpStatus.BAD_REQUEST)
    }

    let err, truckType;
    [err, truckType] = await to(Trucktype.findOne({
        'subtypes._id': truckSubType,
    }))

    if (!truckType) {
        return ReE(res, { message: 'Cannot find specified truckType.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    var existingSubtype = truckType.subtypes.id(truckSubType)

    if (!existingSubtype) {
        return ReE(res, { message: 'Cannot find specified subtype.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (isNull(userPhone)) {
        return ReE(res, { message: 'Please enter user phone number.' },
            HttpStatus.BAD_REQUEST)
    }

    let existingUser;
    [err, existingUser] = await to(User.findOne({
        'phone': userPhone,
    }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!existingUser) {
        return ReE(res, { message: 'Cannot find specified user account.' },
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    console.log('Valid')

    let newTruck = {
        name: name,
        registrationNumber: registrationNumber,
        vendor: existingUser._id,
        'type.id': truckType._id,
        'type.subtype': existingSubtype._id,
        'type.displayName': `${existingSubtype.displayName} | ${truckType.displayName}`,
        drivers: [],
    }

    if (!isNull(location)) {

        if (isNull(location.latitude) ||
            isNull(location.longitude)) {
            return ReE(res, { message: 'latitude/longitude not entered' },
                HttpStatus.BAD_REQUEST)
        }

        if (!validator.isLatLong(location.latitude.toString() + ',' +
            location.longitude.toString())) {
            return ReE(res, { message: 'Invalid latitude or longitude' },
                HttpStatus.BAD_REQUEST)
        }

        newTruck.lastLocation = [location.longitude, location.latitude]
    }

    let foundDrivers = []
    if (!isNull(drivers) && drivers.length !== 0) {

        let driverIds = []
        try {
            drivers.map(driver => {
                try {
                    driverIds.push(new ObjectId(driver))
                } catch (e) {
                    throw new Error('One or more driver Id is Invalid.')
                }
            })

        } catch (err) {
            return ReE(res, err,
                HttpStatus.BAD_REQUEST)
        }

        [err, foundDrivers] = await to(Driver.find({ _id: { $in: driverIds } }))
        if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

        foundDrivers.map(d => {
            newTruck.drivers.push(d._id)
        })

    }

    let existingTruck, truck;
    [err, existingTruck] = await to(
        Truck.findOne({ registrationNumber: registrationNumber }))

    if (existingTruck) {
        console.log('Truck with that registration number already exists.')

        if (existingTruck.disabled === false) {
            return ReE(res, {
                message: 'Truck with that Registration number already exists. Please verify your truck number and try again.',
            }, HttpStatus.BAD_REQUEST)
        }

        existingTruck.disabled = false
        existingTruck.drivers = foundDrivers
        console.log(existingTruck);

        [err, existingTruck] = await to(existingTruck.save())

        if (err) {
            return ReS(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

    } else {
        newTruck.drivers = foundDrivers

        if (foundDrivers.length !== 0) {
            newTruck.readyToAssign = true
        }
        console.log(newTruck);

        [err, truck] = await to(Truck.create(newTruck))
        if (err) {
            return ReS(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

        }

    }

    let driverTruck = truck || existingTruck

    if (foundDrivers.length !== 0) {
        foundDrivers.map(async d => {
            d.truck = driverTruck._id
            var driver;
            [err, driver] = await to(d.save())
        })
    }

    return ReS(res, { message: 'Truck added.', truck: truck }, HttpStatus.OK)

}
module.exports.addTruckAdmin = addTruckAdmin

const getAllTrucks = async function (req, res) {

    let user = req.user
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let userId = user._id
    let err, trucks

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }
    let errs, existingUser
    [errs, existingUser] = await to(User
        .findOne({ _id: new ObjectId(userId) })
        .select('admin role').populate({
            path: 'role',
            select: 'role'
        })
    )
    if (errs) {
        return ReE(res, { message: 'user not fount' }, 400)
    }
    else {
        let options = {
            page: page,
            limit: limit,
            populate: [
                { path: 'driver vendor', select: 'name email _id phone' },
                {
                    path: 'cargo',
                    select: 'fromLocation toLocation fromAddress1 fromCity toAddress1 toCity',
                }],
            sort: {
                createdAt: 'desc',
            },
        };

        [err, trucks] = await to(Truck.paginate({}, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            
            if ( existingUser.admin === true ||existingUser.role.role.write.includes('TRUCK')) {
                return ReS(res, { message: 'You have write access for this Truck page.',isEditable:true,trucks: trucks }, HttpStatus.OK)
            }
            else if (existingUser.role.role.read.includes('TRUCK')) {
                return ReS(res, { message: 'You have only read access for this Truck page.',isEditable:false,trucks: trucks }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: "You don't have permission to access trucks. Please contact support." }, 400)
            }
        }
    }

}
module.exports.getAllTrucks = getAllTrucks
