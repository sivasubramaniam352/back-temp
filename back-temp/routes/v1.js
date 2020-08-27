const express = require('express')
const router = express.Router()

const UserController = require('../controllers/user.controller')
const TruckController = require('../controllers/truck.controller')
const TruckTypeController = require('../controllers/trucktype.controller')
const InquiryController = require('../controllers/inquiry.controller')
const CargoController = require('../controllers/cargo.controller')
const DriverController = require('../controllers/driver.controller')
const DeviceController = require('../controllers/device.controller')
const NotificationController = require(
    '../controllers/notification.controller')
const PaymentController = require('../controllers/payment.controller')
const passport = require('passport')
const path = require('path')

const jwtAuth = require('../middleware/passport')

const needsAuth = jwtAuth(passport).authenticate('jwt', {session: false})

/* GET home page. */
router.get('/', function (req, res, next) {
    res.json({
        status: 'success',
        message: 'Whistle Freights API',
        data: {'version_number': 'v0.0.1'},
    })
})

router.post('/user', UserController.webRegister)


router.post('/resend', UserController.resendCode)
router.post('/verify/email', UserController.verifyEmail)
router.post('/passwordreset', UserController.requestPasswordReset)
router.post('/verify/passwordreset', UserController.resetPassword)

router.post('/user/otp', UserController.getOtpWeb)
router.post('/user/email', UserController.setEmailAccess)

router.post('/user/app', UserController.appSignin)
router.post('/user/resendOtp', UserController.resendOTP)
router.post('/user/verifyOtp', UserController.verifyOTP)

router.get('/user', needsAuth, UserController.get)
router.put('/user', needsAuth, UserController.update)
router.post('/user/login', UserController.login)
router.post('/user/login/phone', UserController.loginWithPhone)
router.post('/user/logout', needsAuth, UserController.logout)

router.post('/user/address', needsAuth, UserController.addAddress)
router.delete('/user/address/:id', needsAuth, UserController.deleteAddress)


router.post('/user/bank', needsAuth, UserController.addBankAccount)
router.delete('/user/bank/:id', needsAuth, UserController.deleteBankAccount)


router.get('/googlemap', needsAuth, TruckController.googleMapAddress)
router.get('/geocode/map', needsAuth, TruckController.googleMapsLatlng)

router.post('/geo/distance', needsAuth,
    TruckController.getDistanceBetweenPoints)
router.get('/geo/time', needsAuth, CargoController.getEstimatedTime)

router.post('/truck/type', needsAuth, TruckTypeController.add)
router.get('/truck/types', needsAuth, TruckTypeController.getAll)
router.post('/truck/subtype', needsAuth, TruckTypeController.addSubType)

router.post('/truck', needsAuth, TruckController.add)
router.get('/trucks', needsAuth, TruckController.getTrucks)
router.get('/truck/:id', needsAuth, TruckController.getTruck)
router.put('/truck/:id', needsAuth, TruckController.updateTruck)
router.delete('/truck/:id', needsAuth, TruckController.deleteTruck)
router.get('/find/truck', needsAuth, TruckController.filterTruck)
router.get('/trucks/nearby', needsAuth, TruckController.getNearbyTrucks)
router.post('/truck/:id/driver', needsAuth, TruckController.assignDriver)
router.delete('/truck/:id/driver', needsAuth, TruckController.removeDriver)

router.post('/driver', needsAuth, DriverController.add)
router.get('/driver/:id/code', needsAuth, DriverController.generateCode)
router.post('/driver/verify', DriverController.verify)
router.get('/drivers', needsAuth, DriverController.getDrivers)
router.get('/driver/:id', needsAuth, DriverController.getDriver)
router.put('/driver/:id', needsAuth, DriverController.updateDriver)
router.delete('/driver/:id', needsAuth, DriverController.deleteDriver)
router.get('/find/driver', needsAuth, DriverController.filterDriver)

router.post('/inquiry', needsAuth, InquiryController.create)
router.get('/inquiry/:id', needsAuth, InquiryController.get)
router.put('/inquiry/:id/match/:mId', needsAuth, InquiryController.update)
router.get('/inquiries', needsAuth, InquiryController.getAll)

router.get('/cargoes', needsAuth, CargoController.getCargoes)
router.get('/carrier/cargoes', needsAuth, CargoController.getCarrierCargoes)
router.get('/cargo/:id', needsAuth, CargoController.getCargo)
router.put('/cargo/:id/status', needsAuth, CargoController.updateCargoStatus)
// router.put('/cargo/:id', needsAuth, CargoController.updateCargo)

router.post('/test/notification', needsAuth, UserController.testNotification)

router.post('/device', needsAuth, DeviceController.addDevice)
router.get('/device/:id', needsAuth, DeviceController.getDevice)

router.get('/notifications', needsAuth,
    NotificationController.getNotifications)
router.put('/notification/:id', needsAuth,
    NotificationController.updateNotification)

router.post('/sos', needsAuth,
    DriverController.sendEmergencyAlert)

router.put('/payment/:id', needsAuth, PaymentController.updatePayment)
router.post('/payment', needsAuth, PaymentController.initiatePayment)
router.post('/payment/:id/transaction', needsAuth, PaymentController.startTransaction)
router.put('/payment/:id/transaction/:remoteTransactionId', needsAuth, PaymentController.updateTransactionDetails)
router.get('/payment', needsAuth, PaymentController.getAll)
router.get('/payment/:paymentId', needsAuth, PaymentController.getPayment)

router.post('/payment/ack', PaymentController.razorpayCallback)


//hdfc
router.get('/payment/hdfc/key/:id', PaymentController.getRSA)
router.post('/payment/hdfc/stoken', PaymentController.generateSecureToken)
router.post('/payment/hdfc/ack', PaymentController.hdfcCallback)


router.post('/payment/creditcard/request', needsAuth,
    PaymentController.saveCreditCardRequest)
router.get('/payment/creditcard/request', needsAuth,
    PaymentController.getCardRequest)


module.exports = router
