const {User, Driver, Truck, Trucktype} = require('../models')
const authService = require('../services/auth.service')
const {to, ReE, ReS, isNull, isEmpty} = require('../services/util.service')
const ObjectId = require('mongoose').Types.ObjectId
const CONFIG = require('../config/config')
const validator = require('validator')
const HttpStatus = require('http-status')

const add = async function (req, res) {
    
    let displayName = req.body.displayName
    let type = req.body.type
    
    if (!req.user.admin) {
        return ReE(res, {
            message: 'Cannot proceed. user is not admin',
        }, HttpStatus.UNAUTHORIZED)
    }
    
    if (isNull(displayName)) {
        return ReE(res, {
            message: 'Please provide a displayName',
        }, HttpStatus.BAD_REQUEST)
    } else {
        if (displayName.length < 3) {
            return ReE(res, {
                message: 'Please provide a displayName with min 3 characters',
            }, HttpStatus.BAD_REQUEST)
        }
    }
    
    if (isNull(type)) {
        return ReE(res, {message: 'Please enter a truck type'},
            HttpStatus.BAD_REQUEST)
    }
    
    let newTruckType = {
        displayName: displayName,
        type: type,
    }
    
    let err, trucktype;
    [err, trucktype] = await to(Trucktype.create(newTruckType))
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
        
    } else {
        return ReS(res, {
            message: 'Trucktype added.',
            type: trucktype,
        }, HttpStatus.OK)
        
    }
}
module.exports.add = add

const getAll = async function (req, res) {
    
    let err, truckTypes;
    
    [err, truckTypes] = await to(Trucktype.find())
    
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    } else {
        return ReS(res, {
            truckTypes: truckTypes,
        }, HttpStatus.OK)
    }
    
}
module.exports.getAll = getAll

const addSubType = async function (req, res) {
    
    let type = req.body.type
    let displayName = req.body.displayName
    let capacity = req.body.capacity
    let noOfTyres = req.body.noOfTyres
    
    let err, trucktype, updatedTrucktype
    
    if (!CONFIG.TruckTypeCapacities.includes(capacity)) {
        return ReE(res, 'Please provide a valid truck capacity.',
            HttpStatus.BAD_REQUEST)
    }
    
    if (!ObjectId.isValid(type)) {
        return ReE(res, {
            message: 'Please provide a truck type id to add to.',
        }, HttpStatus.BAD_REQUEST)
    }
    
    if (isNull(displayName)) {
        return ReE(res, {
            message: 'Please provide a displayName',
        }, HttpStatus.BAD_REQUEST)
    } else {
        if (displayName.length < 3) {
            return ReE(res, {
                message: 'Please provide a displayName with min 3 characters',
            }, HttpStatus.BAD_REQUEST)
        }
    }
    
    if (isNull(capacity)) {
        return ReE(res, {
            message: 'Please provide capacity',
        }, HttpStatus.BAD_REQUEST)
    }
    
    [err, trucktype] = await to(Trucktype.findById(type))
    
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    
    if (!trucktype) {
        return ReE(res, 'Truck type not found.', HttpStatus.BAD_REQUEST)
    }
    trucktype.subtypes.push({
        displayName: displayName,
        capacity: capacity,
        noOfTyres: noOfTyres,
    });
    
    [err, updatedTrucktype] = await to(trucktype.save())
    
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    
    return ReS(res, {
        message: 'Subtype added.',
        truckType: updatedTrucktype,
    }, HttpStatus.OK)
    

}
module.exports.addSubType = addSubType
