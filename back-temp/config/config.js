require('dotenv').config()//instatiate environment variables

let CONFIG = {} //Make this global to use all over the application

CONFIG.app = process.env.APP || 'development'
CONFIG.port = process.env.PORT || '3000'

CONFIG.db_dialect = process.env.DB_DIALECT || 'mongo'
CONFIG.db_host = process.env.DB_HOST || 'localhost'
CONFIG.db_port = process.env.DB_PORT || '27017'
CONFIG.db_name = process.env.DB_NAME || 'name'
CONFIG.db_user = process.env.DB_USER || 'root'
CONFIG.db_password = process.env.DB_PASSWORD || 'db-password'

CONFIG.db_uri = process.env.MONGODB_URI ||
    'mongodb://user:password@mlab.com:27017/exampledb'

CONFIG.jwt_encryption = process.env.JWT_ENCRYPTION || 'jwt_please_change'
CONFIG.jwt_expiration = process.env.JWT_EXPIRATION || '10000'

CONFIG.sms_enable = process.env.SMS_ENABLE || 'false'

CONFIG.sms_auth_key = process.env.SMS_AUTH_KEY || 'key here'
CONFIG.sms_sender_id = process.env.SMS_SENDER_ID || 'EXAMPLE'
CONFIG.sms_route_id = process.env.SMS_ROUTE_ID || '4'

CONFIG.mg_key  = process.env.MAILGUN_KEY   || 'mailgun_key';
CONFIG.mg_domain  = process.env.MAILGUN_DOMAIN   || 'mg.com';

CONFIG.verify_email  = process.env.VERIFY_EMAIL || 'false';
CONFIG.verification_url = process.env.VERIFICATION_URL || 'http://localhost'
CONFIG.send_email = process.env.SEND_EMAIL || 'true'

CONFIG.send_email = process.env.SEND_EMAIL || 'true'


CONFIG.razorpay_enable = process.env.HDFC_ENABLE || 'true'
CONFIG.razorpay_key_id = process.env.RAZORPAY_KEY_ID || 'rkey'
CONFIG.razorpay_secret = process.env.RAZORPAY_SECRET || 'rsecret'
CONFIG.razorpay_auto_capture = process.env.RAZORPAY_SECRET || 'false'
CONFIG.razorpay_webhook_auth = process.env.RAZORPAY_WEBHOOK_AUTH || 'auth key'


CONFIG.hdfc_card_email_destination = process.env.HDFC_CARD_EMAIL_DESTINATION || 'logesh45@gmail.com, logeshr@dowhistle.com'


CONFIG.hdfc_enable = process.env.HDFC_ENABLE || 'false'
CONFIG.hdfc_merchant_id = process.env.HDFC_MERCHANT_ID || 'access code'
CONFIG.hdfc_accesscode = process.env.HDFC_ACCESS_CODE || 'access code'
CONFIG.hdfc_rsa_url = process.env.HDFC_RSA_URL || 'http://rsaurl.co'
CONFIG.hdfc_api_url = process.env.HDFC_API_URL || 'http://apiurl.co'
CONFIG.hdfc_wkey = process.env.HDFC_WKEY || 'Wkey'



CONFIG.firebase_project_id = process.env.FIREBASE_PROJECT_ID
CONFIG.firebase_client_email = process.env.FIREBASE_CLIENT_EMAIL
CONFIG.firebase_privatekey = process.env.FIREBASE_PRIVATE_KEY || 'private_key' //.replace(/\\n/g,'\n')

CONFIG.default_radius = process.env.DEFAULT_RADIUS || 100
CONFIG.min_advance_payment_percent = process.env.MIN_ADVANCE_PAYMENT_PERCENT ||
    1

CONFIG.convenience_fee_percent = process.env.CONVENIENCE_FEE_PERCENT || 3
CONFIG.gst_percent = process.env.GST_PERCENT || 18

CONFIG.cargoStatuses = [ 
    'CREATED',
    'ACCEPTED',
    'PAYMENT_REQUESTED',
    'PAYMENT_PENDING',
    'PAID',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'PENDING_COMPLETION',
    'COMPLETED',
    'CANCELLED']

CONFIG.paymentGateways = [
    'RAZOR_PAY', "HDFC"]

CONFIG.editableCargoStatuses = [
    'PAID',
    'PICKED_UP',
    'IN_TRANSIT', 'DELIVERED', 'PENDING_COMPLETION', 'COMPLETED', 'CANCELLED']

CONFIG.inquiryStatuses = [
    'CREATED', 'SHIPPER_PENDING', 'CARRIER_PENDING', 'ACCEPTED',
    'CANCELLED', 'EXPIRED']


CONFIG.paymentTypes = [
    'ADVANCE',
    'BALANCE']

CONFIG.paymentStatuses = [
    'INITIATED',
    'ADVANCE_PAID',
    'COMPLETED',
    'CANCELLED']

CONFIG.paymentTransactionStatuses = [
    'INITIATED',
    'PAYMENT_PENDING',
    'COMPLETED',
    'CANCELLED',
    'FAILED']

CONFIG.editableMatchFields = process.env.EDITABLE_MATCH_FIELDS || [
    'status', 'carrierProposedFare', 'ignored']

CONFIG.editableUserFields = process.env.EDITABLE_USER_FIELDS || [
    'name', 'notificationToken',
    'password', 'active', 'photoURL']

CONFIG.editableTruckFields = process.env.EDITABLE_TRUCK_FIELDS || [
    'lastLocation',
    'name',
    'capacity',
    'available',
    'cargo',
    'driver',
    'active',
    'registrationNumber',
    'type',
    'subtype',
    'suspend',
    'photoURL',
    'device']

CONFIG.editableCargoFields = process.env.EDITABLE_CARGO_FIELDS || [
    'fromLocation',
    'toLocation',
    'shipper',
    'carrier']

CONFIG.cargoRemarksLimit = process.env.CARGO_REMARKS_LIMIT || 300

CONFIG.editableDriverFields = process.env.EDITABLE_DRIVER_FIELDS ||
    ['name', 'truck', 'active', 'photoURL', 'drivingLicensePhoto']

CONFIG.editableNotificationFields = process.env.EDITABLE_NOTIFICATION_FIELDS ||
    ['readStatus']

CONFIG.editablePaymentFields = process.env.EDITABLE_PAYMENT_FIELDS ||
    ['advanceAmount']


CONFIG.UserTypes = ['shipper', 'carrier', 'broker']

CONFIG.NotificationTypes = [
    'NEW_INQUIRY',
    'INQUIRY_SHIPPER_PENDING',
    'INQUIRY_CARRIER_PENDING',
    'INQUIRY_ACCEPTED',
    'INQUIRY_CANCELLED',
    'INQUIRY_EXPIRED',
    'ACCEPTED',
    'PAID',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'PENDING_COMPLETION',
    'COMPLETED',
    'CANCELLED']

CONFIG.NotificationMessages = {
    NEW_INQUIRY: {
        'title': 'New inquiry',
        'body': 'You have got a new inquiry.',
    },
    INQUIRY_SHIPPER_PENDING: {
        'title': 'New price for shipment',
        'body': 'Carrier has added a new price.',
    },
    INQUIRY_CARRIER_PENDING: {
        'title': 'New price for shipment',
        'body': 'Shipper has added a new price.',
    },
    INQUIRY_ACCEPTED: {
        'title': 'Price accepted',
        'body': 'Freight price was accepted.',
    },
    INQUIRY_CANCELLED: {
        'title': 'Inquiry Cancelled',
        'body': 'Carrier cancelled the inquiry.',
    },
    INQUIRY_EXPIRED: {
        'title': 'Inquiry Expired',
        'body': 'The Inquiry was matched to a different carrier.',
    },
    ACCEPTED: {
        'title': 'Waiting payment',
        'body': 'Your shipment is waiting for payment.',
    },
    PAYMENT_REQUESTED: {
        'title': 'Carrier sent a collection memo',
        'body': 'Tap to view details',
    },
    PAID: {
        'title': 'Payment complete',
        'body': 'Shipper has completed the payment.',
    },
    PICKED_UP: {
        'title': 'Shipment picked up',
        'body': 'Carrier picked up the shipment.',
    },
    IN_TRANSIT: {
        'title': 'Shipment in transit',
        'body': 'Your shipment is in transit',
    },
    DELIVERED: {
        'title': 'Shipment delivered',
        'body': 'Your shipment was delivered',
    },
    PENDING_COMPLETION: {
        'title': 'Delivery confirmation',
        'body': 'Please confirm your shipment delivery.',
    },
    COMPLETED: {
        'title': 'Transaction Complete.',
        'body': 'A shipment transaction was completed.',
    },
    CANCELLED: {
        'title': 'Shipment Cancelled',
        'body': 'Shipment cancelled, click to view details',
    },
}

CONFIG.TruckTypeCapacities = [9, 7.5, 16, 21, 25, 28, 34, 15, 7, 20, 29, 19]

CONFIG.googleMap_key = process.env.GOOGLEMAP_KEY || 'No key'

CONFIG.notification_link = process.env.NOTIFICATION_LINK ||
    'http://localhost:3000'

CONFIG.web_url = process.env.WEB_URL ||
    'http://localhost:3000'

CONFIG.registrationStatus = {
    EMAIL_NOT_PRESENT: "EU002",
    PASSWORD_NOT_PRESENT: "EU003",
}

CONFIG.bankAccountApprovalStatuses = ["PENDING", "APPROVED", "REJECTED"]

CONFIG.algorithm = process.env.ALGORITHM || "aes-256-ctr"

CONFIG.encryptPassword = process.env.ENCRYPT_PASSWORD|| "d6F3Efeq"

module.exports = CONFIG
