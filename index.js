'use strict'

const http = require('http');
const port = process.env.PORT || 3000;
const path = require('path');
const request = require('request');
const qs = require('querystring');
const util = require('util');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const express = require('express');
const app = express();
const QuickBooks = require(path.resolve( __dirname, "./nodequickbooks.js" )); //..use this syntax to resolve homemade 'require' paths
const sf = require(path.resolve( __dirname, "./sf.js" )); 
// const { Pool, Client } = require('pg'); 
const db = require(path.resolve( __dirname, "./db.js" )); 
const Tokens = require('csrf');
const csrf = new Tokens();

QuickBooks.setOauthVersion('2.0');

// Generic Express config
app.set('port', port);
app.set('views', 'views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('brad'));
app.use(session({ resave: false, saveUninitialized: false, secret: 'smith' }));

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

// PG

app.get('/pg', async function (req, res){
  console.log('I\'m trying to get into postgres'); 
  await db.query().then(
    results => {
      res.send(results); 
      console.log(results); 
    }
  ); 
}); 

// PG

// SF

app.get('/sf', async function (req, res){
  console.log('I\'m trying to get into sf'); 
  await sf.login('serviointeg@servio.org', 'dummyPwd123!AlkdkWcPZ6spOpNwuNWQnLI7J').then(
    results => { console.log('Logged in'); } 
  ); 

  await sf.insert('Clifford Estate').then(
    results => {
      console.log(results); 
    }
  ); 

  await sf.query().then(
    results => { 
      console.log(results); 
      res.send(results); 
      console.log('Found accounts');  
    }
  ); 
});

// SF

// QB

// INSERT YOUR CONSUMER_KEY AND CONSUMER_SECRET HERE

const consumerKey = 'Q0GphSloikbyU7PzvX6waihOtcLR6tEUNJ748qEJdviaVxPmB0';
const consumerSecret = 'YFjUCiUBqMzFEHb8VY6dzloAKEMFOgqUj32vKQJg';

app.get('/', function (req, res) {
  // res.redirect('/intuit');
  res.render('pages/index.ejs');
});

app.get('/intuit', function (req, res) {
  res.render('pages/intuit.ejs', { port: port, appCenter: QuickBooks.APP_CENTER_BASE });
});

// OAUTH 2 makes use of redirect requests
function generateAntiForgery (session) {
  session.secret = csrf.secretSync();
  return csrf.create(session.secret);
};

app.get('/requestToken', function (req, res) {
  var redirecturl = QuickBooks.AUTHORIZATION_URL +
    '?client_id=' + consumerKey +
    '&redirect_uri=' + 
    encodeURIComponent('https://quicknode.herokuapp.com/auth/intuit/callback/') + // PROD
    //encodeURIComponent('http://localhost:' + port + '/auth/intuit/callback/') +  // LOCAl Make sure this path matches entry in application dashboard
    '&scope=com.intuit.quickbooks.accounting' +
    '&response_type=code' +
    '&state=' + generateAntiForgery(req.session);

  res.redirect(redirecturl);
});

app.get('/auth/intuit/callback', function (req, res) {
  var auth = (new Buffer(consumerKey + ':' + consumerSecret).toString('base64'));

  var postBody = {
    url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + auth,
    },
    form: {
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: 'https://quicknode.herokuapp.com/auth/intuit/callback/' //PROD
      //redirect_uri: 'http://localhost:' + port + '/auth/intuit/callback/'  // LOCAL Make sure this path matches entry in application dashboard
    }
  };

  request.post(postBody, function (e, r, data) {
    var accessToken = JSON.parse(r.body);

    // save the access token somewhere on behalf of the logged in user
    var qbo = new QuickBooks(consumerKey,
                             consumerSecret,
                             accessToken.access_token, /* oAuth access token */
                             false, /* no token secret for oAuth 2.0 */
                             req.query.realmId,
                             true, /* use a sandbox account */
                             true, /* turn debugging on */
                             4, /* minor version */
                             '2.0', /* oauth version */
                             accessToken.refresh_token /* refresh token */);

    // console.log(qbo.token); save the token here probably to postgres

    // qbo.findAccounts(function (_, accounts) {
    //   console.log('I\'m about to get the accounts'); 
    //   accounts.QueryResponse.Account.forEach(function (account) {
    //     console.log(account.Name);
        
    //   });
    // });

  });

  res.send('<!DOCTYPE html><html lang="en"><head></head><body><script>window.opener.location.reload(); window.close();</script></body></html>');
});

// QB