const {to} = require('await-to-js');
const pe = require('parse-error');

module.exports.to = async (promise) => {
    let err, res;
    [err, res] = await to(promise);
    if(err) return [err];

    return [null, res];
};

module.exports.ReE = function(res, err, code){ // Error Web Response
    
    let errorCode = err.code
    
    // console.log(err)
    
    if(typeof err == 'object' && typeof err.message != 'undefined'){
        err = err.message;
    }

    if(typeof code !== 'undefined') res.statusCode = code;

    return res.json({success:false, error: err, code: errorCode});
};

module.exports.ReS = function(res, data, code){ // Success Web Response
    let send_data = {success:true};

    if(typeof data == 'object'){
        send_data = Object.assign(data, send_data);//merge the objects
    }

    if(typeof code !== 'undefined') res.statusCode = code;

    return res.json(send_data)
};

module.exports.TE = function(err_message, log){ // TE stands for Throw Error
    if(log === true){
        console.error(err_message);
    }

    throw new Error(err_message);
};

module.exports.isNull =  (field) => {
    return typeof field === 'undefined' || field === '' || field === null
}

module.exports.isEmpty = (obj) => {
    return !Object.keys(obj).length > 0;
}


String.prototype.capitalize = function () {
    return this
        .toLowerCase()
        .replace(/^\w|\s\w/g,  (letter) => letter.toUpperCase())
};

function capitalizeFirstLetters(str){
    return str.toLowerCase().replace(/^\w|\s\w/g, function (letter) {
        return letter.toUpperCase();
    })
}


module.exports.formatLocation = function (location) {
    // If location is empty
    if (!location) {
        location = [0, 0];
    } else {
        // Does location contain coordinates property?
        if ('undefined' !== typeof location.coordinates) {
            location = location.coordinates;
        }
        // Is location an array with two values?
        if (!(Array.isArray(location) && location.length === 2)) {
            throw new Error("Incorrect location format: " + location);
        }
    }
    return { "type": "Point", "coordinates": location };
};

module.exports.getOtpMessage = function (otp, returning) {
    
    if (returning) {
        return encodeURIComponent(otp +
            ' is the Verification code for Whistle Freights. Welcome back.');
    }else {
        return encodeURIComponent(
            otp + ' is the Verification code for Whistle Freights.')
    }
}

module.exports.getNextSequence = function  (name) {
    
    return new Promise(async (resolve, reject) => {
    
        const {Counter} = require('../models')
    
    
        console.log('Counter',Counter);
        
        [err, count] = await to(Counter.findOneAndUpdate(
            {collectionName: name},
            {$inc: {seq: 1}},
            {new: true}),
        )
        
        if (err) {
            reject(err)
            return
        }
        
        if (!count) {
            
            console.log('Creating new Collection counter');
            
            [err, count] = await to(Counter.create({collectionName: name}))
            
            if (err) {
                reject(err)
                return
            }
            
            resolve(count)
            return
            
        }
        
        resolve(count)
    })
}

