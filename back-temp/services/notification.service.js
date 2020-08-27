const CONFIG = require('../config/config')
const msg91 = require('msg91')(CONFIG.sms_auth_key, CONFIG.sms_sender_id,
    CONFIG.sms_route_id)
const admin = require('firebase-admin')

const moment = require('moment')
var Mailgun = require('mailgun-js')
var mailgun = new Mailgun(
    {apiKey: CONFIG.mg_key,
        domain: CONFIG.mg_domain})

var firebaseApp
try {
    firebaseApp = admin.initializeApp({
        
        credential: admin.credential.cert({
            projectId: CONFIG.firebase_project_id,
            clientEmail: CONFIG.firebase_client_email,
            privateKey: CONFIG.firebase_privatekey,
        }),
    })
} catch (e) {
    console.log('Firebase error', e.message)
}

const sendSms = async (countryCode, phone, message) => {
    return new Promise(async (resolve, reject) => {
        if (CONFIG.sms_enable === 'true') {
            msg91.send(countryCode + phone, message, function (err, response) {
                console.log('MSG91 SMS', err, response)
                if (err) {
                    reject(err)
                }
                if (response) {
                    resolve(response)
                } else {
                    reject(new Error('MSG91. Unknown error'))
                }
                
            })
        } else {
            resolve('SMS disabled.')
        }
    })
}
module.exports.sendSms = sendSms

if (firebaseApp) {
    exports.sendPushNotification = firebaseApp.messaging()
    exports.admin = firebaseApp
} else {
    exports.sendPushNotification = () => {
        return 'Firebase not initialized'
    }
}



exports.sendEmail = function (destination, options) {
    
    var data = {
        //Specify email data
        from: 'Whistle Freights<hello@whistlefreights.com>',
        //The email to contact
        to: destination,
        //Subject and text data
        subject: options.subject,
        html: options.body
    }
    
    if (options.cc) {
        data.cc = options.cc
    }
    
    return new Promise((resolve, reject) => {
        
        if (CONFIG.send_email === 'false') {
            var message = "Not sending Email, Email Disabled"
            reject(new Error(message))
            return
        }
        mailgun.messages().send(data, function (err, response) {
            //If there is an error, render the error page
            if (err) {
                reject(err)
                return
            }
            resolve({
                destination: destination,
                response: response
            })
        })
    })
    
    
}




