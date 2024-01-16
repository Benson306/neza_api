let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const AdminUsersModel = require('../Models/AdminUsersModel');

const currentDate = new Date();
const formattedDate = currentDate.toLocaleDateString('en-GB');
const saltRounds = parseInt(process.env.Salt_Rounds, 10);
const masterPs = process.env.MASTER_PASSWORD;

function generateRandomNumber() {
    const seed = Date.now();
    const random = Math.floor(seed * Math.random() * 90000) + 10000;
    return random % 90000 + 10000; // Ensures a 5-digit number
}

const HTML_TEMPLATE = (text) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>NodeMailer Email Template</title>
          <style>
            .container {
              width: 100%;
              height: 100%;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .email {
              width: 80%;
              margin: 0 auto;
              background-color: #fff;
              padding: 20px;
            }
            .password{
                font-size: large;
                margin-top: 10px;
                font-weight: bold;
                text-align: center;
            }
            .email-header {
              background-color: #333;
              color: #fff;
              padding: 20px;
              text-align: center;
            }
            .email-body {
              padding: 20px;
            }
            .email-footer {
              background-color: #333;
              color: #fff;
              padding: 20px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="email">
              <div class="email-header">
                <h1>Password Reset.</h1>
              </div>
              <div class="email-body">
                <p>Here is Your One Time Password: </p>
                <p class="password">${text}</p>
              </div>
              <div class="email-footer">
                <p>
                <a href="https://neza.app">Login Here</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
});

const SENDMAIL = async (mailDetails, callback) => {
    try {
      const info = await transporter.sendMail(mailDetails)
      callback(info);
    } catch (error) {
      console.log(error);
    } 
};

function generateStrongPassword(masterPs, timestamp, email) {
    // Combine the inputs to create a seed for randomness
    const seed = masterPs + email + timestamp;

    // Use crypto to create a hash based on the seed
    const hash = crypto.createHash('sha256').update(seed).digest('hex');

    // Take the first 8 characters from the hash to create the password
    const password = hash.substring(0, 8);


    return password;
}

app.post('/add_admin_user', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    AdminUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            res.status(409).json('User Exists')
        }else{

            bcrypt.hash(password, saltRounds, function(err, hash) {
                // Store hash in your password DB.
                AdminUsersModel({ email, password: hash, firstTimePassword: true, date: formattedDate}).save()
                .then( data =>{
                    res.json('Added');
                })
                .catch(err =>{
                    res.status(401).json('Not Added')
                })
            });
        }
    })
})

app.get('/admin_users', (req, res)=>{
    AdminUsersModel.find({})
    .then(data => {
      let cleanData = [];
      data.map( user => {
        let newData = {}
        newData = {
          _id: user._id,
          email: user.email,
          date: user.date
        }
        cleanData.push(newData);
      })
      res.json(cleanData);
    })
})

app.post('/admin_login', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    AdminUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    res.json({ _id:data._id, email: data.email, firstTimePassword : data.firstTimePassword })
                }else{
                    res.status(401).json('Wrong Credentials')
                }
            })
        }else{
            res.status(401).json('Failed');
        }
    })
})

app.delete('/del_admin_users/:id', urlEncoded, (req, res)=>{
    let masterPassword = req.body.masterPassword;
    let master_password = process.env.MASTER_PASSWORD;

    if(masterPassword !== master_password){
        res.status(401).json('Wrong Credentials');
    }else{
        AdminUsersModel.findByIdAndDelete(req.params.id)
        .then(data =>  res.json('success'))
        .catch(err => res.status(500).json('failed'))
    }
    
})

app.put('/update_admin_users/:id', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;
    let masterPass = req.body.masterPassword;
    let master_password = process.env.MASTER_PASSWORD;

    if(master_password !== masterPass){
        res.status(401).json('Wrong Credentials');
    }else{
        bcrypt.hash(password, saltRounds, function(err, hash) {
            // Store hash in your password DB.
            AdminUsersModel.findByIdAndUpdate(req.params.id, { email, password : hash }, {new: true})
            .then(data => {
                res.json('success');
            })
            .catch(err =>{
                res.status(500).json('error');
            })
        });
    }
})

app.post('/reset_admin_password', urlEncoded, (req, res)=>{
    let email = req.body.email;

    AdminUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            //Generate Password
            const generatedPassword = generateStrongPassword(masterPs, generateRandomNumber(), email);

            const options = {
                from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
                to: `${email}`, // receiver email
                subject: "Password Reset", // Subject line
                text: generatedPassword,
                html: HTML_TEMPLATE(generatedPassword),
            }

            // Send Email
            SENDMAIL(options, (info) => {
                console.log("Email sent successfully");
                console.log("MESSAGE ID: ", info.messageId);
            });

            bcrypt.hash(generatedPassword, saltRounds, function(err, hash) {
                // Store hash in your password DB.
                AdminUsersModel.findOneAndUpdate({email: email},{ password: hash, firstTimePassword: true},{new: true})
                .then( data =>{
                    res.json('Sent');
                })
                .catch(err =>{
                    res.status(401).json('Not Sent')
                })
            });
        }else{
            res.status(401).json('Account Does not Exist');
        }
    })
    .catch(err => {
        res.status(500).json('Server Error');
    })

})

app.post('/change_admin_password', urlEncoded,(req, res)=>{
    let _id = req.body._id;
    let password = req.body.password;

    bcrypt.hash(password, saltRounds, function(err, hash) {
        // Store hash in your password DB.
        AdminUsersModel.findOneAndUpdate({HTML_TEMPLATEid: _id}, { password: hash, firstTimePassword: false }, {new: true} )
        .then( data =>{
            res.json('success');
        })
        .catch(err =>{
            res.status(500).json('failed')
        })
    });
    
})

module.exports = app;