let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const BrandUsersModel = require('../Models/BrandusersModel');
const CreatorsModel = require('../Models/CreatorsModel');
const PayoutsModel = require('../Models/PayoutsModel');
const SENDMAIL = require('../Utils/SendMail');

const PAYMENT_EMAIL_TEMPLATE = (sender_email, currency, amount) => {
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
              <div class="email-body">
                <p>You have received payment from ${sender_email} of ${currency}.${amount}.</p>
                <p>Login or Sign Up to Neza using the link below to access your wallet: </p>
              </div>
              <div class="email-footer">
                <p>
                <a href="http://localhost:400/">Login / Sign Up Here</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
}

function recordTransaction(sender_id, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, res){
    PayoutsModel({sender_id, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description}).save()
    .then(payoutRes => {
        //Send EMail
        const options = {
            from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
            to: `${recepient_email}`, // receiver email
            subject: "You Have Received Payment", // Subject line
            html: PAYMENT_EMAIL_TEMPLATE(sender_email, currency, amount),
        }

        SENDMAIL(options, (info) => {
            // console.log("Email sent successfully");
            // console.log("MESSAGE ID: ", info.messageId);
            res.json("Success");
        });
        
    })
    .catch(err =>  console.log(err))
}

function addBalanceToRecepient(sender_id, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res) {
    CreatorsModel.find({ email: recepient_email})
    .then(data => {
        if(data.length > 0){
            let newBal = Number(data[0].balance) + Number(amount);
            CreatorsModel.findOneAndUpdate({ email: recepient_email}, { balance: newBal }, { new: false})
            .then((balData)=>{
                recordTransaction(sender_id, balData._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, res)
            })
            .catch(err => console.log(err))

        }else{
            CreatorsModel({ email: recepient_email, country: country, name: recepient_name, balance: amount, isVerified: false, firstTime: true, password: ""}).save()
            .then(data => {
                // Send Email of Receiving Payment and Sign Up
                recordTransaction(sender_id, data._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, res)
            })
            .catch(err =>  {
                console.log(err);
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
                    .then(()=>{
                        addBalanceToRecepient(sender_id, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res)
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
                    .then(()=>{
                        addBalanceToRecepient(sender_id, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res)
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

module.exports = app;