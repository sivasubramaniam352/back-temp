const { ExtractJwt, Strategy } = require('passport-jwt');
const { User }      = require('../models');
const CONFIG        = require('../config/config');
const {to}          = require('../services/util.service');

module.exports = function(passport){
    var opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.secretOrKey = CONFIG.jwt_encryption;

    passport.use(new Strategy(opts, async function(jwt_payload, done){
        let err, user;
        [err, user] = await to(User.findById(jwt_payload.user_id));
        if(err) return done(err, false);
        if(user) {
            return done(null, user);
        }else{
            return done(null, false);
        }
    }));
    
    
    return passport
}

module.exports.adminAuth = function(passport){
    var opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.secretOrKey = CONFIG.jwt_encryption;
    
    
    passport.use("admin_auth",
        new Strategy(opts, async function(jwt_payload, done){
        let err, user;
        [err, user] = await to(User.findById(jwt_payload.user_id));
        if(err) return done(err, false);
    
        console.log('Admin auth')
    
        if(user && user.admin === true ||user && user.role ) {
            return done(null, user);
        }else{
            return done(null, false, {message: "User must be admin"});
        }
    }));
    
    return passport
}
