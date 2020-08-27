const {User, Approval} = require('../models')
const authService = require('../services/auth.service')
const notificationService = require('../services/notification.service')
const ObjectId = require('mongoose').Types.ObjectId
const CONFIG = require('../config/config')
const {to, ReE, ReS, isNull, isEmpty} = require('../services/util.service')
const HttpStatus = require('http-status')
const validator = require('validator')

const approveBankAccount = async function (req, res) {
    const userId = req.params.userId
    const bankAccountId = req.params.id
    const user = req.user
    const status = req.body.status
    
    if (isNull(userId)) {
        return ReE(res, 'Please enter a user id to approve.',
            HttpStatus.BAD_REQUEST)
    }
    
    if (isNull(bankAccountId)) {
        return ReE(res, 'Please enter a bank account id.',
            HttpStatus.BAD_REQUEST)
    }
    
    if (!CONFIG.bankAccountApprovalStatuses.includes(status)) {
        return ReE(res, 'Please provide a valid status.',
            HttpStatus.BAD_REQUEST)
    }
    
    var err, existingUser;
    [err, existingUser] = await to(
        User.findOne({
            '_id': new ObjectId(userId),
            'bankAccounts._id': bankAccountId,
        }))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!existingUser) {
        return ReE(res,
            {message: 'Cannot find user with specified bank account.'},
            HttpStatus.BAD_REQUEST)
    }
    
    let existingBankAccount = existingUser.bankAccounts.id(bankAccountId)
    
    if (!existingBankAccount) {
        return ReE(res, {message: 'Cannot find specified bank account.'},
            HttpStatus.BAD_REQUEST)
    }
    
    if (existingBankAccount.verified === true) {
        return ReE(res, {message: 'This account is already approved.'},
            HttpStatus.UNPROCESSABLE_ENTITY)
    }
    
    let newApproval = {
        user: userId,
        bankAccount: {
            id: bankAccountId,
            accountHolderName: existingBankAccount.accountHolderName,
            bankName: existingBankAccount.bankName,
            accountType: existingBankAccount.accountType,
            accountNumber: existingBankAccount.accountNumber,
            ifscCode: existingBankAccount.ifscCode,
            branchAddress: existingBankAccount.branchAddress,
            description: existingBankAccount.description,
        },
        authorizedBy: user._id,
        status: status,
    }
    
    let approval;
    [err, approval] = await to(
        Approval.create(newApproval))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    existingBankAccount.status = status
    existingBankAccount.authorizedBy = user._id
    
    switch (status) {
        case 'APPROVED':
            existingBankAccount.verified = true
            break
        case 'REJECTED':
            existingBankAccount.verified = false
            break
        default:
            return ReE(res, 'Status unknown', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  
    
    let editedUser;
    [err, editedUser] = await to(existingUser.save())
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    switch (status) {
        case 'APPROVED':
            
            return ReS(res,
                {
                    message: 'Bank account approved.',
                    approval: approval,
                },
                HttpStatus.OK)
        
        case 'REJECTED':
            
            return ReS(res,
                {
                    message: 'Bank account rejected.',
                    approval: approval,
                },
                HttpStatus.OK)
        
        default:
            return ReE(res, 'Status unknown', HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
}
module.exports.approveBankAccount = approveBankAccount

const getApproval = async function (req, res) {
    
    const id = req.params.id
    let user = req.user
    
    if (!ObjectId.isValid(id)) {
        return ReE(res, {message: 'Please provide a valid approval id'},
            HttpStatus.BAD_REQUEST)
    }
    
    let err, approval;
    [err, approval] = await to(
        Approval.findById(id)
            .populate(
                [
                    {
                        path: 'user',
                        select: 'name phone countryCode',
                    },
                    {
                        path: 'approvedBy',
                        select: 'name phone countryCode',
                    },
                ],
            ))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    if (!approval) {
        return ReE(res, {message: 'Approval not found'},
            HttpStatus.BAD_REQUEST)
    }
    
    return ReS(res, {approval: approval},
        HttpStatus.OK)
    
}
module.exports.getApproval = getApproval

const getAllApprovals = async function (req, res) {
    let user = req.user
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    
    let options = {
        page: page,
        limit: limit,
        populate: [
            {
                path: 'user',
                select: '_id name phone email',
            },
        ],
        sort: {
            createdAt: 'desc',
        },
    }
    
    let err, approvals;
    [err, approvals] = await to(Approval.paginate({}, options))
    
    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    
    return ReS(res, {approvals: approvals}, HttpStatus.OK)
    
}
module.exports.getAllApprovals = getAllApprovals
