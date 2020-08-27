const {User, Cargo, Truck, Driver, Notification} = require('../models')
const authService = require('../services/auth.service')
const {to, ReE, ReS, isNull, isEmpty} = require('../services/util.service')
const ObjectId = require('mongoose').Types.ObjectId
const moment = require('moment')
const CONFIG = require('../config/config')
const HttpStatus = require('http-status')
const notificationService = require('../services/notification.service')

const createNotification = async function (options) {
    
    let newNotification = {
        from: options.from,
        to: options.to,
        carrier: options.carrier,
        shipper: options.shipper,
        title: options.title,
        body: options.body,
        cargo: options.cargo,
        inquiry: options.inquiry,
    }
    
    console.log('newNotification', newNotification)
    
    let err, notification;
    
    [err, notification] = await to(Notification.create(newNotification))
    
    if (err) {throw err}
    
    return notification
    
}
module.exports.createNotification = createNotification

const getNotifications = async function (req, res) {
    
    let mode = req.query.mode
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let user = req.user
    let err
    
    if (mode === 'shipper' || isNull(mode)) {
        
        if (!req.user.type.includes('shipper')) {
            return ReE(res,
                {message: 'Unable to process. You need to be a shipper to get shipper notifications.'},
                HttpStatus.FORBIDDEN)
        }
        
        let shipperId = new ObjectId(user._id)
        let notifications
        
        let options = {
            page: page,
            limit: limit,
            populate: [
                {path: 'from to', select: 'name phone _id'},
                {path: 'cargo'},
                {path: 'inquiry'}],
            sort: {
                createdAt :'desc'
            }
        };
    
        console.log('Options:',options);
        
            [err, notifications] = await to(Notification.paginate({
            to: shipperId,
            shipper: shipperId,
        }, options))
        
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        
        return ReS(res,
            {
                mode: mode,
                notifications: notifications}, HttpStatus.OK)
    } else if (mode === 'carrier') {
        if (!req.user.type.includes('carrier')) {
            return ReE(res,
                {message: 'Unable to process. You need to be a carrier to get carrier inquiries.'},
                HttpStatus.FORBIDDEN)
        }
    
        let carrierId = new ObjectId(user._id)
        let notifications
    
        let options = {
            page: page,
            limit: limit,
            populate: [
                {path: 'from to', select: 'name phone _id'},
                {path: 'cargo'},
                {path: 'inquiry'},
            ],
            sort: {
                createdAt :'desc'
            }
        };
        
        console.log('Options:',options);
        [err, notifications] = await to(Notification.paginate({
            to: carrierId,
            carrier: carrierId,
        }, options))
    
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
    
        return ReS(res,
            {
                mode: mode,
                notifications: notifications}, HttpStatus.OK)
        
    }
    
}
module.exports.getNotifications = getNotifications

const updateNotification = async function (req, res) {
    let err, notification, data, updatedNotification
    let user = req.user
    data = req.body
    
    let notificationId = req.params.id
    
    if (!ObjectId.isValid(notificationId)) {
        return ReE(res, {message: 'please provide valid notification Id'}, 400)
    }
    ;
    
    [err, notification] = await to(
        Notification.findOne({'_id': new ObjectId(notificationId)}))
    
    if (err) {
        return ReE(res, err, 400)
    } else {
        if (notification) {
            
            CONFIG.editableNotificationFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    notification[field] = data[field]
                }
            });
            
            [err, updatedNotification] = await to(notification.save())
            
            if (err) {
                return ReE(res, err, 400)
            }
            
            return ReS(res, {
                message: 'Notification is Updated.',
                notification: updatedNotification,
            }, 200)
            
        } else {
            return ReE(res, 'Notification not found', 400)
        }
    }
}
module.exports.updateNotification = updateNotification

const getPageNotifications = async function (req, res) {
    let user = req.user
    let limit = 10
    let current_page = 1
    var err, getNotifications, message
    
    if (req.query.page) {
        current_page = req.query.page
    }
    
    let schedule_date = new Date()
    
    let afterDate = moment(schedule_date).subtract(7, 'days').format()
    
    var options = {
        populate: [
            {
                path: 'truck',
                select: 'name registrationNumber transportName _id type subtype capacity',
            }, ,
            {path: 'from to', select: 'name email _id'},
            {
                path: 'cargo',
                select: 'fromLocation toLocation fromAddress1 fromCity toAddress1 toCity status',
            },
        ],
        lean: true,
        page: current_page,
        limit: limit,
        sort: {createdAt: -1},
    };
    
    [err, getNotifications] = await to(Notification.paginate({
        'createdAt': {'$gte': afterDate},
        '$or': [{'to': user._id}, {'from': user._id}],
    }, options))
    
    if (err) {
        return ReE(res, err, 500)
    } else {
        return ReS(res, {
            message: 'Successfully got the notifications',
            notifications: getNotifications,
        }, 200)
    }
    
}
module.exports.getPageNotifications = getPageNotifications

const sendNotification = async function (userId, options) {
    
    console.log("userId",userId);
    
    let err,foundUser;
    [err, foundUser] = await to(User.findById(userId).select('notificationToken'))
    
    if (err) {
        console.log(err)
        return
    }
    
    if (!foundUser) {
        console.log('Cannot send notification: User not found.')
        return
    }
    
    if (foundUser.notificationToken) {
        
        var message = {
            data: {
                title: options.title,
                body: options.body,
                mode: options.mode,
            },
            android: {
                notification: {
                    title:options.title,
                    body: options.body,
                    'click_action': options.click_action || 'NOTIFICATIONS',
                    'sound': options.sound || 'whistle.mp3',
                    'channel_id': options.channel_id || 'shipment_alert',
                },
            },
            'webpush': {
                'fcm_options': {
                    'link': `${CONFIG.notification_link}/carrier/view/shipmentRequestDetails/${options.cargoId}?truckId=${options.truckId}`,
                    // "link": `${CONFIG.notification_link}`
                },
            },
            apns: {
                'payload': {
                    'aps': {
                        'sound': options.sound || 'whistle.caf',
                    },
                },
            },
            token: foundUser.notificationToken,
        }
        
        
        if(!isNull(options.cargo)){
            message.data.cargo = options.cargo.toString()
        }
    
        if(!isNull(options.inquiry)){
            message.data.inquiry = options.inquiry.toString()
        }
        
    
        if(!isNull(options.driver)){
            message.data.driver = options.driver.toString()
        }
    
        if(!isNull(options.latitude)){
            message.data.latitude = options.latitude.toString()
        }
    
        if(!isNull(options.longitude)){
            message.data.longitude = options.longitude.toString()
        }
        
        console.log('Sending message', message)
        notificationService.sendPushNotification.send(message)
            .then((response) => {
                // Response is a message ID string.
                console.log('Successfully sent message:', response)
                
            })
            .catch((error) => {
                console.log('Error sending message:', error.message)
            })
    } else {
        console.log('No device token, skipping notification')
    }
    
}
module.exports.sendNotification = sendNotification


