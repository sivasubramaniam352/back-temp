const { User, Driver, Truck, Cargo } = require('../models')
const authService = require('../services/auth.service')
const { to, ReE, ReS, isNull, isEmpty } = require('../services/util.service')
const ObjectId = require('mongoose').Types.ObjectId
const CONFIG = require('../config/config')
const validator = require('validator')
const shortid = require('shortid')
const HttpStatus = require('http-status')
const crypto = require('crypto')
const { sendNotification } = require('./notification.controller')

const add = async function (req, res) {

    let name = req.body.name
    let phone = req.body.phone
    let truck = req.body.truck
    let photo = req.body.photoURL
    let drivingLicenseNumber = req.body.drivingLicenseNumber

    if (isNull(name) || name.toString().trim().length < 3) {
        return ReE(res, 'Please enter a name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(phone)) {
        return ReE(res, { message: 'Please enter a phone number' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(drivingLicenseNumber) ||
        drivingLicenseNumber.toString().trim().length < 6) {
        return ReE(res,
            { message: 'Please provide a valid driving license number' },
            HttpStatus.BAD_REQUEST)
    }

    var secret_code = crypto.randomBytes(3).toString('hex')

    let newDriver = {
        name: name,
        drivingLicenseNumber: drivingLicenseNumber,
        vendor: req.user._id,
        drivers: [],
        secret_code: secret_code,
        phone: phone,
    }

    if (phone.startsWith('+91')) {
        newDriver.countryCode = '+91'
        newDriver.phone = phone.replace('+91', '')
    }

    if (phone.startsWith('+1')) {
        newDriver.countryCode = '+1'
        newDriver.phone = phone.replace('+1', '')
    } else {
        newDriver.countryCode = '+91'
    }

    if (!validator.isMobilePhone(phone, ['en-IN', 'en-US'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${phone}` },
            HttpStatus.BAD_REQUEST)
    }

    if (!isNull(truck)) {

        if (!ObjectId.isValid(truck)) {
            return ReE(res, { message: 'Please enter a valid truck Id.' },
                HttpStatus.BAD_REQUEST)
        }

        [err, truck] = await to(
            Truck.findById(truck))
        if (err) return ReE(res, err, HttpStatus.BAD_REQUEST)
        else {
            if (!truck)
                return ReE(res, { message: 'Truck not found' },
                    HttpStatus.BAD_REQUEST)
        }
        newDriver.truck = truck
    }

    let err, driver

    [err, driver] = await to(Driver.create(newDriver))
    if (err) {
        if (err.message.includes('E11000') &&
            err.message.includes('phone')) {
            return ReE(res, {
                message: 'Driver with that phone number already exists.',
            }, HttpStatus.CONFLICT)

        } else {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }
    return ReS(res, { message: 'Driver created.', driver: driver }, HttpStatus.OK)
}
module.exports.add = add

const generateCode = async function (req, res) {
    const driverId = req.params.id
    let err, driver

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'Please provide a Valid driver id' },
            HttpStatus.BAD_REQUEST)
    }

    [err, driver] = await to(
        Driver.findOne({ '_id': new ObjectId(driverId) }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    } else {

        if (!driver) {
            return ReE(res,
                { message: 'Unable to find driver, Please check driver id.' },
                HttpStatus.BAD_REQUEST)
        }
        var secretCode = crypto.randomBytes(3).toString('hex')
        driver['secret_code'] = secretCode
        driver.save()
        return ReS(res,
            {
                message: 'Verification Code.',
                secret_code: secretCode,
                driver: driver,
            }, HttpStatus.OK)
    }
}
module.exports.generateCode = generateCode

const verify = async function (req, res) {
    const reqVerify = req.body
    let err, driver, user, updatedDriver

    if (isNull(reqVerify.secret_code)) {
        return ReE(res, { message: 'Please enter Driver secret_code' }, 400)
    }

    [err, driver] = await to(
        Driver.findOne({ 'secret_code': reqVerify.secret_code.toLowerCase() }))

    if (err) {
        return ReE(res, err, 400)
    } else {
        if (driver) {
            [err, updatedDriver] = await to(
                Driver.update({ '_id': new ObjectId(driver._id) },
                    { active: true }))

            if (err) {
                return ReE(res, err, 400)
            }

            [err, user] = await to(
                User.findOne({ '_id': new ObjectId(driver.vendor) })
                    .select('_id name email'))

            if (err) {
                return ReE(res, err, 500)
            } else {

                if (user) {

                    return ReS(res,
                        {
                            message: 'Successfully Activated.',
                            driver: driver,
                            vendor: user,
                            token: user.getMobileJWT(),
                        }, 200)

                } else {
                    return ReE(res, { message: 'User not found' }, 400)
                }

            }

        } else {
            return ReE(res, { message: 'Invalid Secret Code' }, 500)
        }
    }
}
module.exports.verify = verify

const getDrivers = async function (req, res) {

    let from = req.query.from
    let user = req.user
    let mode = req.query.mode
    let page = parseInt(req.query.page) || 1
    let limit =  parseInt(req.query.limit) || 2

    let err, drivers

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }
    let errs, existingUser
    [errs, existingUser] = await to(User
        .findOne({ _id: user._id })
        .select('admin role').populate({
            path: 'role',
            select: 'role'
        })
    )
    if (errs) {
        return ReE(res, { message: 'user not fount' }, 400)
    }
    else {

        let query = {
            'vendor': user._id,
        }
        let options = {
            page: page,
            limit:limit,
            populate: [
                {
                    path: 'truck',
                    select: 'name registrationNumber transportName _id',
                },
                {
                    path: 'vendor',
                    select: 'name email _id',
                }],
            sort: {
                createdAt: 'asc'

            },
            
        };

        if (from === 'MAP') {
            console.log('Query from map, prevent showing drivers at 0,0')
            query.lastLocation = { $ne: [0, 0] }
        }

        [err, drivers] = await to(Driver.paginate(query,options));

        if (err) {
            return ReE(res, err, 400)
        } else {
            if (existingUser.admin === true || existingUser.role.role.write.includes('DRIVER')) {
                return ReS(res, { message: 'You have write access for this driver page.', isEditable: true, drivers:drivers }, HttpStatus.OK)
            }
            else if (existingUser.role.role.read.includes('DRIVER')) {
                return ReS(res, { message: 'You have only read access for this driver page.', isEditable: false, drivers:drivers }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: "You don't have permission to access drivers. Please contact support." }, 400)
            }
        }
    }

}
module.exports.getDrivers = getDrivers

const getDriver = async function (req, res) {

    let driverId = req.params.id
    let user = req.user
    let err, driver

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'please provide valid Driver id' }, 400)
    }
    else{
        [err, driver] = await to(
            Driver.findOne({ 'vendor': user._id, '_id': driverId }).populate({
                path: 'truck',
                select: 'name registrationNumber transportName _id',
            }).populate({ path: 'vendor', select: 'name email _id' }))
    
        if (err) {
            return ReE(res, err, 400)
        } else {
            if (driver) {
    
                return ReS(res, { message: 'Driver details are', driver: driver },
                    200)
    
            } else {
                return ReE(res, { message: 'Driver is not found' }, 400)
            }
    
        }
    }

   

}
module.exports.getDriver = getDriver

const sendEmergencyAlert = async function (req, res) {

    let driverId = req.query.driver
    let user = req.user
    let err

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'Please provide a valid Driver id' },
            HttpStatus.BAD_REQUEST)
    }

    let driver;
    [err, driver] = await to(
        Driver.findOne({ 'vendor': user._id, '_id': driverId }).populate({
            path: 'truck',
            // select: 'name registrationNumber _id',
        }).populate({ path: 'vendor', select: 'name email' })
            .populate({ path: 'truck.cargo' }))

    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    if (!driver) {
        return ReE(res, { message: 'Driver is not found' }, 400)
    }

    if (!driver.truck) {
        console.log('Driver not assigned to truck. Not Sending alert.')
        return ReS(res,
            { message: 'SOS alert not sent. No truck assigned to driver.' },
            HttpStatus.OK)
    } else {
        console.log(
            'Driver assigned to truck.')

        var options = {
            title: 'SOS Alert',
            body: 'A Driver is in an Emergency',
            mode: 'SOS_ALERT',
            click_action: 'SOS',
            channel_id: 'sos_alert',
            sound: 'sos_alert.m4a',
            driver: driver._id,
            latitude: driver.truck.lastLocation[1],
            longitude: driver.truck.lastLocation[0],
        }

        sendNotification(driver.vendor._id, options)

        if (driver.truck.cargo.length === 0) {
            console.log(
                'No cargo in truck. Sending alert to carrier.')

            return ReS(res, { message: 'SOS alert sent' },
                HttpStatus.OK)

        }

        let cargoId = driver.truck.cargo[0]

        console.log(cargoId)

        let cargo;

        [err, cargo] = await to(Cargo.findById(new ObjectId(cargoId)))

        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

        if (!cargo) {
            console.log(
                'Cargo Id not found. cannot send alert to shipper.')
        }

        sendNotification(cargo.shipper.toString(), options)

        return ReS(res, { message: 'SOS alert sent' },
            HttpStatus.OK)
    }

}
module.exports.sendEmergencyAlert = sendEmergencyAlert

const getLiveLocationURL = async function (req, res) {

    let user = req.user
    let err
    let driverId = req.params.id

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'Please provide valid Driver id' },
            HttpStatus.BAD_REQUEST)
    }

    let driver;
    [err, driver] = await to(Driver.findOne({ _id: new ObjectId(driverId) }))
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    } else {
        if (driver) {

            let sharingURL = CONFIG.web_url

            if (!isNull(driver.sharingId)) {

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                return ReS(res,
                    {
                        message: 'Sharing link already present.',
                        sharingId: driver.sharingId,
                        sharingURL: sharingURL + `/live/${driver.sharingId}`,
                    }, HttpStatus.OK)

            }

            driver.sharingId = shortid.generate()

            let updatedDriver
            [err, updatedDriver] = await to(driver.save())

            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }

            return ReS(res,
                {
                    message: 'New Sharing link generated.',
                    sharingId: driver.sharingId,
                    sharingURL: sharingURL + `/live/${driver.sharingId}`,
                }, HttpStatus.OK)
        } else {
            return ReE(res, { message: 'Driver is not found' }, 400)
        }

    }

}
module.exports.getLiveLocationURL = getLiveLocationURL

const updateDriver = async function (req, res) {
    let err, user, data, updateDriver, driver, truck
    user = req.user
    const userId = user._id
    data = req.body

    let driverId = req.params.id

    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'please provide valid Driver id' }, 400)
    }

    if (typeof data.truck !== 'undefined' && data.truck !== '') {

        if (!ObjectId.isValid(data.truck)) {
            return ReE(res, { message: 'please provide valid Truck id' }, 400)
        }
        ;

        [err, truck] = await to(Truck.findOne({ _id: new ObjectId(data.truck) }))
        if (err) return ReE(res, err, 400)
        else {
            if (truck) {

                data.truck = data.truck

            } else {
                return ReE(res, { message: 'Truck is not found' }, 400)
            }
        }
    }

    [err, driver] = await to(Driver.findOne({ _id: new ObjectId(driverId) }))
    if (err) {
        return ReE(res, err, 400)
    } else {
        if (driver) {
            CONFIG.editableDriverFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    driver[field] = data[field]
                }
            });

            [err, updateDriver] = await to(driver.save())

            if (err) {
                return ReE(res, err, 400)
            }

            return ReS(res,
                { message: 'Driver is Updated.', driver: updateDriver }, 200)
        } else {
            return ReE(res, { message: 'Driver is not found' }, 400)
        }

    }
}
module.exports.updateDriver = updateDriver

const deleteDriver = async function (req, res) {

    let err, deleteDriver, driver

    let driverId = req.params.id
    if (!ObjectId.isValid(driverId)) {
        return ReE(res, { message: 'please provide valid Driver id' }, 400)
    }

    [err, driver] = await to(Driver.findOne({ '_id': new ObjectId(driverId) }))
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    } else {
        if (driver) {

            [err, deleteDriver] = await to(driver.remove())

            if (err) {
                return ReE(res, err, 400)
            } else {
                return ReS(res,
                    {
                        meesage: 'Your driver is successsfully deleted',
                        driver: deleteDriver,
                    }, 200)
            }
        } else {
            return ReE(res, { message: 'Driver is not found' }, 400)
        }

    }

}
module.exports.deleteDriver = deleteDriver

const filterDriver = async function (req, res) {

    let keyword = req.query.keyword

    if (isNull(keyword) || isEmpty(keyword)) {
        return ReS(res, { message: 'No drivers found', drivers: [] }, 200)

    }

    var user = req.user

    let err, drivers;

    [err, drivers] = await to(Driver.find({
        '$or': [
            { 'name': { '$regex': '^' + keyword, '$options': 'i' } },
            { 'phone': { '$regex': '^' + keyword, '$options': 'i' } }],
        'vendor': { '$eq': user._id },
    }).select('_id name phone secret_code'))

    if (err) {
        return ReE(res, err, 400)
    } else {
        if (drivers) {
            if (drivers.length > 0) {
                return ReS(res,
                    { message: 'Driver details are', drivers: drivers }, 200)
            } else {
                return ReE(res, { message: 'Searching driver is not found' },
                    400)
            }
        } else {
            return ReE(res, { message: 'Driver is not found' }, 400)
        }

    }

}
module.exports.filterDriver = filterDriver

//Admin
const getAllDrivers = async function (req, res) {

    let user = req.user
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10
    // console.log(typeof req.query.limit)
    let err, drivers

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }
    [errs, existingUser] = await to(User
        .findOne({ _id: new ObjectId(user._id) })
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
                {
                    path: 'truck',
                    select: 'name registrationNumber transportName _id',
                },
                {
                    path: 'vendor',
                    select: 'name email _id',
                }],
            sort: {
                createdAt: 'desc',
            },
        };

        [err, drivers] = await to(Driver.paginate({}, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            if (existingUser.admin === true || existingUser.role.role.write.includes('DRIVERS')) {
                return ReS(res, { message: 'You have write access for this drivers page.', isEditable: true, drivers: drivers }, HttpStatus.OK)
            }
            else if (existingUser.role.role.read.includes('DRIVERS')) {
                return ReS(res, { message: 'You have only read access for this drivers page.', isEditable: false, drivers: drivers }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: "You don't have permission to access drivers. Please contact support." }, 400)
            }
        }
    }

}
module.exports.getAllDrivers = getAllDrivers
