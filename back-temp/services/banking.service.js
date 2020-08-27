// const got = require('got')
const CONFIG = require('../config/config')
const app = require('../package')
const server = require('request-promise')
const url = CONFIG.hdfc_rsa_url
const apiUrl = CONFIG.hdfc_api_url
var crypto = require('crypto')
const querystring = require('querystring')
const ivector = Buffer.from([
    0x00,
    0x01,
    0x02,
    0x03,
    0x04,
    0x05,
    0x06,
    0x07,
    0x08,
    0x09,
    0x0a,
    0x0b,
    0x0c,
    0x0d,
    0x0e,
    0x0f])

const getRSAKey = async (orderId) => {
    
    return new Promise(async (resolve, reject) => {
        
        const form = {
            access_code: CONFIG.hdfc_accesscode,
            order_id: orderId,
        }
        
        var options = {
            method: 'POST',
            uri: url + '/transaction/getRSAKey',
            headers: {
                'Content-Type': 'application/json',
            },
            form: form,
            json: true,
        }
        
        server(options).then(function (response) {
            // console.log(response)
            resolve(response)
        }).catch(function (err) {
            reject(err)
        })
    })
    
    // await got.post('https://enwzutv4pafei.x.pipedream.net/api/users', {
    //     // headers: {
    //     //     'user-agent': `WhistleFreights/${app.version}`,
    //     // },
    //     form: {
    //         access_code: "AVVJ89HA86BD29JVDB",
    //         order_id: orderId
    //     },
    // })
    
}
module.exports.getRSAKey = getRSAKey

const getSecureToken = async (requestId) => {
    
    return new Promise(async (resolve, reject) => {
        
        let generated_hash = sha512(
            requestId + CONFIG.hdfc_wkey + CONFIG.hdfc_merchant_id)
        
        console.log('requestId', requestId)
        console.log('accessCode', CONFIG.hdfc_accesscode)
        console.log('requestHash', generated_hash)
        
        const form = {
            requestId: requestId,
            accessCode: CONFIG.hdfc_accesscode,
            requestHash: generated_hash,
        }
        
        var options = {
            method: 'POST',
            uri: url + '/TransCcAvenue/v2/getSecureToken',
            headers: {
                'Content-Type': 'application/json',
            },
            form: form,
            json: true,
        }
        
        server(options).then(function (response) {
            // console.log(response)
            resolve(response)
        }).catch(function (err) {
            reject(err)
        })
    })
    
}
module.exports.getSecureToken = getSecureToken

const getResponseHash = async (orderId, amount) => {
    
    return new Promise(async (resolve, reject) => {
        
        const form = {
            orderId: orderId,
            accessCode: CONFIG.hdfc_accesscode,
            amount: amount,
            currency: 'INR',
        }
        
        var options = {
            method: 'POST',
            uri: url + '/TransCcAvenue/v2/getRequestHash',
            headers: {
                'Content-Type': 'application/json',
            },
            form: form,
            json: true,
        }
        
        server(options).then(function (response) {
            // console.log(response)
            resolve(response)
        }).catch(function (err) {
            reject(err)
        })
    })
    
}
module.exports.getResponseHash = getResponseHash

const getOrderStatus = async (orderId) => {
    
    let toEncrypt = JSON.stringify({order_no: orderId})
    let encRequest = aesEncrypt(toEncrypt, CONFIG.hdfc_wkey)
    
    return new Promise(async (resolve, reject) => {
        
        const form = {
            access_code: CONFIG.hdfc_accesscode,
            order_no: orderId,
            version: 1.1,
            response_type: 'JSON',
            request_type: 'JSON',
            command: 'orderStatusTracker',
            enc_request: encRequest,
        }
        
        var options = {
            method: 'POST',
            uri: apiUrl + '/apis/servlet/DoWebTrans',
            // headers: {
            //     'Content-Type': 'application/json',
            // },
            form: form,
            json: true,
        }
        
        server(options).then(function (response) {
            // console.log(response)
            let parsed
            try {
                parsed = querystring.parse(response)
            } catch (e) {
                reject(new Error('Unable to parse response.'))
                return
            }
            
            if (parsed.status == 1) {
                reject(new Error(
                    `HDFC: Unable to fetch order from HDFC: ${parsed.enc_response}`))
                
            } else if (parsed.status == 0) {
                console.log('Fetched existing order from HDFC')
                // console.log('parsed', parsed)
                
                let decrypted
                try {
                    decrypted = aesDecrypt(parsed.enc_response,
                        CONFIG.hdfc_wkey)
                } catch (err) {
                    console.log('Decryption Error', err)
                    reject(new Error('Unable to read response sent by server'))
                }
                
                resolve(JSON.parse(decrypted))
            } else {
                reject(new Error('HDFC: Unknown order status.'))
            }
            
        }).catch(function (err) {
            reject(err)
        })
    })
    
    
}
module.exports.getOrderStatus = getOrderStatus

const sha512 = (str) => {
    var hashingTool = crypto.createHash('sha512')
    let data = hashingTool.update(str)
    return data.digest('hex')
}
module.exports.sha512 = sha512

function md5 (string) {
    return crypto.createHash('md5').update(string).digest('hex')
}

module.exports.md5 = md5

function aesEncrypt (encMessage, encKey) {
    const keymd5 = md5(encKey)
    const key = Buffer.from(keymd5, 'hex')
    const iv = Buffer.from(ivector, 'hex')
    const cipher = crypto.createCipheriv(getAlgorithm(encKey), key, iv)
    let encrypted = cipher.update(encMessage, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
}

module.exports.aesEncrypt = aesEncrypt

function aesDecrypt (encMessage, encKey) {
    const keymd5 = md5(encKey)
    const key = Buffer.from(keymd5, 'hex')
    const iv = Buffer.from(ivector, 'hex')
    const message = Buffer.from(encMessage, 'hex')
    const decipher = crypto.createDecipheriv(getAlgorithm(encKey), key, iv)
    // decipher.setAutoPadding(false);
    let decrypted = decipher.update(message)
    decrypted += decipher.final()
    return decrypted
}

module.exports.aesDecrypt = aesDecrypt

function getAlgorithm (keyBase64) {
    var key = Buffer.from(keyBase64, 'hex')
    switch (key.length) {
        case 16:
            return 'aes-128-cbc'
        case 32:
            return 'aes-256-cbc'
    }
    throw new Error('Invalid key length: ' + key.length)
}

module.exports.getAlgorithm = getAlgorithm

