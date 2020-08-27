const Invite = require("../models/invite.model");
const Organization = require("../models/organization.model");
const Config = require("../config/config");
const User = require("../models/user.model");
const {
  to,
  ReE,
  ReS,
  isNull,
  isEmpty,
  formatLocation,
} = require("../services/util.service");
const HttpStatus = require("http-status");
const validator = require("validator");
const { isEmail } = validator;
const crypto = require("crypto"),
  algorithm = Config.algorithm,
  password = Config.encryptPassword;

exports.createInvite = async (req, res) => {
  let body = req.body;
  let user = req.user;

  if (user.admin !== true) return ReE(res,{ message: "Admin only create invite" },HttpStatus.BAD_REQUEST);

  if (isNull(body.email)) return ReE(res,{ message: "please input email to sent invite" },HttpStatus.BAD_REQUEST);

  if (!isEmail(body.email)) return ReE(res,{ message: "please input valid email address!" },HttpStatus.BAD_REQUEST);

  if (isNull(body.organizationName)) return ReE(res,{ message: "please select organization  to sent invite" },HttpStatus.BAD_REQUEST);

  let err, userData;

  [err, userData] = await to(User.findOne({ email: body.email }));

  if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR);

  if (userData) return ReE(res,{ message: "This email already used !" },HttpStatus.BAD_REQUEST);

  if (!userData) {

    let err, orgData;

    [err, orgData] = await to(Organization.findOne({ name: body.organizationName }))

    if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR);

    if (!orgData)
      return ReE(
        res,
        { message: "Organization not found !" },
        HttpStatus.BAD_REQUEST
      );

    if (orgData) {
      let err, inviteData;

      [err, inviteData] = await to(Invite.findOne({ email: body.email }));

      if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR);

      if (inviteData && inviteData.organizationName === body.organizationName) {
        
        return ReE(res, { message: `Invite already sent this email in ${body.organizationName} organization !`, }, HttpStatus.BAD_REQUEST);
      }
      if ( !inviteData || (inviteData && inviteData.organizationName !== body.organizationName)) {
        let code = Math.floor(100000 + Math.random() * 900000);
        let createinvite = {
          userRef: user._id,
          email: body.email,
          organizationName: body.organizationName,
          referalCode: code,
        };

        let err, invite;
        [err, invite] = await to(Invite.create(createinvite));

        if (err) return ReE(res, err, HttpStatus.INTERNAL_SERVER_ERROR);

        if (!invite) return ReE(res, { message: "Invalid inivite" });

        if (invite) {
          const encrypt = (text) => {
            var cipher = crypto.createCipher(algorithm, password);
            var crypted = cipher.update(text, "utf8", "hex");
            crypted += cipher.final("hex");
            return crypted;
          };
          var list = encrypt(body.email);
          var url = "http://localhost:3000/signup";

          var parameters = {
            orgName: invite.organizationName,
            email: list,
          };

          const buildUrl = (url, parameters) => {
            var qs = "";
            for (var key in parameters) {
              var value = parameters[key];
              qs +=
                encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";

            }
            if (qs.length > 0) {
              qs = qs.substring(0, qs.length - 1); //chop off last "&"
              url = url + "?&" + qs;
            }
            return url;
          };

          const Qs = buildUrl(url, parameters); //pass values

          return ReS(
            res,
            {
              message: "Invite sent successfully",
              InviteDocs: invite,
              InviteLink: Qs,
            },
            HttpStatus.OK
          );
        }
      }
    }
  }
}; //End invite create

exports.verifyInvite = async(req,res) => {
  let organization, invite, err, org, invites, inviteUpdate;
  console.log(req.body)
  org = {name:req.body.organizationName};
  [ err, organization] = await to(Organization.findOne());
  if(err){
     return ReE(res,err,HttpStatus.INTERNAL_SERVER_ERROR);
  }
  if(!organization){
    return ReE(res,{message:"Organization not found"},HttpStatus.BAD_REQUEST);
  }
  else{
    invites = {email:req.body.email};
    [ err, invite] = await to(Invite.findOne(invites));
    if(err){
      return ReE(res,err,HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if(!invite){
      return ReE(res,{message:"Invite not found"},HttpStatus.BAD_REQUEST);
    }
    else{
        if(invite.referalCode == req.body.referal){
          [ err, inviteUpdate] = await to(Invite.updateOne({_id:invite._id},{ $set : {"verified" : true }}));
          if(err){
            return ReE(res,err,HttpStatus.INTERNAL_SERVER_ERROR)
          }
          if(inviteUpdate.nModified === 0){
            return ReS(res,{message:"Already Verified"},HttpStatus.OK)
          }else{
            return ReS(res,{message:"Referal Matched"},HttpStatus.OK)
          }
        }
        else{
          return ReE(res,{message:"referalCode not matched"+invite.referalCode},HttpStatus.BAD_REQUEST)
        }
    }
  }
}
