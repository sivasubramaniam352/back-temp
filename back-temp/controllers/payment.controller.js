const { User, Cargo, Payment, RazorpayCallback, HdfcCallback, CardRequest, Truck } = require(
    '../models')
const { to, ReE, ReS, isNull, isEmpty } = require('../services/util.service')
const { ObjectId } = require('mongoose').Types
const CONFIG = require('../config/config')
const validator = require('validator')
const moment = require('moment')
const HttpStatus = require('http-status')
const Razorpay = require('razorpay')
const querystring = require('querystring')
const notificationService = require('../services/notification.service')
const { getOrderStatus } = require('../services/banking.service')
const {
    aesEncrypt,
    aesDecrypt,
    getAlgorithm,
    md5,
    getSecureToken,
    getResponseHash,
    sha512,
    getRSAKey,
} = require('../services/banking.service')

const { validateStatus } = require('./cargo.controller')
const { setTruckAvailability } = require('./truck.controller')
const { generateNotification } = require('./cargo.controller')

var instance = new Razorpay({
    key_id: CONFIG.razorpay_key_id,
    key_secret: CONFIG.razorpay_secret,
})

const initiatePayment = async function (req, res) {
    const user = req.user
    const cargoId = req.body.cargo
    var amount = req.body.amount
    var advanceAmount = req.body.advanceAmount
    const currency = req.body.currency
    const carrierPANCardNumber = req.body.carrierPANCardNumber

    if (!ObjectId.isValid(cargoId)) {
        return ReE(res, { message: 'please provide valid Cargo Id' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(amount) ||
        !validator.isNumeric(amount) ||
        amount < 100) {
        return ReE(res,
            { message: 'Please enter a valid amount (min 100 paise)' },
            HttpStatus.BAD_REQUEST)
    }

    amount = parseInt(amount)

    // console.log("amount",amount)

    if (isNull(advanceAmount) ||
        !validator.isNumeric(advanceAmount) ||
        advanceAmount < 100) {

        advanceAmount = parseInt(advanceAmount)
        // console.log("advanceAmount",advanceAmount)
        if (advanceAmount > amount) {
            return ReE(res,
                { message: 'Please enter a valid advance Amount (min 100 paise max total freight)' },
                HttpStatus.BAD_REQUEST)
        }

    }

    if (advanceAmount < ((CONFIG.min_advance_payment_percent / 100) * amount)) {
        return ReE(res,
            { message: `Please enter a valid advance Amount (atleast ${CONFIG.min_advance_payment_percent}% of total freight charges.)` },
            HttpStatus.BAD_REQUEST)
    }

    var regExp = new RegExp('^([a-zA-Z]){5}([0-9]){4}([a-zA-Z]){1}?$')
    if (isNull(carrierPANCardNumber) ||
        !regExp.test(carrierPANCardNumber)) {
        return ReE(res,
            { message: 'Please enter a valid PAN card Number.' },
            HttpStatus.BAD_REQUEST)
    }

    // res.json({"message": "Valid"})
    //     // return

    let err, cargo;
    [err, cargo] = await to(Cargo.findOne({ '_id': cargoId }).populate({
        path: 'truck',
        select: 'name registrationNumber transportName _id type subtype',
    }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!cargo) {
        return ReE(res, { message: 'Cargo not found' }, HttpStatus.BAD_REQUEST)
    }

    console.log('acceptedFare', cargo.acceptedFare)

    if (amount > ((1 + (20 / 100)) * cargo.acceptedFare * 100) ||
        amount < ((1 - (20 / 100)) * cargo.acceptedFare * 100)) {
        return ReE(res,
            { message: `Please enter a valid Amount (Cannot be more/less than 20% of total fare.)` },
            HttpStatus.BAD_REQUEST)
    }

    if (cargo.status !== 'ACCEPTED') {
        return ReE(res,
            { message: 'Cannot generate payment request for this cargo. Invalid status' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(cargo.truck)) {
        return ReE(res,
            { message: 'Cannot generate payment request for this cargo. No truck assigned' },
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(cargo.carrier)) {
        return ReE(res,
            { message: 'Cannot request payment, Carrier not present in cargo.' },
            HttpStatus.FORBIDDEN)
    }

    if (!cargo.carrier.equals(user._id)) {
        return ReE(res,
            { message: 'Cannot request payment, only carrier of this cargo can request payment.' },
            HttpStatus.FORBIDDEN)
    }

    let existingPayment;
    [err, existingPayment] = await to(Payment.findOne({
        cargo: new ObjectId(cargo._id),
    }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (existingPayment) {
        return ReE(res, {
            message: 'Payment request already exists for that cargo',
            payment: existingPayment,
        }, HttpStatus.CONFLICT)
    }

    const newPayment = {
        totalAmount: amount,
        advanceAmount: advanceAmount,
        cargo: cargo._id.toString(),
        readableCargoId: cargo.readableId,
        carrierPANCardNumber: carrierPANCardNumber,
        truck: {
            registrationNumber: cargo.truck.registrationNumber,
            name: cargo.truck.name,
            typeDisplayName: cargo.type.displayName,
            subtype: cargo.type.subtype,
        },
        user: cargo.shipper,
    }

    let payment;
    [err, payment] = await to(Payment.create(newPayment))
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    cargo.status = 'PAYMENT_REQUESTED'
    cargo.payment = payment._id;

    [err, cargo] = await to(cargo.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    try {
        await generateNotification(cargo.status, cargo, req.user)
    } catch (err) {
        console.log(err.message)
    }

    return ReS(res, {
        message: 'Payment request created',
        payment: payment,
    }, HttpStatus.OK)

}
module.exports.initiatePayment = initiatePayment

const startTransaction = async function (req, res) {
    const paymentId = req.params.id
    const paymentType = req.body.paymentType
    const gateway = req.body.gateway || 'RAZOR_PAY'

    if (!ObjectId.isValid(paymentId)) {
        return ReE(res, { message: 'Please provide a valid Payment Id' },
            HttpStatus.BAD_REQUEST)
    }

    if (!CONFIG.paymentTypes.includes(paymentType)) {
        return ReE(res, 'Please select a valid Payment Type.',
            HttpStatus.BAD_REQUEST)
    }

    // let err, cargo;
    // [err, cargo] = await to(Cargo.findById(payment.cargo._id))
    //
    // if (err) {
    //     return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    // }
    //
    // if (!cargo) {
    //     return ReE(res, {message: 'Cargo not found'}, HttpStatus.BAD_REQUEST)
    // }
    //

    let existingPayment;
    [err, existingPayment] = await to(Payment.findById(new ObjectId(paymentId)))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!existingPayment) {
        return ReE(res, { message: 'Payment not found' },
            HttpStatus.BAD_REQUEST)
    }

    let newOrder = {}
    let rOrder = {}
    let newTransaction = {}

    switch (paymentType) {
        case 'ADVANCE':

            let foundTransaction = existingPayment.transactions.find(t => {
                return t.type === paymentType &&
                    t.gatewayType === gateway
            },
            )

            if (foundTransaction) {

                return ReS(res, {
                    message: 'Advance transaction already exists.',
                }, HttpStatus.CONFLICT)

            } else {

                let fullAmount = existingPayment.totalAmount
                let amount = existingPayment.advanceAmount
                let convenience = fullAmount *
                    (CONFIG.convenience_fee_percent / 100)
                let gst = convenience * (CONFIG.gst_percent / 100)
                let totalAmount = amount + convenience + gst

                let note = ''
                switch (gateway) {
                    case 'HDFC':
                        console.log('HDFC gateway selected')

                        if (CONFIG.hdfc_enable === 'false') {
                            let message = 'This payment method is unavailable right now, please try again later.'
                            console.log(message)
                            return ReE(res, message,
                                HttpStatus.SERVICE_UNAVAILABLE)
                        }

                        newTransaction = {
                            gatewayType: 'HDFC',
                            type: 'ADVANCE',
                            amount: Math.round(totalAmount),
                            convenienceFee: convenience,
                            gst: gst,
                            totalAmount: totalAmount,
                            description: 'Advance payment',
                            transactionStatus: 'INITIATED',
                            remoteTransactionId: existingPayment
                                .readableCargoId + 'A',
                            hdfcAccessCode: CONFIG.hdfc_accesscode,
                            initiatedTime: moment().toISOString(),
                        }
                        existingPayment.transactions.push(newTransaction)
                        existingPayment.remainingAmount = existingPayment.totalAmount -
                            existingPayment.advanceAmount;

                        [err, existingPayment] = await to(
                            existingPayment.save())

                        if (err) {
                            console.log('Unable to save payment request.')
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)
                        }

                        let newTr = existingPayment.transactions.find(
                            t => t.remoteTransactionId ===
                                newTransaction.remoteTransactionId)

                        return ReS(res, {
                            message: 'Advance Payment order created',
                            addressPresent: req.user.billing.length !== 0,
                            address: req.user.billing[0],
                            transaction: newTr,
                            hdfcAccessCode: CONFIG.hdfc_accesscode,
                        }, HttpStatus.OK)
                    case 'RAZOR_PAY':

                        console.log('Razorpay gateway selected')

                        if (CONFIG.razorpay_enable === 'false') {
                            let message = 'This payment method is unavailable right now, please try again later.'
                            console.log(message)
                            return ReE(res, message,
                                HttpStatus.SERVICE_UNAVAILABLE)
                        }

                        note = `Adv${existingPayment.readableCargoId}`
                        console.log('note:', note)

                        // let fullAmount = existingPayment.totalAmount
                        // let amount = existingPayment.advanceAmount
                        // let convenience = fullAmount *
                        //     (CONFIG.convenience_fee_percent / 100)
                        // let gst = convenience * (CONFIG.gst_percent / 100)
                        // let totalAmount = amount + convenience + gst

                        newOrder = {
                            amount: Math.round(totalAmount),
                            currency: 'INR',
                            payment_capture: true,
                            receipt: existingPayment.cargo._id.toString(),
                            notes: note,
                        }

                        console.log('newOrder', newOrder)

                        try {
                            rOrder = await instance.orders.create(newOrder)
                        } catch (e) {
                            console.error('Rpay error', e)
                            return ReE(res, e.error.description,
                                HttpStatus.INTERNAL_SERVER_ERROR)
                        }

                        console.log('New order created', rOrder)

                        newTransaction = {
                            gatewayType: 'RAZOR_PAY',
                            type: 'ADVANCE',
                            amount: Math.round(totalAmount),
                            convenienceFee: convenience,
                            gst: gst,
                            totalAmount: totalAmount,
                            description: 'Advance payment',
                            transactionStatus: 'INITIATED',
                            remoteTransactionId: rOrder.id,
                            razorpayPublicKey: CONFIG.razorpay_key_id,
                            remotePaymentDetails: rOrder,
                            initiatedTime: moment().toISOString(),
                        }

                        existingPayment.transactions.push(newTransaction)
                        existingPayment.remainingAmount = existingPayment.totalAmount -
                            existingPayment.advanceAmount;

                        [err, existingPayment] = await to(
                            existingPayment.save())

                        if (err) {
                            console.log('Unable to save payment request.')
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)
                        }

                        return ReS(res, {
                            message: 'Advance Payment order created',
                            order: rOrder,
                            transaction: newTransaction,
                            rKey: CONFIG.razorpay_key_id,
                            autoCapture: CONFIG.razorpay_auto_capture !==
                                'true',
                        }, HttpStatus.OK)
                        break
                    default:
                        console.log('No gateway type selected')
                }
            }
            break
        case 'BALANCE':

            let amount = existingPayment.totalAmount -
                existingPayment.advanceAmount

            let found = existingPayment.transactions.find(t => {
                return t.transactionStatus === 'COMPLETED' &&
                    t.type === 'ADVANCE'
            })

            if (!found) {
                return ReE(res,
                    'Cannot pay balance when advance is not complete',
                    HttpStatus.FORBIDDEN)
            }

            console.log(
                'Found existing completed advance payment. continuing...')

            // console.log('existingPayment: ', JSON.stringify(existingPayment, null, '\t'))

            let foundBalanceTransaction = existingPayment.transactions.find(
                t =>
                    t.type === paymentType && t.gatewayType === gateway,
            )

            if (foundBalanceTransaction) {
                return ReS(res, {
                    message: 'Balance transaction already exists.',
                }, HttpStatus.CONFLICT)

            }

            let convenience = amount * (0 / 100)
            let gst = convenience * (0 / 100)
            let totalAmount = amount + convenience + gst

            switch (gateway) {
                case 'HDFC':

                    if (CONFIG.hdfc_enable === 'false') {
                        let message = 'This payment method is unavailable right now, please try again later.'
                        console.log(message)
                        return ReE(res, message,
                            HttpStatus.SERVICE_UNAVAILABLE)
                    }

                    newTransaction = {
                        gatewayType: 'HDFC',
                        type: 'BALANCE',
                        amount: Math.round(amount),
                        convenienceFee: convenience,
                        gst: gst,
                        totalAmount: totalAmount,
                        description: 'Balance payment',
                        transactionStatus: 'INITIATED',
                        remoteTransactionId: existingPayment
                            .readableCargoId + 'B',
                        hdfcAccessCode: CONFIG.hdfc_accesscode,
                        initiatedTime: moment().toISOString(),
                    }

                    existingPayment.transactions.push(newTransaction)
                    existingPayment.remainingAmount = parseInt(
                        existingPayment.remainingAmount || -
                        amount);

                    [err, existingPayment] = await to(existingPayment.save())

                    if (err) {
                        console.log('Unable to save payment request.')
                        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                    }

                    let newTr = existingPayment.transactions.find(
                        t => t.remoteTransactionId ===
                            newTransaction.remoteTransactionId)

                    return ReS(res, {
                        message: 'Balance Payment order created',
                        addressPresent: req.user.billing.length !== 0,
                        address: req.user.billing[0],
                        transaction: newTr,
                        hdfcAccessCode: CONFIG.hdfc_accesscode,
                    }, HttpStatus.OK)

                case 'RAZOR_PAY':

                    console.log('Razorpay gateway selected')

                    if (CONFIG.razorpay_enable === 'false') {
                        let message = 'This payment method is unavailable right now, please try again later.'
                        console.log(message)
                        return ReE(res, message,
                            HttpStatus.SERVICE_UNAVAILABLE)
                    }

                    note = `Bal${existingPayment.readableCargoId}`
                    console.log('note:', note)

                    newOrder = {
                        amount: totalAmount,
                        currency: 'INR',
                        payment_capture: true,
                        receipt: existingPayment.cargo._id.toString(),
                        notes: note,
                    }

                    try {
                        rOrder = await instance.orders.create(newOrder)
                    } catch (e) {
                        console.error('Rpay error', e)
                        return ReE(res, e, HttpStatus.INTERNAL_SERVER_ERROR)
                    }

                    console.log('New order created', rOrder)

                    newTransaction = {
                        gatewayType: 'RAZOR_PAY',
                        type: 'BALANCE',
                        amount: amount,
                        convenienceFee: convenience,
                        gst: gst,
                        totalAmount: totalAmount,
                        description: 'Balance payment',
                        transactionStatus: 'INITIATED',
                        remoteTransactionId: rOrder.id,
                        razorpayPublicKey: CONFIG.razorpay_key_id,
                        remotePaymentDetails: rOrder,
                        initiatedTime: moment().toISOString(),
                    }

                    existingPayment.transactions.push(newTransaction)
                    existingPayment.remainingAmount = parseInt(
                        existingPayment.remainingAmount || -
                        amount);

                    [err, existingPayment] = await to(existingPayment.save())

                    if (err) {
                        console.log('Unable to save payment request.')
                        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                    }

                    return ReS(res, {
                        message: 'Balance Payment order created',
                        order: rOrder,
                        transaction: newTransaction,
                        rKey: CONFIG.razorpay_key_id,
                        autoCapture: CONFIG.razorpay_auto_capture !== 'true',
                    }, HttpStatus.OK)

                default:
                    console.log('No gateway type selected')
            }

        default:
            return ReE(res, 'Unknown payment type',
                HttpStatus.INTERNAL_SERVER_ERROR)

    }

}
module.exports.startTransaction = startTransaction

const razorpayCallback = async function (req, res) {

    const rSignature = req.get('X-Razorpay-Signature')
    let body = req.body
    let stringBody = JSON.stringify(req.body)

    // console.log("Signature",rSignature)
    // console.log('Body', body)

    var auth = false
    try {
        auth = Razorpay.validateWebhookSignature(stringBody, rSignature,
            CONFIG.razorpay_webhook_auth)
    } catch (err) {
        console.log('Razorpay callback: ', err.message)
        return ReE(res, 'Unauthorized - Invalid Signature',
            HttpStatus.UNAUTHORIZED)
    }

    console.log('Authorized: ', auth)

    if (!auth) {
        return ReE(res, 'Unauthorized', HttpStatus.UNAUTHORIZED)
    }

    console.log('Razorpay webhook')

    let newEntry = {
        remotePaymentDetails: body,
    }

    let err, rCallbackEntry;
    [err, rCallbackEntry] = await to(RazorpayCallback.create(newEntry))

    if (err) {
        console.log('Unable to save entry from razorpay', err.message)
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (body.entity === 'event') {

        let orderId = body.payload.payment.entity.order_id

        let payment;
        [err, payment] = await to(
            Payment.findOne({ 'transactions.remoteTransactionId': orderId })
                .populate({
                    path: 'cargo',
                }))

        if (err) {
            console.log(
                `Razorpay: Cannot find payment entry for callback order: ${orderId} `)
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }

        if (!payment) {
            return ReE(res,
                `Razorpay: No payment entry for callback order: ${orderId}`,
                HttpStatus.INTERNAL_SERVER_ERROR)
        }

        let response
        let entry
        switch (body.event) {
            case 'order.paid':

                [err, response] = await to(
                    updateTransaction(payment, orderId, 'COMPLETED'))

                if (err) {
                    console.log(`Razorpay: ${err.message}`)
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

                }

                rCallbackEntry.status = body.event;

                [err, entry] = await to(rCallbackEntry.save())

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                console.log('response', response)

                break
            case 'payment.failed':

                [err, response] = await to(
                    updateTransaction(payment, orderId, 'FAILED'))

                if (err) {
                    console.log(`Razorpay: ${err.message}`)
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

                }

                rCallbackEntry.status = body.event;

                [err, entry] = await to(rCallbackEntry.save())

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                console.log('response', response)

                break
            case 'payment.authorized':
                console.log(`Razorpay: Payment authorized for ${orderId}`)

                rCallbackEntry.status = body.event;

                [err, entry] = await to(rCallbackEntry.save())

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                break
            case 'payment.captured':
                console.log(`Razorpay: Payment caotured for ${orderId} `)

                rCallbackEntry.status = body.event;

                [err, entry] = await to(rCallbackEntry.save())

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                break
            default:

                rCallbackEntry.status = body.event;

                [err, entry] = await to(rCallbackEntry.save())

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }
                console.log('Razorpay:Unknown event status')
                break
        }

    } else {
        console.log('Razorpay: not an event')
    }

    // console.log('Query', req.query)
    // console.log('Params', req.params)

    return ReS(res, {
        message: 'Ok.',
    }, HttpStatus.OK)

}
module.exports.razorpayCallback = razorpayCallback

const hdfcCallback = async function (req, res) {
    let body = req.body
    let params = req.params
    let query = req.query

    // console.log('Body', req.body)
    // console.log('Params', req.params)
    // console.log('query', req.query)

    let encResp = req.body.encResp

    const crypto = require('crypto')
    const key = CONFIG.hdfc_wkey

    let decrypted
    try {
        decrypted = aesDecrypt(encResp, key)
    } catch (err) {

        console.log('Decryption Error', err)
        return ReE(res, 'Unable to read response sent by server',
            HttpStatus.BAD_REQUEST)
    }

    let parsed = querystring.parse(decrypted)

    let trackingId = parsed.tracking_id
    let orderId = parsed.order_id
    let status = parsed.order_status

    console.log('parsed', parsed)

    let newEntry = {
        remotePaymentDetails: parsed,
    }

    let err, hCallbackEntry;
    [err, hCallbackEntry] = await to(HdfcCallback.create(newEntry))

    if (err) {
        console.log('Unable to save entry from hdfc', err.message)
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let payment;
    [err, payment] = await to(
        Payment.findOne({ 'transactions.remoteTransactionId': orderId })
            .populate({
                path: 'cargo',
            }))

    if (err) {
        console.log(
            `Hdfc: Cannot find payment entry for callback order: ${orderId} `)
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!payment) {
        return ReE(res, `Hdfc: No payment entry for callback order: ${orderId}`,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    switch (status) {

        case 'Success':

            [err, response] = await to(
                updateTransaction(payment, orderId, 'COMPLETED'))

            if (err) {
                console.log(`Razorpay: ${err.message}`)
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)

            }

            hCallbackEntry.status = status;

            [err, entry] = await to(hCallbackEntry.save())

            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }

            console.log('Transaction successful')
            break
        case 'Failed':

            console.log('Transaction Unsuccessful')
            break
        default:
            console.log('Hdfc: trn Status', status)

    }

    ReS(res, parsed, HttpStatus.OK)

}
module.exports.hdfcCallback = hdfcCallback

const updateTransactionDetails = async function (req, res) {

    let orderId = req.params.remoteTransactionId
    let status = req.body.transactionStatus
    let err, payment;
    [err, payment] = await to(
        Payment.findOne({ 'transactions.remoteTransactionId': orderId })
            .populate({
                path: 'cargo',
            }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    let foundTransaction = payment.transactions.find(t =>
        t.remoteTransactionId === orderId,
    )

    if (!foundTransaction) {
        return ReE(res, 'Cannot find transaction with that order id.',
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (status !== 'CANCELLED') {
        return ReE(res, 'Cannot update to this status.',
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (foundTransaction.transactionStatus !== 'INITIATED') {
        return ReE(res, 'Cannot update this transaction.',
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    foundTransaction.transactionStatus = 'CANCELLED';

    // console.log(foundTransaction);

    [err, payment] = await to(payment.save())

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    // console.log(payment)

    return ReS(res,
        { message: 'Transaction Updated.' })

}
module.exports.updateTransactionDetails = updateTransactionDetails

async function updateTransaction(
    payment, orderId, status, remotePaymentDetails) {

    return new Promise(async (resolve, reject) => {

        let foundtransaction = payment.transactions.find(t =>
            t.remoteTransactionId == orderId,
        )

        if (!foundtransaction) {
            reject(new Error('Cannot find a transaction for sent order Id.'))
            return
        }

        let cargo;
        [err, cargo] = await to(Cargo.findById(new ObjectId(payment.cargo._id)))

        if (err) {
            reject(new Error('Cannot find the cargo to update.'))
        }

        if (!cargo) {
            return ReE(res, { message: 'Cargo not found' },
                HttpStatus.BAD_REQUEST)
        }

        if (!isNull(remotePaymentDetails)) {
            foundtransaction.remotePaymentDetails = remotePaymentDetails
        }

        switch (status) {
            case 'COMPLETED':
                foundtransaction.completedTime = moment().toISOString()
                foundtransaction.transactionStatus = status
                if (foundtransaction.type === 'ADVANCE') {
                    payment.status = 'ADVANCE_PAID'

                    try {
                        console.log('Validating status')
                        validateStatus('PAID', cargo.status)
                        cargo.status = 'PAID'
                        console.log('Setting status as PAID')
                    } catch (err) {
                        console.log('Cargo Validation error:', err.message)
                    }

                    // console.log('cargo', cargo)

                    let truck;
                    [err, truck] = await to(
                        Truck.findById(new ObjectId(cargo.truck)))

                    if (err) {
                        reject(new Error(
                            'Cannot update truck while paying - truck not found'))
                    }

                    truck = setTruckAvailability(truck, cargo);

                    [err, truck] = await to(truck.save())

                    if (err) {
                        reject(new Error(
                            'Unable to save truck when completing payment.'))
                    }

                } else {
                    payment.status = 'COMPLETED'
                }

                break
            case 'FAILED':
                foundtransaction.transactionStatus = status

                // console.log(payment)
                break
            default:
                reject(new Error('Unknown status.'))
                return
        }

        [err, payment] = await to(payment.save())

        if (err) {
            reject(new Error('Unable to save payment request.'))
        }

        [err, cargo] = await to(cargo.save())

        if (err) {
            reject(new Error('Unable to save cargo.'))
        }

        resolve(payment)

    })

}

const updatePayment = async function (req, res) {
    let err, user, data, payment, updatePayment
    user = req.user
    const userId = user._id
    data = req.body
    const status = data.status

    let paymentId = req.params.id

    if (!ObjectId.isValid(paymentId)) {
        return ReE(res, { message: 'Please provide valid Payment Id' }, 400)
    }

    [err, payment] = await to(Payment.findOne({ _id: new ObjectId(paymentId) }))
    if (err) return ReE(res, err, 400)
    else {
        if (payment) {

            if (payment.status !== 'INITIATED') {
                return ReE(res, { message: 'Cannot edit payment at this stage.' },
                    HttpStatus.BAD_REQUEST)
            }

            if (status === 'CANCELLED') { payment.status = status }

            CONFIG.editablePaymentFields.forEach(function (field) {
                if (typeof field === 'string' && data[field] !== undefined) {
                    payment[field] = data[field]
                }
            });

            [err, updatePayment] = await to(payment.save())
            if (err) {
                return ReE(res, err, 400)
            }

            return ReS(res,
                { message: 'Payment Updated.', payment: updatePayment },
                HttpStatus.OK)
        } else {
            return ReE(res, { message: 'payment is not found' }, 400)
        }
    }

}
module.exports.updatePayment = updatePayment

const getAll = async function (req, res) {

    let user = req.user

    let err, paymentAll

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }

    [err, paymentAll] = await to(Payment.find({ 'user': user._id }))

    if (err) {
        return ReE(res, err, 400)
    } else {
        return ReS(res, { message: 'Payment details are', payments: paymentAll },
            200)
    }

}
module.exports.getAll = getAll

const getPayment = async function (req, res) {

    let paymentId = req.params.paymentId
    let user = req.user
    let err, payment

    if (!ObjectId.isValid(paymentId)) {
        return ReE(res, { message: 'please provide valid payment id' },
            HttpStatus.BAD_REQUEST)
    }

    [err, payment] = await to(
        Payment.findById(paymentId))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    if (!payment) {
        return ReE(res, { message: 'Payment not found' },
            HttpStatus.BAD_REQUEST)
    }

    for (const transaction of payment.transactions) {

        // await payment.transactions.map(async transaction => {
        switch (transaction.gatewayType) {

            case 'RAZOR_PAY':

                let rOrder;
                [err, rOrder] = await to(
                    instance.orders.fetch(transaction.remoteTransactionId))

                if (err) {
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                console.log('Fetched existing order from Rpay')

                console.log('rOrder', rOrder)

                let response
                switch (rOrder.status) {

                    case 'paid':

                        [err, payment] = await to(
                            updateTransaction(payment, rOrder.id, 'COMPLETED'))

                        if (err) {
                            console.log(`Razorpay: ${err.message}`)
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)

                        }

                        break

                    case 'attempted':

                        [err, payment] = await to(
                            updateTransaction(payment, rOrder.id, 'FAILED'))

                        if (err) {
                            console.log(`Razorpay: ${err.message}`)
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)

                        }

                        break
                    default:
                        console.log('Razorpay trn Status', rOrder.status)
                }
                break
            case 'HDFC':

                let hOrder;
                [err, hOrder] = await to(
                    getOrderStatus(transaction.remoteTransactionId))
                if (err) {
                    // console.log(err)
                    return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                console.log('hOrder', hOrder)

                switch (hOrder.order_status) {

                    case 'Unsuccessful':

                        [err, payment] = await to(
                            updateTransaction(payment, hOrder.order_no,
                                'FAILED', hOrder))

                        if (err) {
                            console.log(`Hdfc: ${err.message}`)
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)

                        }

                        break
                    case 'Shipped':

                        [err, payment] = await to(
                            updateTransaction(payment, hOrder.order_no,
                                'COMPLETED', hOrder))

                        if (err) {
                            console.log(`Hdfc: ${err.message}`)
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)

                        }

                        break
                    case 'Successful':

                        [err, payment] = await to(
                            updateTransaction(payment, hOrder.order_no,
                                'COMPLETED', hOrder))

                        if (err) {
                            console.log(`Hdfc: ${err.message}`)
                            return ReE(res, err,
                                HttpStatus.INTERNAL_SERVER_ERROR)

                        }

                        break
                    default:

                        console.log('Hdfc trn Status', hOrder.order_status)

                }

                // [err, payment] = await to(
                // updateTransaction(payment, rOrder.id, 'COMPLETED'))

                if (err) {
                    console.log(`Razorpay: ${err.message}`)
                    return ReE(res, err,
                        HttpStatus.INTERNAL_SERVER_ERROR)

                }

                break
            default:
                console.log('Unknown gateway type in transaction')
        }
    }
    // )

    return ReS(res, {
        message: 'Payment found',
        payment: payment,
        addressPresent: req.user.billing.length !== 0,
        address: req.user.billing[0],
    },
        HttpStatus.OK)

}
module.exports.getPayment = getPayment

const generateSecureToken = async function (req, res) {
    let requestId = Math.floor(Math.random() * 90000000000000000000)
        + 10000000000000000000
    let orderId = req.body.order
    let amount = req.body.amount

    if (isNull(amount) ||
        !validator.isNumeric(amount) ||
        amount < 100) {
        return ReE(res,
            { message: 'Please enter a valid amount (min 100 paise)' },
            HttpStatus.BAD_REQUEST)
    }

    let err, response;
    [err, response] = await to(getSecureToken(requestId))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    // console.log('responseHash', response.responseHash)

    // console.log('response', response)

    // let verifyHash = sha512(
    //     response.secureToken + CONFIG.hdfc_wkey + CONFIG.hdfc_merchant_id)
    //
    console.log('response securetoken', response.secureToken)

    console.log('Generating response hash')

    console.log('orderId', orderId)

    let exactAmount = (parseFloat(amount)).toFixed(2)
    console.log('amount', exactAmount)

    let toHash = orderId + 'INR' + exactAmount + response.secureToken
    console.log('to hash', toHash)

    let responseHash = sha512(toHash)

    return ReS(res, {
        message: 'Secure token response',
        response: response,
        responseHash: responseHash,
    },
        HttpStatus.OK)
}
module.exports.generateSecureToken = generateSecureToken

const getRSA = async function (req, res) {
    let transactionId = req.params.id

    let err, response;
    [err, response] = await to(getRSAKey(transactionId))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res, { message: 'RSA for transaction', rsa: response },
        HttpStatus.OK)
}
module.exports.getRSA = getRSA

const saveCreditCardRequest = async function (req, res) {

    const companyName = req.body.companyName
    const cardHolderName = req.body.cardHolderName
    const city = req.body.city
    const pincode = req.body.pincode
    const email = req.body.email
    const phone = req.body.phone
    const panCard = req.body.panCard

    if (isNull(companyName) || companyName.toString().trim().length < 3) {
        return ReE(res,
            'Please enter a Business name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(cardHolderName) || cardHolderName.toString().trim().length < 3) {
        return ReE(res,
            'Please enter a Card holder name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(city)) {
        return ReE(res, 'Please enter a city.',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(email) || !validator.isEmail(email)) {
        return ReE(res, { message: 'Please enter a valid email id' }, 400)
    }

    if (isNull(pincode) ||

        pincode.toString().trim().length < 3 ||
        pincode.toString().trim().length > 6) {
        return ReE(res, 'Please enter a valid pincode.',
            HttpStatus.BAD_REQUEST)
    }

    var regExp = new RegExp('^([a-zA-Z]){5}([0-9]){4}([a-zA-Z]){1}?$')
    if (isNull(panCard) ||
        !regExp.test(panCard)) {
        return ReE(res,
            { message: 'Please enter a valid PAN card Number.' },
            HttpStatus.BAD_REQUEST)
    }

    let newCardRequest = {
        user: req.user._id,
        companyName: companyName,
        cardHolderName: cardHolderName,
        city: city,
        pincode: pincode,
        email: email,
        phone: phone,
        panCard: panCard
    }

    if (phone.startsWith('+91')) {
        newCardRequest.countryCode = '+91'
        newCardRequest.phone = phone.replace('+91', '')
    }

    if (phone.startsWith('+1')) {
        newCardRequest.countryCode = '+1'
        newCardRequest.phone = phone.replace('+1', '')
    } else {
        newCardRequest.countryCode = '+91'
    }

    if (!validator.isMobilePhone(phone, ['en-IN', 'en-US'])) {//checks if only phone number was sent

        return ReE(res, { message: `Invalid phone number ${phone}` },
            HttpStatus.BAD_REQUEST)
    }


    let err, existingRequest;
    [err, existingRequest] = await to(
        CardRequest.findOne({ user: req.user._id }))

    if (existingRequest) {

        let message = "Card Request already in progress"
        console.log(message)

        return ReE(res, {
            message: message,
        }, HttpStatus.BAD_REQUEST)

    }


    var cardRequest;
    [err, cardRequest] = await to(CardRequest.create(newCardRequest))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    var response;
    [err, response] = await to(
        notificationService.sendEmail(CONFIG.hdfc_card_email_destination, {
            subject: 'New Credit card request - Whistle Freights',
            body: '<!DOCTYPE html>\n' +
                '<html>\n' +
                '<body>\n' +
                `\tHi,\n` +
                `We have got a new credit card request, details as follows. <br /> <br />` +
                `Business name : ${cardRequest.companyName}<br />` +
                `CardHolderName : ${cardRequest.cardHolderName}<br />` +
                `Email Id : ${cardRequest.email}<br />` +
                `Phone :  ${cardRequest.phone}<br />` +
                `City:  ${cardRequest.city}<br />` +
                `Pincode: ${cardRequest.pincode}<br />` +
                `PAN Card: ${cardRequest.panCard}<br /> <br />` +
                `User Id: ${cardRequest.user}<br />` +

                '</body>\n' +
                '</html>\n',
        }))

    if (err) {

        return ReE(res, 'Cannot send credit card email' + err.message,
            HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res,
        { message: 'Card request saved.' },
        HttpStatus.OK)

}
module.exports.saveCreditCardRequest = saveCreditCardRequest

const getCardRequest = async function (req, res) {

    let user = req.user
    let err, cardRequest

    [err, cardRequest] = await to(
        CardRequest.findOne({ user: new ObjectId(user._id) })
            .populate([
                { path: 'shipper', select: 'name phone _id' },
                { path: 'cargo' }]))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!cardRequest) {
        return ReE(res, 'Card Request not found', HttpStatus.BAD_REQUEST)
    }

    return ReS(res,
        { cardRequest: cardRequest }, HttpStatus.OK)

}
module.exports.getCardRequest = getCardRequest

//Admin
const getAllPayments = async function (req, res) {

    let user = req.user
    let page = req.query.page || 1
    let limit = parseInt(req.query.limit) || 10

    let err, paymentAll

    if (!ObjectId.isValid(user._id)) {
        return ReE(res, { message: 'user id is wrong' }, 400)
    }
    [errs, existingUser] = await to(User
        .findOne({ _id: new ObjectId(userr._id) })
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
            sort: {
                createdAt: 'desc',
            },
        };

        [err, paymentAll] = await to(Payment.paginate({}, options))

        if (err) {
            return ReE(res, err, 400)
        } else {
            if ( existingUser.admin === true ||existingUser.role.role.write.includes('PAYMENT')) {
                return ReS(res, { message: 'You have write access for this payment page.',isEditable:true,payments: paymentAll }, HttpStatus.OK)
            }
            else if (existingUser.role.role.read.includes('PAYMENT')) {
                return ReS(res, { message: 'You have only read access for this payment page.',isEditable:false,payments: paymentAll }, HttpStatus.OK)
            }
            else {
                return ReE(res, { message: "You don't have permission to access payment. Please contact support." }, 400)
            }
        }
    }

}
module.exports.getAllPayments = getAllPayments

// let toEncrypt = JSON.stringify({'order_no': '12345'})
// console.log('toEncrypt', toEncrypt)
//
// let encrypted = aesEncrypt(toEncrypt, CONFIG.hdfc_wkey)
// console.log('encrypted', encrypted)

// let parsed
// try {
//     parsed = aesDecrypt("", CONFIG.hdfc_wkey)
// } catch (err) {
//
//     console.log('Decryption Error', err)
//     return ReE(res, 'Unable to read response sent by server',
//         HttpStatus.BAD_REQUEST)
// }
// console.log('parsed', parsed)
//



