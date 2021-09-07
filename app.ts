import express from 'express';
import path from 'path';
// import createError from 'http-errors';
// var cookieParser = require('cookie-parser');
import logger from 'morgan';
import router from './routes/index';
// var usersRouter = require('./routes/users');

const { API_PORT = 3006 } = process.env;

const app = express();

app.use(logger('dev'));
app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());

app.use('/api', router);

// Serve app production bundle
app.use(express.static('dist'));

// Handle client routing, return all requests to the app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   next(createError(404));
// });

// error handler
// app.use(function (err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

// app.all('*', function (req, res, next) {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   res.header('Access-Control-Allow-Methods', '*');
//   res.header('Content-Type', 'application/json;charset=utf-8');
//   next();
// });

app.listen(API_PORT, () => {
  console.log(`Server listening at http://localhost:${API_PORT}`);
});
