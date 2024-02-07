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

const BRAND_REG_EMAIL_TEMPLATE  = (email, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Received</title>
      <style>
        .container {
          margin-top: 10px;
        }

        .logo {
          font-weight: bold;
          padding: 20px;
          text-align: center;
        }

        .title {
          padding: 20px;
          text-align: center;
          background-color: #EEF2FE;
          font-weight: bold;
          font-size: 28px;
        }

        .content {
          text-align: center;
          background-color: #FAFAFA;
          padding: 20px;
        }

        .credentials {
          display: flex;
          justify-content: center;
          margin: 0 auto;
          margin-bottom: 30px;
        }

        table {
          font-weight: bold;
          padding: 15px;
          margin: 0 auto;
          margin-top: 20px;
          text-align: left;
          width: 30%;
        }

        table td {
          padding-right: 10px;
          font-weight: lighter;
          font-size: 16px;
        }

        .sign {
          display: flex;
          justify-content: center;
          color: black;
        }

        .signin-btn {
          background-color: #C8F761;
          text-align: center;
          padding: 10px;
          border-radius: 5px;
          display: block;
          margin: 0 auto;
          text-decoration: none;
          color: black;
          width: 30%;
        }

        .footer {
          background-color: black;
          text-align: center;
          color: white;
          padding: 30px;
          margin-top: 20px;
        }

        .footer p {
          margin: 0;
        }

        .disclaimer {
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>

    <body>
      <div class="container">
        <div class="logo">NEZA</div>

        <div class="title">Welcome to Neza</div>

        <div class="content">
          <p>We are happy to have you onboard.</p>
          <p>Sign in to Neza brand dashboard using the following credentials:</p>

          <div class="credentials">
            <table>
              <tr>
                <td>Email:</td>
                <td>${email}</td>
              </tr>
              <tr>
                <td>Password:</td>
                <td>${otp}</td>
              </tr>
            </table>
          </div>

          <div class="sign">
            <a href="http://localhost:4000" class="signin-btn">Sign In</a>
          </div>
        </div>

        <div class="footer">
          <p>Influencer Technologies Limited</p>
          <p class="disclaimer">Please do not reply to this email. This mailbox is not monitored.</p>
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
                html: BRAND_REG_EMAIL_TEMPLATE(email, generatedPassword),
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