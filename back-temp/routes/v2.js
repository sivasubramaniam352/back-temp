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
const ApprovalController = require('../controllers/approval.controller')

const RoleController = require('../controllers/RoleController')
const InviteController = require('../controllers/invite.controller');
const Organization = require('../controllers/organization.controller')

const passport = require('passport')
const adminPassport = require('passport')
const path = require('path')

const {adminAuth} = require('../middleware/passport')
const jwtAuth = require('../middleware/passport')

const needsAuth = jwtAuth(passport).authenticate('jwt', {session: false})
const needsAdminAuth = adminAuth(passport).authenticate('admin_auth', {
    session: false,
    failWithError: true,
})

/* GET home page. */
router.get('/', function (req, res, next) {
    res.json({
        status: 'success',
        message: 'Whistle Freights API',
        data: {'version_number': 'v2.0.1'},
    })
})

router.get('/inquiry/:id', needsAuth, InquiryController.getv2)
router.put('/inquiry/:id/match/:mId', needsAuth, InquiryController.update)

//Admin paths
router.get('/admin/trucks', needsAdminAuth, TruckController.getAllTrucks)
router.get('/admin/drivers', needsAdminAuth, DriverController.getAllDrivers)
router.get('/admin/inquirys', needsAdminAuth, InquiryController.getAllInquiry)
router.get('/admin/cargoes', needsAdminAuth, CargoController.getAllCargoes)
router.get('/admin/payments', needsAdminAuth, PaymentController.getAllPayments)
router.get('/admin/users', needsAdminAuth, UserController.getUserByType)
router.get('/admin/users/management', needsAdminAuth, UserController.getUserByTypes)
router.get('/admin/user/:userId/drivers', needsAdminAuth, UserController.getUserDriver)
router.get('/admin/user/:userId/trucks', needsAdminAuth, UserController.getUserTruck)
router.get('/admin/user/:id', needsAdminAuth, UserController.getUserDetails)
router.get('/admin/bank', needsAdminAuth, UserController.getAllBankAccounts)
router.post('/admin/bank/approvals/:userId/:id', needsAdminAuth, ApprovalController.approveBankAccount)
router.get('/admin/bank/approval/:id', needsAdminAuth, ApprovalController.getApproval)
router.get('/admin/bank/approvals', needsAdminAuth, ApprovalController.getAllApprovals)
router.post('/admin/role/create', needsAdminAuth, RoleController.createRole)
router.post('/admin/add/userRole', needsAdminAuth, RoleController.addUserRole)
router.get('/admin/role/getAll', needsAdminAuth, RoleController.getRoleAll)
router.get('/admin/role/get/:name', needsAdminAuth, RoleController.getOne)
router.get('/role/get/:id', needsAdminAuth, RoleController.getRole)

//invite contoller
router.post('/admin/invite/create', needsAdminAuth, InviteController.createInvite);
router.post('/user/invite/verify',InviteController.verifyInvite)

router.put('/admin/user/role/assign',needsAdminAuth,UserController.userRole)
router.post('/admin/organization/create',needsAdminAuth,Organization.createOrganization)
router.get('/admin/organizations',needsAdminAuth,Organization.getAllOrganization)
router.get('/admin/organization/:Id',needsAdminAuth,Organization.getOrganizationById)
router.put('/admin/organization/update',needsAdminAuth,Organization.updateOrganization)
router.delete('/admin/organization/delete',needsAdminAuth,Organization.deleteOrganization)

router.get('/admin/users/organization/:id', needsAdminAuth,UserController.getUserList)

module.exports = router
