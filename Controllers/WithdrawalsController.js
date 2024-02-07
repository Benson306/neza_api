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
    let amount = Number(req.body.amount);

    const currentDate = new Date();
    const date = currentDate.toLocaleDateString('en-GB');

    CreatorsModel.findOne({ _id: creator_id})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    // Compare balance vs amount
                    if( amount < Number(data.balance)){
                        let newAmount = Number(data.balance) - amount;
                        let newWithdrawalBal = Number(data.totalWithdrawal) + amount;
                        CreatorsModel.findOneAndUpdate({_id: data._id}, { balance: newAmount, totalWithdrawal: newWithdrawalBal  }, { new: true})
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
                            res.status(500).json("failed");
                        })
                    }else{
                        res.status(300).json('invalid amount')
                    }
                    CreatorsModel.find
                }else{
                    res.status(401).json('wrong credentials');
                }
            })
        }else{
            res.status(401).json('failed');
        }
    })
    .catch(err => {
        console.log(err);
    })
})

module.exports = app;