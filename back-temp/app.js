const express 		= require('express');
const logger 	    = require('morgan');
const bodyParser 	= require('body-parser');
const passport      = require('passport');
const pe            = require('parse-error');
const cors          = require('cors');
const v1 = require('./routes/v1');
const v2 = require('./routes/v2');


const app = express();

const CONFIG = require('./config/config');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

//Passport
app.use(passport.initialize());

//Log Env
console.log("Environment:", CONFIG.app)
//DATABASE
const models = require("./models");

// CORS
app.use(cors());

app.use('/v1', v1);
app.use('/v2', v2);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
    
    if (err.status === 404) {
        res.status(404).json({message: err.message})
    } else {
        res.status(500).json({message: err.message})
    }
  
});

module.exports = app;

// process.on('unhandledRejection', error => {
//     // throw error;
//     console.error('Uncaught Error', pe(error));
// });
