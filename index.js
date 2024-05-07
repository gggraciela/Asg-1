const express = require('express');
require("./utils.js");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // if PORT is not defined in .env, use port 3000

// for encrypting the password
const bcrypt = require('bcrypt');
const saltRounds = 12;

// for session storage in mongoDB ( sessions for logged in verified users )
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expireTime = 1000 * 60 * 60 * 1; // expires after 1 hour in milliseconds ( 1000ms * 60s * 60m *1d = 1 hour)

// to store users in mongoDB
const Joi = require("joi");
const e = require('express');

// secret information section
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_database = process.env.MONGODB_DATABASE; // check on MongoDB Atlas https://cloud.mongodb.com/ > Deployment > Database > Cluster0 > Collections
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET; // generated by https://guidgenerator.com/ 
const node_session_secret = process.env.NODE_SESSION_SECRET; // generated by https://guidgenerator.com/
// end secret section
 

var { database } = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');
 

app.use(express.urlencoded({ extended: false })); // to parse the body of the POST request

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`, // connection string to MongoDB Atlas
  crypto: {
    secret: mongodb_session_secret
  }
});

app.use(session({
  secret: node_session_secret,
  store: mongoStore, //default is memory store
  saveUninitialized: false,
  resave: true
}));


app.get('/', (req, res) => {
  var html = `
    <h1>Welcome!</h1>
    <p>This is the home page!  What would you like to do?</p>

    <form action='/signup' method='get'>
      <button>Sign up</button>
    </form>

    <form action='/login' method='get'>
      <button>Log in</button>
    </form>
  `;

  if (!req.session.authenticated) {
    res.send(html);
  }
  
  var username = req.session.username;

  var logged = `
    Hello, ${username}!

    <form action='/members' method='get'>
      <button>Go to Members Area</button>
    </form>

    <form action='/logout' method='get'>
      <button>Log out</button>
    </form>
  `;

  
  res.send(logged);
});


app.use(express.static(__dirname + "/public")); // so that we can host the images from the media folder


app.get('/signup', (req, res) => {
  var html = `
  create user
    <form action='/signupSubmit' method='post'>
      <input name='username' type='text' placeholder='name'>
      <br>
      <input name='email' type='text' placeholder='email'>
      <br>
      <input name='password' type='password' placeholder='password'>
      <br>
      <button>Submit</button>
    </form>
  `;
  res.send(html);
});

// submitUser after joi
app.post('/signupSubmit', async (req, res) => {
  var username = req.body.username;
  var email = req.body.email;
  var password = req.body.password;

  if (!username) { // if username is empty
    res.send('Name is required.' + '<br><br><a href="/signup">Try again</a>');
    return;
  }
  else if (!email) { // if email is empty
    res.send('Email is required.' + '<br><br><a href="/signup">Try again</a>');
    return;
  }
  else if (!password) { // if password is empty
    res.send('Password is required.' + '<br><br><a href="/signup">Try again</a>');
    return;
  }

  const schema = Joi.object(
    {
      username: Joi.string().alphanum().max(20).required(),
      email: Joi.string().email().max(50).required(),
      password: Joi.string().max(20).required()
    });

  const validationResult = schema.validate({ username, email, password });
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signup");
  }

  var hashedPassword = await bcrypt.hash(password, saltRounds);

  await userCollection.insertOne({ username: username, password: hashedPassword, email: email});
  console.log("Inserted user");
 
  req.session.authenticated = true;
  req.session.username = username;
  req.session.cookie.maxAge = expireTime;
  
  res.redirect("/members");
});


app.get('/login', (req, res) => {
  var html = `
  Log in
    <form action='/loginSubmit' method='post'>
      <input name='email' type='text' placeholder='email'>
      <br>
      <input name='password' type='password' placeholder='password'>
      <br>
      <button>Submit</button>
    </form>
  `;
  res.send(html);
});


// after joi
app.post('/loginSubmit', async (req, res) => {
  var username = req.session.username;
  var email = req.body.email;
  var password = req.body.password;

  const schema = Joi.string().email().max(50).required();
  const validationResult = schema.validate(email);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login");
    return;
  }
  
  const result = await userCollection.find({ email: email }).project({ email: 1, password: 1, username:1}).toArray(); 

  console.log(result);
  if (result.length != 1) {
    console.log("user not found");
    res.send("Invalid email/password combination" + '<br><br><a href="/login">Try again</a>');
    return;
  }

  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.username = result[0].username;;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/members');
    return;
  }
  else {
    console.log("incorrect password");
    res.send("Invalid email/password combination" + '<br><br><a href="/login">Try again</a>');
    return;
  }
});



app.get('/members', async (req, res) => {
  var username = req.session.username;
  req.session.cookie.maxAge = expireTime;

  if (!req.session.authenticated) {
    res.redirect('/');
    return;
  }

  const randomNum = Math.floor(Math.random() * 3);
  if (randomNum == 0) {
    var pic = '../happy-happy-happy-happy.gif';
  } 
  else if (randomNum == 1) {
    var pic = '../hug.gif';
  }
  else {
    var pic = '../cat-wave.gif';
  }

  
  var html = `
    Hello, ${username}!

    <br><br><img src='${pic}' style='width:250px;'>

    <form action='/logout' method='get'>
      <button>Log out</button>
    </form>
  `;
  res.send(html);
});

app.get('/logout', (req,res) => {
	req.session.destroy(); // deletes the cookie, so it automatically logs out the user
  res.redirect('/'); // redirect to home page
});

app.get('*', (req, res) => {
  res.status(404);
  res.send('Page not found - 404');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});