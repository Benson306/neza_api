let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt= require('bcrypt');
const CreatorsModel = require('../Models/CreatorsModel');
const SENDMAIL = require('../Utils/SendMail');
const WithdrawalsModel = require('../Models/WithdrawalsModel');

app.post("/withdraw", urlEncoded, (req, res)=>{
    let password = req.body.password;
    let currency = req.body.currency;
    let creator_id = req.body.creator_id;
    let amount = req.body.amount;

    const currentDate = new Date();
    const date = currentDate.toLocaleDateString('en-GB');

    CreatorsModel.findOne({ _id: creator_id})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    // Compare balance vs amount
                    if( amount < data.balance){
                        let newAmount = data.balance - amount;
                        CreatorsModel.findOneAndUpdate({_id: data._id}, { balance: newAmount }, { new: true})
                        .then(data => {
                            WithdrawalsModel({ creator_id: creator_id, amount: amount, date: date}).save()
                            .then(()=>{
                                res.json("success");
                            })
                            .catch(err => {
                                res.status(500).json("failed");
                            })
                        })
                        .catch(err => {
                            res.status(500).json("Failed");
                        })
                    }else{
                        res.status(300).json('Invalid amount')
                    }
                    CreatorsModel.find
                }else{
                    res.status(401).json('Wrong Credentials');
                }
            })
        }else{
            res.status(401).json('Failed');
        }
    })
    .catch(err => {
        console.log(err);
    })
})

module.exports = app;