const passport=require('passport');
const LocalStrategy=require('passport-local').Strategy;
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const mysql = require('mysql');
const crypto=require('crypto');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);


app.use(session({
	key: 'session_cookie_name',
	secret: 'session_cookie_secret',
	store: new MySQLStore({
        host:'localhost',
        port:3306,
        user:'root',
        database:'cookie_user'
    }),
	resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge:1000*60*60*24,
       
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('public'));
app.set("view engine", "ejs");

var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "user",
    multipleStatements: true
  });
  connection.connect((err) => {
    if (!err) {
      console.log("Connected");
    } else {
      console.log("Conection Failed");
    }
  });
 

const customFields={
    usernameField:'uname',
    passwordField:'pw',
};

const verifyCallback=(username,password,done)=>{
   
     connection.query('SELECT * FROM users WHERE username = ? ', [username], function(error, results, fields) {
        if (error) 
            return done(error);

        if(results.length==0)
        {
            return done(null,false);
        }
        const isValid=validPassword(password,results[0].hash,results[0].salt);
        user={id:results[0].id,username:results[0].username,hash:results[0].hash,salt:results[0].salt};
        if(isValid)
        {
            return done(null,user);
        }
        else{
            return done(null,false);
        }
    });
}

const strategy=new LocalStrategy(customFields,verifyCallback);
passport.use(strategy);


passport.serializeUser((user,done)=>{
    console.log("inside serialize");
    done(null,user.id)
});

passport.deserializeUser(function(userId,done){
    console.log('deserializeUser'+ userId);
    connection.query('SELECT * FROM users where id = '+userId, function(error, results) {
            done(null, results[0]);    
    });
});




function validPassword(password,hash,salt)
{
    var hashVerify=crypto.pbkdf2Sync(password,salt,10000,60,'sha512').toString('hex');
    return hash === hashVerify;
}

function genPassword(password)
{
    var salt=crypto.randomBytes(32).toString('hex');
    var genhash=crypto.pbkdf2Sync(password,salt,10000,60,'sha512').toString('hex');
    return {salt:salt,hash:genhash};
}


 function isAuth(req,res,next)
{
    if(req.isAuthenticated())
    {
        next();
    }
    else
    {
        res.status(401).json({msg:"You are not authorized to view this resource"});
    }
}


function isAdmin(req,res,next)
{
    if(req.isAuthenticated() && req.user.isAdmin==1)
    {
        next();
    }
    else
    {
        res.status(401).json({msg:"You are not authorized to view this resource"});
    }   
}


app.use((req,res,next)=>{
    console.log(req.session);
    console.log(req.user);
    next();
});


  app.get('/', (req, res, next) => {
    res.send('<h1>Home</h1><p>Please <a href="/register">register</a></p>');
});


    app.get('/login', (req, res, next) => {
   
    // const form = '<h1>Login Page</h1><form method="POST" action="/login">\
    // Enter Username:<br><input type="text" name="uname">\
    // <br>Enter Password:<br><input type="password" name="pw">\
    // <br><br><input type="submit" value="Submit"></form>';

    // res.send(form);
        res.render('login')
});
app.get('/logout', (req, res, next) => {
    req.logout(); //delets the user from the session
    res.redirect('/protected-route');
});
app.get('/login-success', (req, res, next) => {
    res.send('<p>You successfully logged in. --> <a href="/protected-route">Go to protected route</a></p>');
});

app.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});


app.get('/register', (req, res, next) => {
    console.log("Inside get");
    // const form = '<h1>Register Page</h1><form method="post" action="register">\
    //                 Enter Username:<br><input type="text" name="uname">\
    //                 <br>Enter Password:<br><input type="password" name="pw">\
    //                 <br><br><input type="submit" value="Submit"></form>';
    res.render('register')
    
});

app.post('/register',(req,res,next)=>{
    console.log("Inside post");
    console.log(req.body.pw);
    const saltHash=genPassword(req.body.pw);
    console.log(saltHash);
    const salt=saltHash.salt;
    const hash=saltHash.hash;

    connection.query('Insert into users(username,hash,salt,isAdmin) values(?,?,?,0) ', [req.body.uname,hash,salt], function(error, results, fields) {
        if (error) 
            {
                console.log("Error");
            }
        else
        {
            console.log("Successfully Entered");
        }
       
    });

    res.redirect('/login');
});

app.post('/login',passport.authenticate('local',{failureRedirect:'/login-failure',successRedirect:'/login-success'}));


app.get('/protected-route',isAuth,(req, res, next) => {
 
    res.send('<h1>You are authenticated</h1><p><a href="/logout">Logout and reload</a></p>');
    // console.log(req.session);
    // console.log(req.user);
   
    // console.log(req.isAuthenticated());
    // This is how you check if a user is authenticated and protect a route.  You could turn this into a custom middleware to make it less redundant
    // if (req.isAuthenticated()) {
    //     res.send('<h1>You are authenticated</h1><p><a href="/logout">Logout and reload</a></p>');
    // } else {
    //     res.send('<h1>You are not authenticated</h1><p><a href="/login">Login</a></p>');
    // }
});

app.get('/admin-route',isAdmin,(req, res, next) => {
 
    res.send('<h1>You are admin</h1><p><a href="/logout">Logout and reload</a></p>');

});
  app.listen(3000, function() {
    console.log('App listening on port 8080!')
  });