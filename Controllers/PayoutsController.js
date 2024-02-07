let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt= require('bcrypt');
const BrandUsersModel = require('../Models/BrandusersModel');
const CreatorsModel = require('../Models/CreatorsModel');
const PayoutsModel = require('../Models/PayoutsModel');
const SENDMAIL = require('../Utils/SendMail');

const PAYMENT_EMAIL_TEMPLATE = (sender_email, brandName, currency, amount) => {
  return `
  <!DOCTYPE html>
  <html>

  <head>
    <meta charset="utf-8">
    <title>Payment Received</title>
    <style>
      .container {
        margin-left: 30px;
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

      .sign {
        display: flex;
        justify-content: center;
      }

      .signin-btn {
        background-color: #C8F761;
        text-align: center;
        padding: 10px;
        border-radius: 5px;
        display: block;
        margin: 0 auto;
        text-decoration: none;
        color: white;
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

      <div class="title">You have received payment.</div>

      <div class="content">
        <p>You have received ${currency}.<b>${amount}</b> from ${brandName} through Neza.</p>
        <p>To view more details, sign in to Neza</p>

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

const FIRST_TIME_EMAIL_TEMPLATE  = (sender_email, recepient_email, brandName, currency, amount, otp) => {
  return `
    <!DOCTYPE html>
    <html>

    <head>
      <meta charset="utf-8">
      <title>Payment Received</title>
      <style>
        .container {
          margin-left: 30px;
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
        }

        .signin-btn {
          background-color: #C8F761;
          text-align: center;
          padding: 10px;
          border-radius: 5px;
          display: block;
          margin: 0 auto;
          text-decoration: none;
          color: white;
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

        <div class="title">You have been invited to get paid.</div>

        <div class="content">
          <p>${brandName} wants to pay you ${currency}. ${amount} through Neza.</p>
          <p>To view more details on your Neza dashboard, sign in using the following credentials:</p>

          <div class="credentials">
            <table>
              <tr>
                <td>Email:</td>
                <td>${recepient_email}</td>
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

function generateStrongPassword(brandName, timestamp, email) {
    // Combine the inputs to create a seed for randomness
    const seed = brandName + timestamp + email;

    // Use crypto to create a hash based on the seed
    const hash = crypto.createHash('sha256').update(seed).digest('hex');

    // Take the first 8 characters from the hash to create the password
    const password = hash.substring(0, 8);


    return password;
}

function recordTransaction(sender_id, brandName, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, firstTime, otp, res){
    PayoutsModel({sender_id, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description}).save()
    .then(payoutRes => {
        //Send EMail
        const options = {
            from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
            to: `${recepient_email}`, // receiver email
            subject: "You Have Received Payment", // Subject line
            html: firstTime ? FIRST_TIME_EMAIL_TEMPLATE(sender_email,recepient_email, brandName, currency, amount, otp) :
            PAYMENT_EMAIL_TEMPLATE(sender_email, brandName, currency, amount)
        }

        SENDMAIL(options, (info) => {
            res.json("Success");
        });
        
    })
    .catch(err =>  console.log(err))
}

function addBalanceToRecepient( sender_id, brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res) {
    CreatorsModel.find({ email: recepient_email})
    .then(data => {
        if(data.length > 0){
            let newBal = Number(data[0].balance) + Number(amount);
            let password = null;
            CreatorsModel.findOneAndUpdate({ email: recepient_email}, { balance: newBal }, { new: false})
            .then((balData)=>{
                recordTransaction(sender_id, brandName, balData._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, false, password, res)
            })
            .catch(err => console.log(err))

        }else{
            const password = generateStrongPassword(sender_id, recepient_name, country);
            const saltRounds = parseInt(process.env.Salt_Rounds, 10);

            bcrypt.hash(password, saltRounds, function(err, hash) {
              CreatorsModel({ email: recepient_email, country: country, name: recepient_name, balance: amount, isVerified: false, firstTime: true, password: hash, status: 3}).save()
              .then(data => {
                  // Send Email of Receiving Payment and Sign Up
                  recordTransaction(sender_id, brandName, data._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, true, password, res)
              })
              .catch(err =>  {
                  console.log(err);
              })
            })
        }
    })
}

app.post("/make_single_payout", urlEncoded, (req, res)=>{
    let sender_id = req.body.sender_id;
    let sender_email = req.body.sender_email;
    let recepient_name = req.body.recepient_name;
    let recepient_email = req.body.recepient_email;
    let amount = req.body.amount;
    let country = req.body.country;
    let source = req.body.source;
    let description = req.body.description;
    let currency = req.body.currency;

    const currentDate = new Date();
    const date = currentDate.toLocaleDateString('en-GB');

    let amountRegex = /^\d+$/;

    if(amountRegex.test(amount)){
        BrandUsersModel.findOne({_id: sender_id})
        .then(brand => {
            if(source == "wallet"){
                if(amount < brand.wallet_balance){
                    // Deduct wallet
                    let newAmount = brand.wallet_balance - amount;
                    BrandUsersModel.findByIdAndUpdate({_id: sender_id},{ wallet_balance: newAmount}, {new: false})
                    .then((record)=>{
                        addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res)
                    })
                    .catch((err)=>{
                        console.log(err)
                        res.status(500).json("failed")
                    })
                }else{
                    res.status(400).json("Insufficient balance")
                }
            }else if(source == "credit"){
                if(amount < brand.credit_balance){
                    // Deduct credits
                    let newAmount = brand.credit_balance - amount;
                    BrandUsersModel.findByIdAndUpdate(sender_id,{ credit_balance: newAmount}, {new: false})
                    .then((record)=>{
                        addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res)
                    })
                    .catch(()=>{
                        res.status(500).json("failed")
                    })
                }else{
                    res.status(400).json("Insufficient balance");
                }
            }else if(source == "combined"){
                if(amount < (brand.wallet_balance + brand.credit_balance)){
                    //send - deduct first wallet then credits
                    let newAmount = brand.credit_balance - amount;
                    BrandUsersModel.findByIdAndUpdate(sender_id,{ credit_balance: newAmount}, {new: false})
                    .then(()=>{
                        res.json("success");
                    })
                    .catch(()=>{
                        res.status(500).json("failed")
                    })

                    //Add Balance to Recepient and record transaction
                }else{
                    res.status(400).json("Insufficient balance")
                }
            }else{
                res.status(400).json("Invalid Source")
            }
        })
    }else{
        res.status(400).json("Invalid Amount");
    }
    
})

app.get("/payouts/:id", (req, res)=>{
    PayoutsModel.find({sender_id: req.params.id})
    .then(data => {
        res.json(data)
    })
    .catch(err => {
        res.status(500).json("Failed");
    })
})

app.get("/creator_payouts/:id", async (req, res)=>{
  // PayoutsModel.find({recepient_id: req.params.id})
  // .then(data => {

  //     res.json(data)
  // })
  // .catch(err => {
  //     res.status(500).json("Failed");
  // })

  try {
    const payouts = await PayoutsModel.find({recepient_id: req.params.id});

    const promises = payouts.map(async (creator) => {
        const creatorDoc = await BrandUsersModel.findOne({ _id: creator.sender_id });
        return { ...creator.toObject(), ...(creatorDoc ? creatorDoc.toObject() : {}) };
    });

    const response = await Promise.all(promises);
    res.json(response);
} catch (err) {
    console.error(err);
    res.status(500).json("Failed to fetch creator applications");
}
})

module.exports = app;