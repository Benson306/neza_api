let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt = require('bcrypt');
const BrandUsersModel = require('../Models/BrandusersModel');

const masterPs = process.env.MASTER_PASSWORD;
const saltRounds = parseInt(process.env.Salt_Rounds, 10);

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
                <h1>Welcome to Neza.</h1>
              </div>
              <div class="email-body">
                <p>We are delighted to have you onboard.</p>
                <p>Here is Your one Time Password: </p>
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

function generateStrongPassword(brandName, timestamp, email) {
    // Combine the inputs to create a seed for randomness
    const seed = brandName + timestamp + email;

    // Use crypto to create a hash based on the seed
    const hash = crypto.createHash('sha256').update(seed).digest('hex');

    // Take the first 8 characters from the hash to create the password
    const password = hash.substring(0, 8);


    return password;
}

app.post('/add_brand', urlEncoded, (req, res)=>{
    let brandName = req.body.brandName;
    let companyName = req.body.companyName;
    let email = req.body.email;
    let country = req.body.country;

    BrandUsersModel.find({email: email})
    .then(data => {
        if(data.length > 0){
            res.status(409).json('Email Has Been Used');
        }else{
            //Generate Password
            const generatedPassword = generateStrongPassword(brandName, companyName, email);

            const options = {
                from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
                to: `${email}`, // receiver email
                subject: "Welcome To Neza", // Subject line
                text: generatedPassword,
                html: HTML_TEMPLATE(generatedPassword),
            }

            // Send Email
            SENDMAIL(options, (info) => {
                console.log("Email sent successfully");
                console.log("MESSAGE ID: ", info.messageId);
            });

            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-GB');
            const saltRounds = parseInt(process.env.Salt_Rounds, 10);

            bcrypt.hash(generatedPassword, saltRounds, function(err, hash) {
                // Store hash in your password DB.
                BrandUsersModel({ brandName, companyName, email, country, wallet_balance: 0, credit_balance: 0, password: hash, firstTimePassword: true, date: formattedDate}).save()
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

app.post('/brand_login', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    BrandUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    res.json({ _id: data._id, email: data.email, firstTimePassword: data.firstTimePassword})
                }else{
                    res.status(401).json('Wrong Credentials')
                }
            })
        }else{
            res.status(401).json('Failed');
        }
    })
})

app.post('/change_brand_password', urlEncoded,(req, res)=>{
    let _id = req.body._id;
    let password = req.body.password;
    const saltRounds = parseInt(process.env.Salt_Rounds, 10);

    bcrypt.hash(password, saltRounds, function(err, hash) {
        // Store hash in your password DB.
        BrandUsersModel.findOneAndUpdate({_id: _id}, { password: hash, firstTimePassword: false }, {new: true} )
        .then( data =>{
            res.json('success');
        })
        .catch(err =>{
            res.status(500).json('failed')
        })
    });

    
})

app.post('/reset_brand_password', urlEncoded, (req, res)=>{
  let email = req.body.email;

  BrandUsersModel.findOne({email: email})
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
              BrandUsersModel.findOneAndUpdate({email: email},{ password: hash, firstTimePassword: true},{new: true})
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
    console.log(err);
      res.status(500).json('Server Error');
  })

})

app.get('/brands', (req, res)=>{
  BrandUsersModel.find({})
  .then(data => {
    let cleanData = [];
    data.map( brand => {
      let newData = {}
      newData = {
        _id: brand._id,
        email: brand.email,
        brandName: brand.brandName,
        companyName: brand.companyName,
        country: brand.country,
        date: brand.date
      }
      cleanData.push(newData);
    })
    res.json(cleanData);
  })
})

app.delete('/del_brand/:id', urlEncoded, (req, res)=>{
  BrandUsersModel.findByIdAndDelete(req.params.id)
  .then(data =>  res.json('success'))
  .catch(err => res.status(500).json('failed'))
})

app.put('/update_brand/:id', urlEncoded, (req, res)=>{
  let brandName = req.body.brandName;
  let companyName = req.body.companyName;
  let email = req.body.email;
  let country = req.body.country;
  BrandUsersModel.findByIdAndUpdate(req.params.id, { brandName, companyName, email, country }, {new: true})
  .then(data => {
    res.json('success');
  })
  .catch(err =>{
    res.status(500).json('error');
  })
})

app.get('/balance/:id', urlEncoded, (req, res)=>{
  BrandUsersModel.findOne({_id: req.params.id})
  .then(data => {
    let resp = {
      country : data.country,
      wallet_balance: data.wallet_balance,
      credit_balance: data.credit_balance
    }
    res.status(200).json(resp)
  })
  .catch((err)=>{
    res.status(500).json("error");
  })
})

module.exports = app;