let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt= require('bcrypt');
const BrandUsersModel = require('../Models/BrandsUsersModel');
const CreatorsModel = require('../Models/CreatorsModel');
const PayoutsModel = require('../Models/PayoutsModel');
const SENDMAIL = require('../Utils/SendMail');
const BrandsModel = require('../Models/BrandsModel');
const axios = require("axios");
const { count } = require('console');

const PAYMENT_EMAIL_TEMPLATE = (sender_email, brandName, currency, amount, status) => {
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
          <a href="https://creators.neza.app/" class="signin-btn">Sign In</a>
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

const FIRST_TIME_EMAIL_TEMPLATE  = (sender_email, recepient_email, brandName, currency, amount, otp, status) => {
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
            <a href="https://creators.neza.app/" class="signin-btn">Sign In</a>
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

function recordTransaction(sender_id, brandName, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, firstTime, otp, initiatedBy, approvedBy, status){
    PayoutsModel({sender_id, recepient_id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, initiatedBy, approvedBy, status}).save()
    .then(payoutRes => {
        //Send EMail
        const options = {
            from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
            to: `${recepient_email}`, // receiver email
            subject: "You Have Received Payment", // Subject line
            html: firstTime ? FIRST_TIME_EMAIL_TEMPLATE(sender_email,recepient_email, brandName, currency, amount, otp, status) :
            PAYMENT_EMAIL_TEMPLATE(sender_email, brandName, currency, amount, status)
        }

        SENDMAIL(options, (info) => {
            console.log("Email Sent Successfully");
        });
        
    })
    .catch(err =>  console.log(err))
}

function addBalanceToRecepient( sender_id, brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, initiatedBy, approvedBy, payoutStatus) {
    CreatorsModel.find({ email: recepient_email})
    .then(data => {
        if(data.length > 0){ // Existing creator
            let newBal = 0;
            if(payoutStatus == 1){ // Approved payout
                newBal = Number(data[0].balance) + Number(amount);
            }else{ // Unapproved payout
                newBal = Number(data[0].balance);
            }
            let password = null;
            CreatorsModel.findOneAndUpdate({ email: recepient_email}, { balance: newBal }, { new: false})
            .then((balData)=>{
                recordTransaction(sender_id, brandName, balData._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, false, password, initiatedBy, approvedBy, payoutStatus)
            })
            .catch(err => console.log(err))
        }else{ // New User
            const password = generateStrongPassword(sender_id, recepient_name, country);
            const saltRounds = parseInt(process.env.Salt_Rounds, 10);
            let newBal = 0;
            if(payoutStatus == 1){ // Approved payout
                newBal = Number(amount);
            }else{ // Unapproved payout
                newBal = 0;
            }
            bcrypt.hash(password, saltRounds, function(err, hash) {
              CreatorsModel({ email: recepient_email, initiatedBy: sender_id, country: country, name: recepient_name, balance: newBal, receipt_code: "", totalWithdrawal: 0, isVerified: false, firstTime: true, password: hash, status: 3}).save()
              .then(data => {
                  // Send Email of Receiving Payment and Sign Up
                  recordTransaction(sender_id, brandName, data._id, sender_email, recepient_name, recepient_email, amount, country, source, date, currency, description, true, password, initiatedBy, approvedBy, payoutStatus)
              })
              .catch(err =>  {
                  console.log(err);
              })
            })
        }
    })
}

app.post("/make_single_payout", urlEncoded, (req, res)=>{
    let approvedBy = req.body.approvedBy;
    let initiatedBy = req.body.initiatedBy;
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

    if(!amountRegex.test(amount)){
      res.status(400).json("Invalid Amount");
      return;
    }

    BrandUsersModel.findOne({ _id: approvedBy})
    .then((brandData)=>{
              BrandsModel.findOne({_id: sender_id})
              .then(brand => {
                  if(source == "wallet"){
                      if(amount <= brand.wallet_balance){
                        let newAmount = 0;
                        let payoutStatus = 0;
                        if(brandData.role == "admin"){
                          // Deduct wallet
                          newAmount = brand.wallet_balance - amount;
                          payoutStatus = 1;
                        }else{
                          // Wallet balance remains the same
                          newAmount = brand.wallet_balance;
                        }
                        BrandsModel.findByIdAndUpdate({_id: sender_id},{ wallet_balance: newAmount}, {new: false})
                        .then((record)=>{
                            addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, initiatedBy, approvedBy, payoutStatus)
                        })
                        .then( response => {
                          res.status(200).json("success")
                        })
                        .catch((err)=>{
                            console.log(err)
                            res.status(500).json("failed")
                        })
                      }else{
                          res.status(400).json("Insufficient balance")
                      }
                  }else if(source == "credit"){
                      if(amount <= brand.credit_balance){
                          // Deduct credits
                          let newAmount = brand.credit_balance - amount;
                          BrandsModel.findByIdAndUpdate(sender_id,{ credit_balance: newAmount}, {new: false})
                          .then((record)=>{
                              addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, initiatedBy, approvedBy)
                          })
                          .then( response => {
                            res.status(200).json("success")
                          })
                          .catch(()=>{
                              res.status(500).json("failed")
                          })
                      }else{
                          res.status(400).json("Insufficient balance");
                      }
                  }
              })
    })
    .catch(err => {
      res.status(401).json('Unauthorized')
    })
});

app.post('/make_multiple_payout', urlEncoded, (req, res)=>{
  let approvedBy = req.body.approvedBy;
  let initiatedBy = req.body.initiatedBy;
  let sender_id = req.body.sender_id;
  let sender_email = req.body.sender_email;
  let data = req.body.data;
  let source = req.body.source;

  const currentDate = new Date();
  const date = currentDate.toLocaleDateString('en-GB');

  let totalAmount =  0;
  data.map((item)=>{
    totalAmount += item.amount;
  })

  BrandUsersModel.findOne({_id: sender_id})
  .then((brand)=>{
    if(source == "wallet"){
      if(totalAmount <= brand.wallet_balance){
          let newAmount = brand.wallet_balance - totalAmount;

          BrandUsersModel.findByIdAndUpdate({_id: sender_id},{ wallet_balance: newAmount}, {new: false})
          .then((record)=>{
            data.map(item => {
              let recepient_name = item.recepientName;
              let recepient_email = item.email;
              let amount = item.amount;
              let country = item.country;
              let description = item.description;
              let currency = item.currency;

              addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, res)
            })
          })
          .then( response => {
            res.json("success")
          })
          .catch((err)=>{
              console.log(err)
              res.status(500).json("failed")
          })
      }else{
        res.status(400).json("Insufficient wallet balance")
      }
    }else if(source == "credit"){ 
      if(totalAmount <= brand.credit_balance){
        let newAmount = brand.credit_balance - totalAmount;

        BrandUsersModel.findByIdAndUpdate({_id: sender_id},{ credit_balance: newAmount}, {new: false})
        .then((record)=>{
          data.map(item => {
            let recepient_name = item.recepientName;
            let recepient_email = item.email;
            let amount = item.amount;
            let country = item.country;
            let description = item.description;
            let currency = item.currency;

            addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, initiatedBy, approvedBy)
          })
        })
        .then( response => {
          res.json("success")
        })
        .catch((err)=>{
            console.log(err)
            res.status(500).json("failed")
        })
      }else{
        res.status(400).json("Insufficient credit balance")
      }
    }
  })
  .catch(err => {
    console.log(err)
  })

});

app.post('/approve_payout', urlEncoded, (req, res)=>{
  let payoutId = req.body.payoutId;
  let userId = req.body.userId;

  BrandUsersModel.findOne({ _id: userId})
  .then((data)=>{
    if(data.role == "admin"){

      PayoutsModel.findOne({_id: payoutId})
      .then( payout =>{
        // Deduct payment
        BrandsModel.findOne({_id: payout.sender_id})
        .then(brand => {
            if(payout.source == "wallet"){
                if(payout.amount <= brand.wallet_balance){
                  let newAmount = brand.wallet_balance - payout.amount;
                  BrandsModel.findByIdAndUpdate({_id: payout.sender_id},{ wallet_balance: newAmount}, {new: false})
                  .then((record)=>{ // Add balance
                    CreatorsModel.findOne({ _id: payout.recepient_id})
                    .then(data => { // Find creator balance and add to it the amount
                        newBal = Number(data.balance) + Number(payout.amount);
                        CreatorsModel.findOneAndUpdate({ _id: payout.recepient_id}, { balance: newBal }, { new: false})
                        .then((balData)=>{
                          PayoutsModel.findByIdAndUpdate({_id: payoutId}, {status: 1} ,{new: true})
                          .then(()=>{ // Update the payout
                            res.json('Success')
                          })
                            
                        })
                        .catch(err => console.log(err))
                    })
                    .catch((err)=>{
                      console.log(err);
                        res.status(500).json("failed");
                    })
                  })
                }else{
                    res.status(400).json("Insufficient balance")
                }
            }else if(payout.source == "credit"){
                if(amount <= brand.credit_balance){
                    // Deduct credits
                    let newAmount = brand.credit_balance - amount;
                    BrandsModel.findByIdAndUpdate(sender_id,{ credit_balance: newAmount}, {new: false})
                    .then((record)=>{
                        addBalanceToRecepient(sender_id, record.brandName, sender_email, recepient_email, recepient_name, amount, country, source, date, currency, description, initiatedBy, approvedBy)
                    })
                    .then( response => {
                      res.status(200).json("success")
                    })
                    .catch(()=>{
                        res.status(500).json("failed")
                    })
                }else{
                    res.status(400).json("Insufficient balance");
                }
            }
        })
      })
      .catch(err => {
        res.status(500).json("Failed Server Error");
      })

    }else{
      res.status(401).json("Unauthorized");
    }
  })
  .catch(err => {
    res.status(500).json("Server Error");
  })
})

app.get('/source_stats/:sender_id', async (req, res) => {
  const sender_id = req.params.sender_id;

  try {
      const totalPayouts = await PayoutsModel.aggregate([
          { $match: { sender_id, source: { $in: ['wallet', 'credit'] } } },
          { $group: { _id: '$source', totalAmount: { $sum: '$amount' } } }
      ]);

      const response = totalPayouts.reduce((acc, item) => {
          acc[item._id] = item.totalAmount;
          return acc;
      }, {});

      res.json(response);
  } catch (err) {
      console.error('Error fetching payouts', err);
      res.status(500).json({ message: 'Internal server error' });
  }
});

const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

app.get('/payouts_per_month/:sender_id', urlEncoded, async (req, res)=>{
  const sender_id = req.params.sender_id;

  try {
      // Fetch payouts for the given sender_id
      const payouts = await PayoutsModel.find({ sender_id });

      if (payouts.length === 0) {
        return res.status(404).json({ error: 'No payouts found for the given sender_id' });
      }

      // Group payouts by month and calculate total amount for each month
      const groupedPayouts = payouts.reduce((acc, payout) => {
          const [day, month, year] = payout.date.split('/');
          const monthYearKey = `${month}-${year}`;
          const monthYear = `${monthNames[parseInt(month) - 1]} ${year}`;

          if (!acc[monthYear]) {
              acc[monthYear] = 0;
          }

          acc[monthYear] += payout.amount;
          return acc;
      }, {});

      // Format the response
      const result = Object.keys(groupedPayouts).map(monthYear => ({
          month: monthYear,
          totalAmount: groupedPayouts[monthYear]
      }));

      res.json(result);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/reject_payout', urlEncoded, (req, res)=>{
  let payoutId = req.body.payoutId;
  let userId = req.body.userId;

  BrandUsersModel.findOne({ _id: userId})
  .then((data)=>{
    if(data.role == "admin"){
        PayoutsModel.findByIdAndUpdate(payoutId, { status: 2 }, { new: true})
        .then(()=>{
          res.status(200).json("Success")
        })
        .catch(()=>{
          res.status(500).json("Failed. Server Error")
        })
    }else{
      res.status(401).json("Unauthorized");
    }
  })
  .catch(err => {
    res.status(500).json("Server Error");
  })
})

app.get("/all_payouts/:id", (req, res)=>{
    PayoutsModel.find({sender_id: req.params.id})
    .then(data => {
        res.json(data)
    })
    .catch(err => {
        res.status(500).json("Failed");
    })
});

app.get("/approved_payouts/:id", (req, res)=>{
  PayoutsModel.find({$and: [{initiatedBy: req.params.id},{status: 1}]})
  .then(data => {
      res.json(data)
  })
  .catch(err => {
      res.status(500).json("Failed");
  })
});

app.get("/pending_payouts/:id", (req, res)=>{
  PayoutsModel.find({$and: [{initiatedBy: req.params.id},{status: 0}]})
  .then(data => {
      res.json(data)
  })
  .catch(err => {
      res.status(500).json("Failed");
  })
});

app.get("/creator_payouts/:id", async (req, res)=>{

  try {
    const payouts = await PayoutsModel.find({recepient_id: req.params.id});

    const promises = payouts.map(async (creator) => {
        const creatorDoc = await BrandsModel.findOne({ _id: creator.sender_id });
        // return { ...creator.toObject(), ...(creatorDoc ? creatorDoc.toObject() : {}) };

        const creatorObj = creator.toObject();
        const brandUserObj = creatorDoc ? creatorDoc.toObject() : {};
        const { date } = creatorObj;
        return { ...brandUserObj, ...creatorObj, date };
    });

    const response = await Promise.all(promises);
    res.json(response);
} catch (err) {
    console.error(err);
    res.status(500).json("Failed to fetch creator applications");
}
})

module.exports = app;