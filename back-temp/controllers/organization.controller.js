const { User, Organization } = require('../models')
const authService = require('../services/auth.service')
const { to, ReE, ReS, isNull, isEmpty, formatLocation } = require(
    '../services/util.service')
const CONFIG = require('../config/config')
const HttpStatus = require('http-status')
const shortid = require('shortid')
const validator = require('validator')
const crypto = require('crypto')
const maps = require('@google/maps')

const googleMapsClient = maps.createClient({
    key: CONFIG.googleMap_key,
})


exports.createOrganization = async (req, res) => {
    let body = req.body;
    let user = req.user;

    if (user.admin !== true) {
        return ReE(res, { message: 'admin only create organization' }, 400)
    }

    if (isNull(body.name) || body.name.toString().trim().length < 3) {
        return ReE(res, 'Please enter a organization name with minimum 3 characters',
            HttpStatus.BAD_REQUEST)
    }

    if (isNull(body.type)) {
        return ReE(res, { message: 'Please enter the organization type' }, 400)
    }

    if ((body.type !== 'shipper') && (body.type !== 'carrier') && (body.type !== 'broker')) {
        return ReE(res, { message: 'Please select a correct  organization type' }, 400)
    }

    let err, getOr;
    [err, getOr] = await to(Organization.findOne({ name: body.name }))

    if (err) {
        return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    console.log(getOr);

    if (getOr) {
        return ReE(res, { message: 'Organization name was already taken' }, 400)
    }
    else {
        let newOrganization = {
            name: body.name,
            user: user._id,
            type: body.type,
            active: true
        }
        let org;
        [err, org] = await to(Organization.create(newOrganization))
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (org) {
            return ReS(res, {
                message: 'Successfully created new Organization .',
                Organization: org,
            }, HttpStatus.OK)
        }
    }
}

exports.getAllOrganization = async (req, res) => {
    let user = req.user
    let org, err
    let page = req.query.page || 1
    let limit = req.query.limit || 10
    let options = {
        page: page,
        limit: limit,
        sort: {
            createdAt: 'desc',
        },
        populate: [{
            path: 'user',
            select: 'name phone email'
        }]
    }
    if (user.admin === true) {
        [err, org] = await to(Organization.paginate({active:true}, options))
        if (err) {
            return ReE(res, { message: 'failed to fetch Organization' },
            )
        }
        if (!isEmpty(org.docs)) {
            return ReS(res, { message: 'Organizations fetched sussessfully', isEditable: true, Organizations: org }, HttpStatus.OK)
        }
        else {
            return ReS(res, { message: 'There are no Organization', Organizations: org, isEditable: true }, HttpStatus.OK)
        }
    }
    else {
        return ReE(res, { message: 'Admin can only fetch Organizations. You are not admin' },
            HttpStatus.BAD_REQUEST)
    }
}
//getorganizationById
exports.getOrganizationById = async (req, res) => {
    let user = req.user
    let org, err
    let Id = req.params.Id
    if (user.admin === true) {
        if (isNull(Id)) {
            return ReE(res, 'Organization id is must to get',
                HttpStatus.BAD_REQUEST)
        }
        [err, org] = await to(Organization.find({ _id: Id }))
        if (err) {
            return ReE(res, { message: 'failed to fetch Organization' },
            )
        }
        if (!isEmpty(org.docs)) {
            return ReS(res, { message: 'Organizations fetched sussessfully', isEditable: true, Organization: org }, HttpStatus.OK)
        }
        else {
            return ReE(res, { message: 'There are no Organization', isEditable: true }, HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }
    else {
        return ReE(res, { message: 'Admin can only fetch Organizations. You are not admin' }, 400)
    }
}

exports.updateOrganization = async (req, res) => {
    let user = req.user;
    let body = req.body
    let updateOrgDate = {}
    if (user.admin === true) {
        if (isNull(body.id)) {
            return ReE(res, 'Organization id is must to update',
                HttpStatus.BAD_REQUEST)
        }

        let org, updateOrg, err;

        [err, org] = await to(Organization.findOne({ _id: body.id, user: user._id }))

        if (!org) {

            return ReE(res, { message: 'This Organization is not created by you' },
                HttpStatus.BAD_REQUEST)
        }

        if (!body.name && !body.type) {
            return ReE(res, { message: 'please mention your detail,you want to update' },
                HttpStatus.BAD_REQUEST)
        }

        if (body.name == "" || body.type == "") {
            return ReE(res, { message: "Update feild was empty please enter your update data" },
                HttpStatus.BAD_REQUEST)
        }

        if (body.type) {
            if (isEmpty(body.type)) {
                return ReE(res, { message: 'If you want to update organization  type Please enter the organization type' }, 400)
            }

            if ((body.type !== 'shipper') && (body.type !== 'carrier') && (body.type !== 'broker')) {
                return ReE(res, { message: 'If you want to update organization type Please select a correct type' }, 400)
            }
            updateOrgDate = { type: body.type }
        }

        if (body.name) {
            if (isEmpty(body.name) || body.name.toString().trim().length < 3) {
                return ReE(res, 'If you want to update organization name Please enter a name with minimum 3 characters',
                    HttpStatus.BAD_REQUEST)
            }
            let orgName
            [err, orgName] = await to(Organization.findOne({ name: body.name }));
            if (orgName) {
                if (orgName._id != body.id) {
                    return ReE(res, 'Organization name was already taken please enter anyother name',
                        HttpStatus.BAD_REQUEST)
                }
            }
            updateOrgDate = { name: body.name }
        }

        if (body.name && body.type) {
            updateOrgDate = { name: body.name, type: body.type }
        }

        if (body.user) {
            return ReE(res, "Sorry you can't update user",
                HttpStatus.BAD_REQUEST)
        }

        [err, updateOrg] = await to(Organization.updateOne({ _id: body.id, user: user._id }, { $set: updateOrgDate }))
        if (err) {
            return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (org) {
            [err, org] = await to(Organization.findOne({ _id: body.id, user: user._id }))
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            return ReS(res, {
                message: 'Successfully updated your Organization .',
                Organization: org,
            }, HttpStatus.OK)
        }
    }
    else {
        return ReE(res, { message: 'Admin can only delete Organizations.' },
            HttpStatus.BAD_REQUEST)
    }
}

exports.deleteOrganization = async (req, res) => {
    let user = req.user;
    let body = req.body
    if (user.admin === true) {
        if (isNull(body._id)) {
            return ReE(res, 'Enter valid Organization Id',
                HttpStatus.BAD_REQUEST)
        }

        let org, delOrg, err, errs;

        [errs, org] = await to(Organization.findOne({ _id: body._id, user: user._id }))

        if (org) {
            [err, delOrg] = await to(Organization.update({ _id: body._id, user: user._id },{$set:{active:false}}))
            if (err) {
                return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR)
            }
            else {
                return ReS(res, {
                    message: 'Successfully deleted Organization',
                    Organization: org.name,
                }, HttpStatus.OK)
            }

        }
        else {
            return ReE(res, { message: 'This Organization is not created by you' },
                HttpStatus.BAD_REQUEST)
        }
    }
    else {
        return ReE(res, { message: 'Admin can only delete Organizations.' },
            HttpStatus.BAD_REQUEST)
    }
}