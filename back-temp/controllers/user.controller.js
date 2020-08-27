const { User, Product, Driver, Truck, BankDetails } = require('../models')
const authService = require('../services/auth.service')
const notificationService = require('../services/notification.service')
const Role = require('../models/Role')
const Invite = require('../models/invite.model')
const Organization = require('../models/organization.model')
const { admin } = require('../services/notification.service')
const { to, ReE, ReS } = require('../services/util.service')
const ObjectId = require('mongoose').Types.ObjectId
const CONFIG = require('../config/config')
const { isNull } = require('../services/util.service')
const HttpStatus = require('http-status')
const validator = require('validator')
const { isEmail } = validator
const msg91 = require('msg91')(CONFIG.sms_auth_key, CONFIG.sms_sender_id,
    CONFIG.sms_route_id)
const moment = require('moment')
const { getOtpMessage } = require('../services/util.service')
const { populate } = require('../models/Role')

const webRegister = async function (req, res) {

    const body = req.body;
    let err, user, userData, invites, invite, org, orga;
    if (isNull(body.name) || body.name.length < 3) {
        return ReE(res, 'Please enter a name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(body.email)) {
        return ReE(res, 'please enter your Email Id', HttpStatus.BAD_REQUEST)
    }

    if (isNull(body.phone)) {
        return ReE(res, { message: 'Please enter a phone number' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(body.type)) {
        return ReE(res, { message: 'Please enter a user type' }, 400)
    }

    if (isNull(body.password) || body.password.length < 8) {
        return ReE(res, 'Please enter a password with minimum 8 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (body.phone.startsWith('+91')) {
        body.countryCode = '+91'
        body.phone = body.phone.replace('+91', '')
    }

    if (body.phone.startsWith('+1')) {
        body.countryCode = '+1'
        body.phone = body.phone.replace('+1', '')
    } else {
        body.countryCode = '+91'
    }

    if (!validator.isMobilePhone(body.phone,
        ['en-IN', 'en-US', 'en-ZA', 'en-AU', 'nl-BE', 'de-DE'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${body.phone}` },
            400)
    }

    if (body.phone.startsWith('+27')) {
        body.countryCode = '+27'
        body.phone = body.phone.replace('+27', '')
    }

    if (body.phone.startsWith('+61')) {
        body.countryCode = '+61'
        body.phone = body.phone.replace('+61', '')
    }

    if (body.phone.startsWith('+32')) {
        body.countryCode = '+32'
        body.phone = body.phone.replace('+32', '')
    }

    if (body.phone.startsWith('+49')) {
        body.countryCode = '+49'
        body.phone = body.phone.replace('+49', '')
    }

    const existingPhoneUserQuery = { 'phone': body.phone }

    let firebaseUser;
    [err, user] = await to(
        User.findOne(existingPhoneUserQuery))
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (user) {
        console.log('User with that phone number exists')

        if (isNull(user.email) || user.emailVerified === false) {
            console.log('No email for User with that phone number')

            return ReE(res, {
                message: 'Please set email and password to continue.',
                user: {
                    name: user.name,
                },
                code: CONFIG.registrationStatus.EMAIL_NOT_PRESENT,
            }, HttpStatus.UNPROCESSABLE_ENTITY)

        } else if (isNull(user.password)) {
            console.log('Email present but password doesnt exist for that user')

            return ReE(res, {
                message: 'Please set a password to continue.',
                user: {
                    name: user.name,
                },
                code: CONFIG.registrationStatus.PASSWORD_NOT_PRESENT,
            }, HttpStatus.UNPROCESSABLE_ENTITY)

        }
    }
         orga = {name: body.organization};
        [err, org] = await to(Organization.findOne(orga))
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }        
        if(!org){
            userData = {
                "email": body.email,
                "name": body.name,
                "password": body.password,
                "phone": body.phone,
                "type": body.type
                };
        }
        else{
            invites = {'email': body.email};
            [err, invite] = await to(Invite.findOne(invites))
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            if(!invite){
                userData = {
                    "email": body.email,
                    "name": body.name,
                    "password": body.password,
                    "phone": body.phone,
                    "type": body.type
                    };
            }
            else{
                if( invite.verified === true ){
                    userData = {
                        email: body.email,
                        name: body.name,
                        organization: {
                            id:org._id,
                            displayName: org.name,
                            active:true
                        },
                        password: body.password,
                        phone: body.phone,
                        type: body.type
                        };
                }else{
                    return res.status(404).json({message:"Please accept the email invitation"})
                }
            }
        }
    [err, user] = await to(authService.createUser(userData))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    if (CONFIG.verify_email === 'true') {

        var link = `${CONFIG.verification_url}/verify/${user.verificationCode}`
        var response;
        [err, response] = await to(
            notificationService.sendEmail(user.email, {
                subject: 'Confirm email',
                body: '<!DOCTYPE html>\n' +
                    '<html>\n' +
                    '<body>\n' +
                    `\tPlease use this code to verify your email id ${user.verificationCode}.\n` +
                    '</body>\n' +
                    '</html>\n',
            }))

        if (err) return ReE(res, 'Cannot send email' + err.message,
            HttpStatus.INTERNAL_SERVER_ERROR)

        return ReS(res, {
            message: 'Verification email sent.',
            user: {
                name: user.name,
                email: user.email,
            },
        }, 201)

    } else {
        var message;
        return ReS(res, {
            message: "Verification Email not sent, code in body",
            user: {
                name: user.name,
                email: user.email,
                verificationCode: user.verificationCode,
            },
        }, 201)
    }

}
module.exports.webRegister = webRegister

const userCheck = async function (req, res) {

    let phone = req.body.phone
    let countryCode = req.body.countryCode
    let loginType = req.body.loginType

    if (isNull(phone)) {
        return ReE(res, { message: 'Please enter a phone number' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(countryCode)) {
        return ReE(res, { message: 'Please enter a country Code' },
            HttpStatus.BAD_REQUEST)
    }

    if (!validator.isMobilePhone(countryCode + phone)) {
        return ReE(res,
            {
                message: `Please enter a valid phone number : ${countryCode +
                    phone}`,
            },
            HttpStatus.BAD_REQUEST)
    }

    let err, user;
    [err, user] = await to(
        User.findOne({
            'phone': phone,
        }))
    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }

    if (!user) {

        return ReS(res, {
            message: 'New user.',
            skipName: false,
        }, HttpStatus.OK)

    }

    return ReS(res, {
        message: 'Phone number already exists.',
        skipName: true,
    }, HttpStatus.OK)

}
module.exports.userCheck = userCheck

const appSignin = async function (req, res) {
    const reqRegister = req.body
    console.log('App signin')

    let name = req.body.name

    if (typeof reqRegister.phone === 'undefined' || reqRegister.phone === '') {
        return ReE(res, { message: 'Please enter a phone number' }, 400)
    }

    if (isNull(reqRegister.type)) {
        return ReE(res, { message: 'Please enter a user type' }, 400)
    }

    if (reqRegister.phone.startsWith('+91')) {
        reqRegister.countryCode = '+91'
        reqRegister.phone = reqRegister.phone.replace('+91', '')
    }

    if (reqRegister.phone.startsWith('+1')) {
        reqRegister.countryCode = '+1'
        reqRegister.phone = reqRegister.phone.replace('+1', '')
    } else {
        reqRegister.countryCode = '+91'
    }

    if (!validator.isMobilePhone(reqRegister.phone,
        ['en-IN', 'en-US', 'en-ZA', 'en-AU', 'nl-BE', 'de-DE'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${reqRegister.phone}` },
            400)
    }

    if (reqRegister.phone.startsWith('+27')) {
        reqRegister.countryCode = '+27'
        reqRegister.phone = reqRegister.phone.replace('+27', '')
    }

    if (reqRegister.phone.startsWith('+61')) {
        reqRegister.countryCode = '+61'
        reqRegister.phone = reqRegister.phone.replace('+61', '')
    }

    if (reqRegister.phone.startsWith('+32')) {
        reqRegister.countryCode = '+32'
        reqRegister.phone = reqRegister.phone.replace('+32', '')
    }

    if (reqRegister.phone.startsWith('+49')) {
        reqRegister.countryCode = '+49'
        reqRegister.phone = reqRegister.phone.replace('+49', '')
    }

    let OTP = Math.floor(100000 + Math.random() * 900000)
    reqRegister.otp = OTP

    const existingUserQuery = {
        $or: [{ 'phone': reqRegister.phone }],
    }

    if (!isNull(reqRegister.email)) {
        if (!isEmail(reqRegister.email)) {
            return ReE(res, { message: 'Please enter a valid email id' }, 400)
        } else {
            existingUserQuery.$or.push({ 'email': reqRegister.email })
        }
    } else {
        reqRegister.email = undefined
    }

    let err, user, firebaseUser;
    [err, user] = await to(
        User.findOne(existingUserQuery))
    if (err) {
        return ReE(res, err, 500)
    }

    if (!user) {

        console.log('user does not exist')

        if (isNull(name) || name.length < 3) {
            return ReE(res, 'Please enter a name with minimum 3 characters',
                HttpStatus.BAD_REQUEST)
        }

        let err, user;
        [err, user] = await to(User.create(reqRegister))
        if (err) {

            console.log('USER CREATION ERROR', err)
            return ReE(res, err, 500)

        }
        let message = getOtpMessage(OTP, false)

        let result;

        [err, result] = await to(notificationService.sendSms(
            reqRegister.countryCode,
            reqRegister.phone, message))
        if (err) {
            console.log(err)
            return ReE(res, `Unable to send OTP, ${err.message()}`, 500)
        }
        console.log('SMS Service:', result)

        return ReS(res,
            {
                message: 'Successfully created new user.',
                user: user.toWeb(),
            },
            200)
    }

    let message = encodeURIComponent(
        OTP + ' is the Verification code for Whistle Freights. Welcome back.')

    user['otp'] = OTP
    user.type.addToSet(reqRegister.type)
    if (reqRegister.countryCode) {

        if (user.phone !== reqRegister.phone) {
            return ReE(res, `Email and phone number does not match.`, 500)
        } else if (isNull(user.phone)) {
            user.countryCode = reqRegister.countryCode
            user.phone = reqRegister.phone
        }
    }

    user.save()

    let result;
    [err, result] = await to(notificationService.sendSms(
        reqRegister.countryCode,
        reqRegister.phone, message))
    if (err) {
        console.log(err)
        return ReE(res, `Unable to send OTP, ${err.message()}`, 500)
    }
    console.log('SMS Service:', result)

    return ReS(res, {
        message: 'Phone/Email number already exists',
        user: user.toWeb(),
    }, 200)

}
module.exports.appSignin = appSignin

const resendOTP = async function (req, res) {
    const reqResend = req.body
    let err, user

    if (typeof reqResend.userid === 'undefined' || reqResend.userid === '') {
        return ReE(res, { message: 'User Id was not entered' }, 400)
    }

    [err, user] = await to(
        User.findOne({ '_id': new ObjectId(reqResend.userid) }))

    if (err) {
        return ReE(res, err, 500)
    } else {
        if (user) {
            let OTP = Math.floor(100000 + Math.random() * 900000)
            user['otp'] = OTP
            user.save()

            let message = encodeURIComponent(
                OTP + ' is the Verification code for Gofreights.')

            if (CONFIG.sms_enable === 'true') {
                if (!user.countryCode) {
                    user.countryCode = '+91'
                }
                msg91.send(user.countryCode + user.phone, message,
                    function (err, response) {
                    })
            } else {
                console.log('Not sending SMS')
            }

            return ReS(res, { message: 'OTP resent.', user: user }, 200)
        } else {
            return ReE(res, { message: 'Invalid User.' }, 400)
        }
    }
}
module.exports.resendOTP = resendOTP

const verifyOTP = async function (req, res) {
    const reqVerify = req.body
    let err, user, userData

    if (typeof reqVerify.otp === 'undefined' || reqVerify.otp === '') {
        return ReE(res, { message: 'Otp was not entered' }, 400)
    }
    if (typeof reqVerify.id === 'undefined' || reqVerify.id === '') {
        return ReE(res, { message: 'User Id was not entered' }, 400)
    }

    if (!ObjectId.isValid(reqVerify.id)) {
        return ReE(res, { message: 'Please enter a valid UserId' }, 400)
    }

    [err, user] = await to(User.findOne(
        { 'otp': reqVerify.otp, '_id': new ObjectId(reqVerify.id) }))

    if (err) {
        return ReE(res, err, 500)
    } else {
        if (user) {

            [err, userData] = await to(User
                .findOne({ '_id': user._id })
                .select('token type active _id name phone otp countryCode'))

            if (err) {
                return ReE(res, err, 500)
            }

            [err, firebaseUser] = await to(admin.auth().createUser({
                uid: user._id.toString(),
                email: user.email,
            }))

            if (err) {
                if (!err.message.includes('already')) {
                    return ReE(res, err, 500)
                }
            }
            return ReS(res, {
                message: 'Successfully Verified.',
                user: userData,
                token: user.getMobileJWT(),
                uploadToken: await user.getFirebaseAuthToken(),
            }, 200)
        } else {
            return ReE(res,
                { message: 'The OTP entered is invalid. Please try again.' }, 400)
        }
    }
}
module.exports.verifyOTP = verifyOTP

const resendCode = async function (req, res) {

    const email = req.body.email
    let err, user

    if (isNull(email)) {
        return ReE(res, 'Please enter a valid email to resend code.',
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(authService.generateCode(email))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    var link = `${CONFIG.verification_url}/verify/${user.verificationCode}`

    if (!user) {
        return ReE(res,
            { message: 'Sorry, Email id not registered.' },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(user.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    var response;
    [err, response] = await to(notificationService.sendEmail(user.email, {
        subject: 'Confirm email',
        body: '<!DOCTYPE html>\n' +
            '<html>\n' +
            '<body>\n' +
            `\tPlease use this code to verify your email id ${user.verificationCode}.\n` +
            '</body>\n' +
            '</html>\n',
    }))

    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    return ReS(res, {
        message: 'Verification email sent.',
        user: {
            name: user.name,
            email: user.email,
        },
    }, HttpStatus.OK)

}
module.exports.resendCode = resendCode

const verifyEmail = async function (req, res) {
    let err, user

    const verificationCode = req.body.code
    const email = req.body.email

    if (isNull(verificationCode)) {
        return ReE(res, { message: 'Please enter a verification code' },
            HttpStatus.BAD_REQUEST)
    }
    if (isNull(email)) {
        return ReE(res, { message: 'Please enter an email id' },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(User.findOne(
        {
            'verificationCode': verificationCode,
            'email': email,
        }))

    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    if (!user) {
        return ReE(res,
            { message: 'Sorry, Please enter a valid code and email to verify. Unable to activate.' },
            HttpStatus.BAD_REQUEST)
    }

    user.emailVerified = true
    user.verificationCode = undefined;

    [err, user] = await to(user.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        {
            message: 'User activated. Welcome to Whistle Freights.',
            user: {
                name: user.name,
                email: user.email,
                verified: user.emailVerified,
            },
        }, HttpStatus.OK)

}
module.exports.verifyEmail = verifyEmail

const requestPasswordReset = async function (req, res) {

    const email = req.body.email
    let err, user

    if (isNull(email)) {
        return ReE(res, 'Please enter a valid email.', HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(authService.generateCode(email))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    var link = `${CONFIG.verification_url}/passwordreset/${user.verificationCode}`

    if (!user) {
        return ReE(res,
            { message: 'Sorry, Email id not registered.' },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(user.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    var response;
    [err, response] = await to(notificationService.sendEmail(user.email, {
        subject: 'Reset Password',
        body: '<!DOCTYPE html>\n' +
            '<html>\n' +
            '<body>\n' +
            `\tPlease use this code to reset password. ${user.verificationCode}.\n` +
            '</body>\n' +
            '</html>\n',
    }))

    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    return ReS(res, {
        message: 'Password reset email sent.',
        user: {
            name: user.name,
            email: user.email,
        },
    }, HttpStatus.OK)

}
module.exports.requestPasswordReset = requestPasswordReset

const getOtpWeb = async function (req, res) {

    let phone = req.body.phone

    if (isNull(phone)) {
        return ReE(res, 'Please enter a phone number.', HttpStatus.BAD_REQUEST)
    }

    if (phone.startsWith('+91')) {
        phone = phone.replace('+91', '')
    }

    if (phone.startsWith('+1')) {
        phone = phone.replace('+1', '')
    }

    if (!validator.isMobilePhone(phone,
        ['en-IN', 'en-US', 'en-ZA', 'en-AU', 'nl-BE', 'de-DE'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${phone}` },
            HttpStatus.BAD_REQUEST)
    }

    let err, user;
    [err, user] = await to(User.findOne(
        { 'phone': phone }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!user) {
        return ReE(res,
            { message: 'Sorry, we are unable to locate your account, please check your phone number and try again.' },
            HttpStatus.BAD_REQUEST)
    }

    let OTP = Math.floor(100000 + Math.random() * 900000)
    user.otp = OTP

    let message = getOtpMessage(OTP, true);

    [err, user] = await to(user.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let result;
    [err, result] = await to(notificationService.sendSms(
        user.countryCode,
        user.phone, message))
    if (err) {
        console.log(err)
        return ReE(res, `Unable to send OTP, ${err.message()}`,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let otpresponse

    if (CONFIG.sms_enable === 'false') {
        otpresponse = OTP
    }

    return ReS(res, {
        message: `OTP sent to phone number ${user.phone}`,
        userId: user._id,
        otp: otpresponse,
    }, HttpStatus.OK)

}
module.exports.getOtpWeb = getOtpWeb

const setEmailAccess = async function (req, res) {

    const email = req.body.email
    let phone = req.body.phone
    const otp = req.body.otp
    let password = req.body.password
    let err, user, userData

    if (isNull(otp)) {
        return ReE(res, { message: 'Otp was not entered' }, 400)
    }

    if (isNull(email)) {
        return ReE(res, 'Please enter a valid email.', HttpStatus.BAD_REQUEST)
    }

    if (isNull(password) || password.length < 8) {
        return ReE(res, 'Please enter a password with minimum 8 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(phone)) {
        return ReE(res, 'Please enter a phone number.', HttpStatus.BAD_REQUEST)
    }

    if (phone.startsWith('+91')) {
        phone = phone.replace('+91', '')
    }

    if (phone.startsWith('+1')) {
        phone = phone.replace('+1', '')
    }

    if (!validator.isMobilePhone(phone,
        ['en-IN', 'en-US', 'en-ZA', 'en-AU', 'nl-BE', 'de-DE'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${phone}` },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(User.findOne(
        { 'otp': otp, 'phone': phone }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!user) {
        return ReE(res,
            { message: 'The OTP entered is invalid. Please try again.' },
            HttpStatus.BAD_REQUEST)
    }

    user.email = email
    user.password = password;

    [err, user] = await to(user.save())

    if (err) {

        if (err.message.includes('E11000') &&
            err.message.includes('email')) {
            return ReE(res,
                `Another account with that email id already exists. Please contact support if this is a mistake.`,
                HttpStatus.BAD_REQUEST)
        }

        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    [err, user] = await to(authService.generateCode(email))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR);

    [err, user] = await to(user.save())
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

    if (CONFIG.verify_email === 'true') {

        var link = `${CONFIG.verification_url}/verify/${user.verificationCode}`
        var response;
        [err, response] = await to(
            notificationService.sendEmail(user.email, {
                subject: 'Confirm email',
                body: '<!DOCTYPE html>\n' +
                    '<html>\n' +
                    '<body>\n' +
                    `\tPlease use this code to verify your email id ${user.verificationCode}.\n` +
                    '</body>\n' +
                    '</html>\n',
            }))

        if (err) {

            return ReE(res, 'Cannot send email' + err.message,
                HttpStatus.INTERNAL_SERVER_ERROR)
        }

        return ReS(res, {
            message: 'Email Access enabled. Verification email sent.',
            user: {
                name: user.name,
                email: user.email,
            },
        }, HttpStatus.OK)

    } else {

        return ReS(res, {
            message: 'Email Access enabled. Verification Email not sent, code in body',
            user: {
                name: user.name,
                email: user.email,
                verificationCode: user.verificationCode,
            },
        }, HttpStatus.OK)

    }

}
module.exports.setEmailAccess = setEmailAccess

const resetPassword = async function (req, res) {
    let err, user, data

    const verificationCode = req.body.code
    const newPassword = req.body.newPassword
    const email = req.body.email

    if (isNull(verificationCode)) {
        return ReE(res, { message: 'Please enter a verification code' },
            HttpStatus.BAD_REQUEST)
    }
    if (isNull(email)) {
        return ReE(res, { message: 'Please enter a email id' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(newPassword) || newPassword.length < 8) {
        return ReE(res,
            { message: 'Please enter a password with min 8 characters.' },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(User.findOne(
        {
            'verificationCode': verificationCode,
            'email': email,
        }))

    if (err) {
        return ReE(res, err, HttpStatus.BAD_REQUEST)
    }
    if (!user) {
        return ReE(res,
            { message: 'Sorry, Please enter a valid code and email id.' },
            HttpStatus.BAD_REQUEST)
    }

    user.password = newPassword
    user.verificationCode = undefined;

    [err, user] = await to(user.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    return ReS(res,
        {
            message: 'Password reset successful. Please login with new password to continue.',
            user: {
                name: user.name,
                email: user.email,
                verified: user.emailVerified,
            },
        }, HttpStatus.OK)

}
module.exports.resetPassword = resetPassword

const login = async function (req, res) {
    let err, user, err1, roles
    const email = req.body.email
    const password = req.body.password

    if (isNull(email)) {
        return ReE(res, { message: 'Please enter an email id or phone number.' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(password)) {
        return ReE(res, { message: 'Please enter your password to login' },
            HttpStatus.BAD_REQUEST)
    }

    let userQuery = {}

    if (validator.isEmail(email)) {
        userQuery.email = email
    } else if (validator.isMobilePhone(email)) {
        userQuery.phone = email
    } else {
        return ReE(res,
            { message: 'Please enter a valid email or phone number.' },
            HttpStatus.BAD_REQUEST)
    }

    [err, user] = await to(User.findOne(userQuery))
    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    if (!user) return ReE(res,
        { message: 'User is not registered. Please register and try again.' },
        HttpStatus.BAD_REQUEST)

    if (isNull(user.email)) {
        console.log('No email for User with that phone number')

        return ReE(res, {
            message: 'Please set email and password to continue.',
            user: {
                name: user.name,
            },
            code: CONFIG.registrationStatus.EMAIL_NOT_PRESENT,
        }, HttpStatus.UNPROCESSABLE_ENTITY)

    } else if (isNull(user.password)) {
        console.log('Email present but password doesnt exist for that user')

        return ReE(res, {
            message: 'Please set a password to continue.',
            user: {
                name: user.name,
            },
            code: CONFIG.registrationStatus.PASSWORD_NOT_PRESENT,
        }, HttpStatus.UNPROCESSABLE_ENTITY)

    }

    if (!user.emailVerified) {
        return ReE(res,
            { message: 'User not verified. please verify your email and try again.' },
            HttpStatus.FORBIDDEN)
    }

    if (user.admin === true || user.role) {
        [err, user] = await to(user.comparePassword(password))

        if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

        if (!user) {
            return ReE(res,
                { message: 'Invalid Username or password. please try again.' },
                HttpStatus.BAD_REQUEST)
        }
        [err1, roles] = await to(Role.findOne({ _id: user.role }))
        if (user.admin === false) {
            if (roles) {
                ReS(res, {
                    message: 'User logged in ',
                    user: {
                        _id: user._id,

                        email: user.email,
                        verified: user.emailVerified,
                        name: user.name,
                        type: user.type,
                        admin: user.admin,
                        roleId:roles._id,
                        role: roles.role,
                    },
                    uploadToken: await user.getFirebaseAuthToken(),
                    token: user.getJWT(),
                }, HttpStatus.OK)
            }

            else if (err1) {
                return ReE(res,
                    { message: 'Role data was not found' },
                    HttpStatus.BAD_REQUEST)
            }
        }
        else {
            ReS(res, {
                message: 'User logged in ',
                user: {
                    _id: user._id,
                    email: user.email,
                    verified: user.emailVerified,
                    name: user.name,
                    type: user.type,
                    admin: user.admin,
                    // roleId:roles._id,
                },
                uploadToken: await user.getFirebaseAuthToken(),
                token: user.getJWT(),
            }, HttpStatus.OK)

        }
    }
    else {
        return ReE(res,
            { message: 'You cannot access. please contact admin.' },
            HttpStatus.BAD_REQUEST)
    }
}

module.exports.login = login

const get = async function (req, res) {
    let user = req.user

    var userId = user._id

    if (!ObjectId.isValid(userId)) {
        return ReE(res, { message: 'Please enter a valid user id.' }, 400)
    }

    let err, existingUser
    [err, existingUser] = await to(User
        .findOne({ _id: new ObjectId(userId) })
        .select('token type active _id name email phone countryCode bankAccounts billing admin role').populate({
            path: 'role',
            select: 'role'
        })
    )

    existingUser.bankAccounts = existingUser.bankAccounts.filter(
        b => b.active === true)

    existingUser.billing = existingUser.billing.filter(
        b => b.active === true)

    if (err) {
        return ReE(res, err, 400)
    } else {
        if (existingUser) {

            existingUser.uploadToken = await user.getFirebaseAuthToken()
            return ReS(res, { message: 'User found', user: existingUser },
                HttpStatus.OK)
        } else {
            return ReE(res, { message: 'User Not found' }, HttpStatus.BAD_REQUEST)
        }
    }

}
module.exports.get = get

const update = async function (req, res) {
    let err, user, data
    user = req.user
    data = req.body

    CONFIG.editableUserFields.forEach(function (field) {
        if (typeof field === 'string' && data[field] !== undefined) {
            user[field] = data[field]
        }
    })

    if (!isNull(data.type)) {

        if (isNull(user.type)) {
            user.type = []
        }
        user.type.addToSet(data.type)
    }

    [err, user] = await to(user.save())
    if (err) {
        return ReE(res, err, 400)
    }
    return ReS(res,
        {
            message: 'Updated User.',
            user: user,
        }, HttpStatus.OK,
    )
}
module.exports.update = update

const addAddress = async function (req, res) {
    let user = req.user
    let name = req.body.name
    let address = req.body.address
    let country = req.body.country
    let state = req.body.state
    let city = req.body.city
    let zip = req.body.zip
    let tel = req.body.tel
    let email = req.body.email

    var fields = [
        'name',
        'address',
        'country',
        'state',
        'city',
        'zip',
    ]

    fields.forEach(field => {
        if (isNull(req.body[field]) || req.body[field].length < 3) {
            return ReE(res, { message: `Please enter a valid ${field}` },
                HttpStatus.BAD_REQUEST)
        }
    })

    if (isNull(tel) || tel.length < 3 || tel.length > 15) {
        return ReE(res, { message: 'Please enter a valid telephone number' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(email) || !validator.isEmail(email)) {
        return ReE(res, { message: 'Please enter a valid email id' },
            HttpStatus.BAD_REQUEST)
    }

    const newAddress = {
        name: name,
        address: address,
        country: country,
        state: state,
        city: city,
        zip: zip,
        tel: tel,
        email: email,
    }

    // if (isNull(user.billing)) {
    //     user.billing = []
    // }
    user.billing.push(newAddress)

    let err;
    [err, user] = await to(user.save())
    if (err) {
        return ReE(res, err, 400)
    }
    return ReS(res,
        {
            message: 'Address Added.',
        }, HttpStatus.OK,
    )
}
module.exports.addAddress = addAddress

const deleteAddress = async function (req, res) {
    let user = req.user
    const id = req.params.id

    if (!ObjectId.isValid(id)) {
        return ReE(res, { message: 'Please provide a valid address id' },
            HttpStatus.BAD_REQUEST)
    }

    let err, existingUser;

    [err, existingUser] = await to(User.findOne(
        {
            _id: new ObjectId(user._id),
            'billing._id': new ObjectId(id),
        }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!existingUser) {
        return ReE(res,
            { message: 'Cannot find user with specified address id.' },
            HttpStatus.BAD_REQUEST)
    }

    let existingAddress = existingUser.billing.id(id)

    if (!existingAddress) {
        return ReE(res, { message: 'Cannot find specified address.' },
            HttpStatus.BAD_REQUEST)
    }

    existingAddress.active = false

    console.log('existingAddress', existingAddress)

    let editedUser;
    [err, editedUser] = await to(existingUser.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        { message: 'Address Deleted.' },
        HttpStatus.OK)

}
module.exports.deleteAddress = deleteAddress

const loginWithPhone = async function (req, res) {
    const body = req.body
    let err, user, userData

    if (typeof body.phone === 'undefined' || body.phone === '') {
        return ReE(res, {
            message: 'phone was not entered',
        }, 400)
    }

    if (body.phone.startsWith('+91')) {
        body.countryCode = '+91'
        body.phone = body.phone.replace('+91', '')
    }

    if (body.phone.startsWith('+1')) {
        body.countryCode = '+1'
        body.phone = body.phone.replace('+1', '')
    } else {
        body.countryCode = '+91'
    }

    if (validator.isMobilePhone(body.phone, ['en-IN', 'en-US'])) {
        let OTP = Math.floor(100000 + Math.random() * 900000);
        [err, user] = await to(User.findOne({ 'phone': body.phone }))
        if (err) return ReE(res, err, 422)
        else {
            if (user) {

                user.otp = OTP;

                [err, updatedUser] = await to(user.save())
                if (err) {
                    return ReE(res, err, 500)
                }

                if (updatedUser.lastOtpRequestedAt) {

                    var currentDate = new Date().toISOString()
                    var currenttime = moment(currentDate)
                        .subtract(1, 'minutes')
                    var TimeDifference = moment(updatedUser.lastOtpRequestedAt)
                        .isBefore(currenttime)

                    if (TimeDifference == false) {
                        return ReS(res, {
                            message: 'Please wait for one mintute.You will get the OTP from gofreights',
                        }, 200)
                    } else {
                        var currentDate = new Date().toISOString()
                        updatedUser.lastOtpRequestedAt = currentDate
                        updatedUser.save()

                        let message = encodeURIComponent(
                            OTP + ' is the Verification code for Gofrieghts.')

                        if (CONFIG.sms_enable === 'true') {

                            msg91.send(body.countryCode + body.phone, message,
                                function (err, response) {
                                    console.log('SMS', err, response)
                                })
                        } else {
                            console.log('Not sending SMS')
                        }

                    }

                } else {
                    var currentDate = new Date().toISOString()
                    updatedUser.lastOtpRequestedAt = currentDate
                    updatedUser.save()

                    let message = encodeURIComponent(
                        OTP + ' is the Verification code for Gofrieghts.')

                    if (CONFIG.sms_enable === 'true') {

                        msg91.send(body.countryCode + body.phone, message,
                            function (err, response) {
                                console.log('SMS', err, response)
                            })
                    } else {
                        console.log('Not sending SMS')
                    }

                }

                [err, userData] = await to(User
                    .findOne({ '_id': updatedUser._id })
                    .select('type active _id name otp phone'))

                return ReS(res, {
                    message: 'Successfully you logged in.',
                    user: userData,
                }, 200)

            } else {
                return ReE(res, {
                    message: 'User is not registered',
                }, 400)
            }
        }
    } else {
        return ReE(res, {
            message: 'Invalid phone number',
        }, 400)
    }

}
module.exports.loginWithPhone = loginWithPhone

const testNotification = async function (req, res) {

    var deviceToken = req.body.deviceToken

    if (isNull(deviceToken)) {
        return ReE(res, { message: 'No device token provided' },
            HttpStatus.BAD_REQUEST)

    }

    var cargoId = '5d445d8a16f9a111bd60832c'

    // var message = {
    //     data: {
    //         title: 'New request received from \"Shipper\" asdfasdfasfasdfasdfasfasdfasf',
    //         message: "Hello",
    //         capacity: '12 tyre 22 Ton',
    //         vehicleType: 'Open truck',
    //         loadPercentage: '50%',
    //         location: '11.0261848,77.1246531',
    //         shipmentId: cargoId,
    //         truckId: truckId
    //     },
    //     "webpush": {
    //         "fcm_options": {
    //             "link": `${CONFIG.notification_link}/carrier/view/shipmentRequestDetails/${cargoId}?truckId=${truckId}`
    //         }
    //     },
    //     token: deviceToken,
    // }

    var message = {
        data: {
            cargoId: '5e26889db50de80854682c55',
            inquiryId: '5e26889db50de80854682c56',
            mode: 'shipper',
            title: 'Shipment payment is done by shipper',
            body: 'Shipment done',
        },
        notification: {
            title: 'New Request',
            body: 'You got a request from \'ShipperN\' ',
        },
        android: {
            notification: {
                title: CONFIG.NotificationMessages.NEW_INQUIRY.title,
                body: CONFIG.NotificationMessages.NEW_INQUIRY.body,
                'click_action': 'NOTIFICATIONS',
                'sound': 'whistle.mp3',
                'channel_id': 'shipment_alert',
            },
        },
        apns: {
            'payload': {
                'aps': {
                    'sound': 'whistle.caf',
                    'badge': 25,
                },
            },
        },
        token: deviceToken,
    }
    console.log('message', message)

    notificationService
        .sendPushNotification
        .send(message).then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response)
            return ReS(res, { 'message:': 'Notification sent', response: response })

        }).catch((error) => {
            console.log('Error sending message:', error.message)
            return ReE(res, { message: `Error sending message: ${error.message}` },
                HttpStatus.INTERNAL_SERVER_ERROR)
        })
}
module.exports.testNotification = testNotification

const logout = async function (req, res) {
    let err, userData

    let user = req.user

    user.active = false;

    [err, user] = await to(user.save())
    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, {
            message: 'Successfully logged out the user',
            user: user,
        }, 200)
    }

}
module.exports.logout = logout

//Admin


const getUserByType = async function (req, res) {
    let user = req.user
    let mode = req.query.mode
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10

    let err, data
    let errs, existingUsers
    var userId = user._id

    if (!ObjectId.isValid(userId)) {
        return ReE(res, { message: 'Please enter a valid user id.' }, 400)
    }

    [errs, existingUsers] = await to(User.findOne({ _id: userId }).select('admin role').populate({ path: 'role', select: 'role' }))
    if (errs) {
        return ReE(res, { message: 'user not exists' }, 400)
    }
    else {

        let options = {
            mode: mode,
            page: page,
            limit: limit,
            select: 'type active _id email name phone countryCode',
            sort: {
                createdAt: 'desc',
            },

        };
        [err, data] = await to(User.paginate({ type: mode }, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            // if (data) {
            //     return ReS(res, {message: 'User found', user: data}, 200)
            // } else {
            //     return ReE(res, {message: 'User Not found'}, 500)
            // }
            if (existingUsers.admin === true || existingUsers.role.role.write.includes('CARRIERS')) {
                return ReS(res, { message: 'you have write access for this carrier page', isEditable: true, user: data }, HttpStatus.OK)
            }
            else if (existingUsers.role.role.read.includes('CARRIERS')) {
                return ReS(res, { message: 'you have only  read access for this carrier page', isEditable: false, user: data }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: 'you have no permission to access carrier. please contact support. ' }, 400)
            }
        }
    }

}
module.exports.getUserByType = getUserByType

const getUserByTypes = async function (req, res) {
    let user = req.user
    let mode = req.query.mode
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10

    let err, data
    let errs, existingUsers
    var userId = user._id

    if (!ObjectId.isValid(userId)) {
        return ReE(res, { message: 'Please enter a valid user id.' }, 400)
    }

    [errs, existingUsers] = await to(User.findOne({ _id: userId }).select('admin role').populate({ path: 'role', select: 'role' }))
    if (errs) {
        return ReE(res, { message: 'user not exists' }, 400)
    }
    else {

        let options = {
            mode: mode,
            page: page,
            limit: limit,
            select: 'type active _id email name phone countryCode role',
            sort: {
                createdAt: 'desc',
            },
            populate: [{ path: 'role', select: 'userId role' }]
        };
        [err, data] = await to(User.paginate({ type: mode }, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            // if (data) {
            //     return ReS(res, {message: 'User found', user: data}, 200)
            // } else {
            //     return ReE(res, {message: 'User Not found'}, 500)
            // }
            if (existingUsers.admin === true || existingUsers.role.role.write.includes('MANAGEMENT')) {
                return ReS(res, { message: 'you have write access for this management page', isEditable: true, user: data }, HttpStatus.OK)
            }
            else if (existingUsers.role.role.read.includes('MANAGEMENT')) {
                return ReS(res, { message: 'you have only  read access for this management page', isEditable: false, user: data }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: 'you have no permission to access management. please contact support. ' }, 400)
            }
        }
    }

}
module.exports.getUserByTypes = getUserByTypes

const getUserDriver = async function (req, res) {
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10
    let user=req.user
    let err, driver

    var userId = req.params.userId

    console.log(userId)
    let errs, existingUser
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
        if (!ObjectId.isValid(userId)) {
            return ReE(res, { message: 'Please enter a valid user id.' }, 400)
        }

        let options = {
            page: page,
            limit: limit,
            populate: [
                {
                    path: 'vendor',
                    select: 'name email _id',
                }
            ],
            sort: {
                createdAt: 'desc',
            },
        };

        [err, driver] = await to(
            Driver.paginate({ vendor: new ObjectId(userId) }, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            if (driver) {
                if (driver) {
                    if ( existingUser.admin === true || existingUser.role.role.write.includes('CARRIERS') || existingUser.role.role.write.includes('MANAGEMENT')) {
                        return ReS(res, { message: 'You have write access for this Users driver page.', isEditable: true, user: driver }, HttpStatus.OK)
                    }
                    else {
                        return ReE(res, { message: "You don't have permission to access users driver page. Please contact support." }, 400)
                    }
                }
            } else {
                return ReE(res, { message: 'User Not found' }, 500)
            }
        }
    }
}
module.exports.getUserDriver = getUserDriver

const getUserTruck = async function (req, res) {
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10
    let user=req.user
    let err, truck

    var userId = req.params.userId


    if (!ObjectId.isValid(userId)) {
        return ReE(res, { message: 'Please enter a valid user id.' }, 400)
    }
    let errs, existingUser
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
                    path: 'vendor',
                    select: 'name email _id',
                },
            ],
            sort: {
                createdAt: 'desc',
            },
        };

        [err, truck] = await to(
            Truck.paginate({ vendor: new ObjectId(userId) }, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            if (truck) {
                console.log(existingUser);
                
                if ( existingUser.admin === true || existingUser.role.role.write.includes('CARRIERS') || existingUser.role.role.write.includes('MANAGEMENT') ) {
                    return ReS(res, { message: 'You have write access for this Users truck page.', isEditable: true, user: truck }, HttpStatus.OK)
                }
                else {
                    return ReE(res, { message: "You don't have permission to access users truck page. Please contact support." }, 400)
                }
            } else {
                return ReE(res, { message: 'User Not found' }, 500)
            }
        }
    }
}
module.exports.getUserTruck = getUserTruck

const addBankAccount = async function (req, res) {
    const user = req.user
    const accountHolderName = req.body.accountHolderName
    const bankName = req.body.bankName
    const accountType = req.body.accountType
    const accountNumber = req.body.accountNumber
    const ifscCode = req.body.ifscCode
    const branchAddress = req.body.branchAddress
    const attachment = req.body.attachment
    const description = req.body.description
    const gstNumber = req.body.gstNumber
    const transporterId = req.body.transporterId

    if (isNull(accountHolderName)) {
        return ReE(res, 'Please enter a account holder name.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(bankName)) {
        return ReE(res, 'Please enter a bank name.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(accountType)) {
        return ReE(res, 'Please enter a account type.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(accountNumber)) {
        return ReE(res, 'Please enter a account number.',
            HttpStatus.BAD_REQUEST)
    }

    var err, existingAccount;
    [err, existingAccount] = await to(
        User.findOne({
            '_id': new ObjectId(user._id),
            'bankAccounts.accountNumber': accountNumber.trim(),
        }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (existingAccount) {
        return ReE(res, 'The account number is already exists.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(ifscCode)) {
        return ReE(res, 'Please enter a valid ifsc code.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(branchAddress)) {
        return ReE(res, 'Please enter a branch address.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(attachment)) {
        return ReE(res, 'Please upload a attachment.',
            HttpStatus.BAD_REQUEST)
    }

    var regExp = new RegExp(
        '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9]{1}?\$')

    if (!isNull(gstNumber)) {

        if (!regExp.test(gstNumber)) {
            return ReE(res,
                { message: 'Please enter a valid GST Number.' },
                HttpStatus.BAD_REQUEST)
        } else {
            console.log('valid')
        }
    }

    let newBankDetails = {
        accountHolderName: accountHolderName.capitalize(),
        bankName: bankName.trim(),
        accountType: accountType,
        accountNumber: accountNumber,
        ifscCode: ifscCode.trim(),
        branchAddress: branchAddress.trim(),
        attachment: attachment,
        description: description ? description : undefined,
    }

    if (!isNull(gstNumber)) {
        newBankDetails.gstNumber = gstNumber.trim()
    }

    if (!isNull(transporterId)) {
        newBankDetails.transporterId = transporterId
    }

    user.bankAccounts.push(newBankDetails)

    let updatedUser;
    [err, updatedUser] = await to(user.save())
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    return ReS(res,
        {
            message: 'Bank details Added.',
        }, HttpStatus.OK,
    )

}
module.exports.addBankAccount = addBankAccount

const getUserDetails = async function (req, res) {

    var id = req.params.id

    if (!ObjectId.isValid(id)) {
        return ReE(res, { message: 'Please enter a valid user id.' },
            HttpStatus.BAD_REQUEST)
    }

    let err, existingUser;
    [err, existingUser] = await to(
        User.findById(id).select('name email phone countryCode bankAccounts'))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!existingUser) {
        return ReE(res, { message: 'User not found' }, HttpStatus.OK)
    }
    return ReS(res,
        { message: 'User found', user: existingUser }, HttpStatus.OK)

}
module.exports.getUserDetails = getUserDetails

const getAllBankAccounts = async function (req, res) {
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let user = req.user
    let errs, existingUser
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
            select: '_id name email phone countryCode',
            sort: {
                createdAt: 'desc',
            },
        }

        let query = [
            [
                {
                    '$match': {
                        'bankAccounts.active': true,
                    },
                },
                {
                    '$unwind': {
                        'path': '$bankAccounts',
                        'preserveNullAndEmptyArrays': false,
                    },
                },
                {
                    '$match': {
                        'bankAccounts.active': true,
                    },
                },
                {
                    '$project': {
                        '_id': '$bankAccounts._id',
                        'user': {
                            '_id': '$_id',
                            'name': '$name',
                            'phone': {
                                '$concat': [
                                    '$countryCode', '$phone',
                                ],
                            },
                        },
                        'accountHolderName': '$bankAccounts.accountHolderName',
                        'accountNumber': '$bankAccounts.accountNumber',
                        'ifscCode': '$bankAccounts.ifscCode',
                        'attachment': '$bankAccounts.attachment',
                        'verified': '$bankAccounts.verified',
                        'active': '$bankAccounts.active',
                        'status': '$bankAccounts.status',
                        'createdAt': '$bankAccounts.createdAt',
                    },
                },
            ],
        ]

        // console.log('query: ', JSON.stringify(query, null, '\t'))

        let err, bankAccounts;
        [err, bankAccounts] = await to(
            User.aggregatePaginate(User.aggregate(query), options))

        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        } else {
            if (existingUser.admin === true || existingUser.role.role.write.includes('PAYOUTS')) {
                return ReS(res, { message: 'You have write access for this Payouts  page.', isEditable: true, bankAccounts: bankAccounts }, HttpStatus.OK)
            }
            else if (existingUser.role.role.read.includes('PAYOUTS')) {
                return ReS(res, { message: 'You have only read access for this Payouts page.', isEditable: false, bankAccounts: bankAccounts }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: "You don't have permission to access trucks. Please contact support." }, 400)
            }
        }
    }

}
module.exports.getAllBankAccounts = getAllBankAccounts


const deleteBankAccount = async function (req, res) {
    let user = req.user
    const id = req.params.id

    if (!ObjectId.isValid(id)) {
        return ReE(res, { message: 'Please provide a valid bank account id' },
            HttpStatus.BAD_REQUEST)
    }

    let err, existingUser;

    [err, existingUser] = await to(User.findOne(
        {
            _id: new ObjectId(user._id),
            'bankAccounts._id': new ObjectId(id),
        }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!existingUser) {
        return ReE(res,
            { message: 'Cannot find user with specified bank account.' },
            HttpStatus.BAD_REQUEST)
    }

    let existingBankAccount = existingUser.bankAccounts.id(id)

    if (!existingBankAccount) {
        return ReE(res, { message: 'Cannot find specified bank account.' },
            HttpStatus.BAD_REQUEST)
    }

    existingBankAccount.active = false

    console.log('existingBankAccount', existingBankAccount)

    let editedUser;
    [err, editedUser] = await to(existingUser.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        { message: 'Bank Account Deleted.' },
        HttpStatus.OK)

}

module.exports.deleteBankAccount = deleteBankAccount


const userRole = async function (req, res) {
    const userData = req.user; //get user response
    const reqUser = req.body;//get Api request data
    var user;
    try {
        user = await User.findOne({ _id: userData._id });//find the current user data 
        if (user) {
            if ((user.admin === true) || (user.role.name === 'admin')) { //check the current user was amdin or not
                if (!reqUser.role) {
                    return res.status(500).json({ success: false, error: "user role was importent to update user so select user role" })// the current user was not a admin sent error msg to dashborad
                }
                else {
                    role = await Role.findOne({ 'role.name': reqUser.role, userId: user._id });//try to find user selected role in that Role collection
                    if (role.role.write === '' && role.role.read === '') {
                        return res.status(500).json({ success: false, error: "Sorry please add any access for this role" })// the current user was not a admin sent error msg to dashborad
                    }
                    else {
                        try {
                            const data = await User.updateOne({ _id: reqUser.userId }, {
                                $set: {
                                    role: role._id
                                }
                            }); //update the userModel and store response into data 
                            if (data.nModified) {
                                return res.status(200).send({ success: true, message: 'role added successfully', data: data });    //send response into backend     
                            }
                            else {
                                return res.status(500).json({ success: false, error: "Sorry connot find user role" })
                            }
                        }
                        catch (err) {
                            return res.status(500).send({ success: false, error: 'user update function error' })
                        }

                    }

                }
            }
            else {
                return res.status(500).json({ success: false, error: "Admin only able to update the user role" })// the current user was not a admin sent error msg to dashborad
            }
        }
        else {
            return res.status(500).send({ success: false, error: 'user finding error' })
        }
    }
    catch (err) {
        return res.status(401).send({ success: false, error: 'user finding error' })
    }
}
module.exports.userRole = userRole

exports.getUserList = async (req, res) => {
    let user = req.user;
    let param = req.params;
    let users, err
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let options = {
        page: page,
        limit: limit,
        sort: {
            createdAt: 'desc',
        },
        populate: [{
            path: 'role',
        }]
    }
    console.log(param);
    if (user.admin===true) {
        if (isNull(param.id)) return ReE(res, { message: 'Organization Id has to be given' },
            HttpStatus.BAD_REQUEST)
        else {
            [err, users] = await to(User.paginate({ 'organization.id': param.id }, options))
            if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            if (!isEmpty(users.docs)) {
                return ReS(res, {
                    isEditable: true,
                    message: 'Users fetched  successfully',
                    user: users,
                }, HttpStatus.OK)
            }
            else {
                return ReS(res, { message: 'There are no users', user: users, isEditable: true }, HttpStatus.OK)
            }
        }
    }
    else {
        return ReE(res, { message: "You don't have permission to access organization,Please contact admin." }, HttpStatus.BAD_REQUEST)
    }
}