let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt = require('bcrypt');
const BrandsModel = require('../Models/BrandsModel');
const BrandsUsersModel = require('../Models/BrandsUsersModel');

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
            <a href="https://brands.neza.app/" class="signin-btn">Sign In</a>
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

function generateStrongPassword(brandName, timestamp, email) {
  // Combine the inputs to create a seed for randomness
  const seed = brandName + timestamp + email;

  // Use crypto to create a hash based on the seed
  const hash = crypto.createHash('sha256').update(seed).digest('hex');

  // Take the first 8 characters from the hash to create the password
  const password = hash.substring(0, 8);


  return password;
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

app.post('/add_brand_user', urlEncoded, (req, res)=>{
    let brand_id = req.body.brand_id;
    let email = req.body.email;
    let jobTitle = req.body.jobTitle;
    let fullName = req.body.fullName;
    let role = req.body.role;

    console.log(req.body)

    BrandsUsersModel.findOne({ email: email , brand_id: brand_id})
    .then(data =>{
        if(data){
            res.status(409).json("Email has been used");
        }else{
            //Generate Password
            const generatedPassword = generateStrongPassword(brand_id, email, generateRandomNumber());

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
                BrandsUsersModel({ email, brand_id, fullName, jobTitle, role, password: hash, firstTimePassword: true }).save()
                .then(()=>{
                res.json('Added');
                })
                .catch(err =>{
                res.status(500).json('Not Added')
                })
                
            });
        }
    })
    .catch(err => {
      console.log(err)
        res.status(500).json("Server error");
    })
});

app.put('/update_brand_user/:id', urlEncoded, (req, res)=>{
  let email = req.body.email;
  let jobTitle = req.body.jobTitle;
  let fullName = req.body.fullName;
  let role = req.body.role;

  BrandsUsersModel.findByIdAndUpdate(req.params.id, { email, jobTitle, fullName, role}, { new: true})
  .then(data => {
    res.json("success");
  })
  .catch(err => {
    res.status(500).json("Failed");
  });
})

app.get('/brand_users/:id', urlEncoded, (req, res)=>{
    BrandsUsersModel.find({ brand_id: req.params.id})
    .then(data => {
        let cleanData = [];
        data.map( brand => {
            let newData = {}
            newData = {
                _id: brand._id,
                email: brand.email,
                fullName: brand.fullName,
                jobTitle: brand.jobTitle,
                role: brand.role
            }
            cleanData.push(newData);
        })
        res.json(cleanData);
    })
    .catch(err => {
        res.status(500).json(err);
    })
})

app.delete('/brand_user/:id', urlEncoded, (req, res)=>{
    BrandsUsersModel.findByIdAndDelete(req.params.id)
    .then(data =>{
        res.json("success");
    })
    .catch(err => {
        res.status(500).json("Failed,  server error")
    })
})

module.exports = app;