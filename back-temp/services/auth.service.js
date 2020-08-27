const {User} = require('../models')
const validator = require('validator')
const {isEmail, isMobilePhone} = validator
const {to, TE} = require('../services/util.service')
const CONFIG = require('../config/config')

const getUniqueKeyFromBody = function (body) {// this is so they can send in 3 options unique_key, email, or phone and it will work
    var unique_key;
        if (typeof body.email != 'undefined') {
            unique_key = body.email
        } else if (typeof body.phone != 'undefined') {
            unique_key = body.phone
        } else {
            unique_key = null
        }
    
    return unique_key
}
module.exports.getUniqueKeyFromBody = getUniqueKeyFromBody

const createUser = async function (userInfo) {
    let unique_key, auth_info, err, sameUser, alreadyUser, userUpdate
    
    auth_info = {}
    auth_info.status = 'create'
    
    unique_key = getUniqueKeyFromBody(userInfo)
    if (!unique_key) TE('An email or phone number was not entered.')
    
    if (!CONFIG.UserTypes.includes(userInfo.type)) {
        return TE('Invalid user type.')
    }
    
    if (isEmail(unique_key)) {
        auth_info.method = 'email'
        userInfo.email = unique_key;
        
        [err, alreadyUser] = await to(
            User.findOne({'email': unique_key, 'type': userInfo.type}))
        
        if (err) TE('Unknown error occurred, Please contact support.')
        
        else {
            if (alreadyUser) {
                
                TE('You are already signed up. Please login to continue.')
                
            } else {
                
                [err, sameUser] = await to(User.findOne({'email': unique_key}))
                if (err) TE('Unknown error occurred, Please contact support.')
                else {
                    if (sameUser) {
                        [err, userUpdate] = await to(
                            User.findOneAndUpdate({'email': unique_key},
                                {$push: {type: userInfo.type}}))
                        if (err) TE('Unknown error occurred, Please contact support.')
                        else return userUpdate
                        
                    } else {
                        userInfo.verificationCode = Math.floor(100000 + Math.random() * 900000);
                        [err, user] = await to(User.create(userInfo))
                        if (err) TE('You are already signed up. Please login to continue.')
                        
                        return user
                    }
                }
                
            }
        }
        
    } else if (isMobilePhone(unique_key, 'any')) {//checks if only phone number was sent
        auth_info.method = 'phone'
        userInfo.phone = unique_key;
        var user;
        [err, user] = await to(User.create(userInfo))
        if (err) TE('user already exists with that phone number')
        
        return user
    } else {
        TE('A valid email or phone number was not entered.')
    }
}
module.exports.createUser = createUser

const authUser = async function (userInfo) {//returns token
    let unique_key
    let auth_info = {}
    auth_info.status = 'login'
    unique_key = getUniqueKeyFromBody(userInfo)
    
    if (!unique_key) TE('Please enter an email or phone number to login')
    
    if (!userInfo.password) TE('Please enter a password to login')
    
    let user
    if (isEmail(unique_key)) {
        auth_info.method = 'email';
        
        [err, user] = await to(User.findOne({email: unique_key}))
        if (err) TE(err.message)
        
    } else if (isMobilePhone(unique_key, 'any')) {//checks if only phone number was sent
        auth_info.method = 'phone';
        
        [err, user] = await to(User.findOne({phone: unique_key}))
        if (err) TE(err.message)
        
    } else {
        TE('A valid email or phone number was not entered')
    }
    
    if (!user) {
        TE('User not registered, Please register and try again.');
    }
    
    [err, user] = await to(user.comparePassword(userInfo.password))
    
    if (err) TE(err.message)
    
    return user
    
}
module.exports.authUser = authUser

const generateCode = async function (email) {
    
    
    if (!isEmail(email)) {
        TE("Invalid Email id. Cannot generate code")
    }
    let err,user;
    [err, user] = await to(User.findOne({email: email}))
    
    if (err) TE(err.message)
    
    if(!user) {
        TE('Email Id doesnt exist. Cannot generate code.')
    }
    
    user.verificationCode = Math.floor(100000 + Math.random() * 900000);
    
    return user
    
}
module.exports.generateCode = generateCode
