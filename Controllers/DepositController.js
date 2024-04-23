let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const axios = require('axios');
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const SENDMAIL = require('../Utils/SendMail');
const BrandUsersModel = require('../Models/BrandusersModel');
const DepositModel = require('../Models/DepositModel');

app.get('/deposits/:id', (req, res)=>{
    DepositModel.find({ brand_id: req.params.id})
    .then(data => {
        res.json(data);
    })
})

app.get('/cancel_transaction/:id', (req, res)=>{
    DepositModel.findByIdAndUpdate(req.params.id, { status: "charge.cancelled"}, { new: true})
    .then(response => res.json("success") )
    .catch(err => res.json("Failed"));
})

function initializeTransaction(deposit_id, amount, brand_email, callback){
    axios.post('https://api.paystack.co/transaction/initialize', {
        email: brand_email,
        amount: amount,
        reference: deposit_id,
        currency: 'KES',
        metadata: {
            "cancel_action":`https://neza-brands.netlify.app/app/add_funds?deposit_id=${deposit_id}`
        }
    }, {
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        callback(response.data, false);
    })
    .catch(error => {
        callback(error, true);
    });
}

function isWholeNumber(amount) {
    const regex = /^\d+$/;
    return regex.test(amount);
}

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

app.post('/charge', urlEncoded, (req, res)=>{
    let brand_id = req.body.brand_id;
    let amount = req.body.amount;

    if(isWholeNumber(amount)){
        BrandUsersModel.findOne({_id: brand_id})
        .then(result =>{
            let brand_email = result.email;
            let newAmount = Number(amount) * 100;
            let currency = "KES";
            const currentDate = new Date();
            const date = currentDate.toLocaleDateString('en-GB');

            DepositModel({ brand_id, brand_email, amount, currency, status: "charge.pending", date, time: getCurrentTime() }).save()
            .then( depositResult => {
                initializeTransaction(depositResult._id, newAmount, brand_email, (data, err)=>{
                    if(!err){
                        res.json(data.data.authorization_url);
                    }else{
                        res.status(500).json("Transaction initialization failed")
                    }
                });
            })
        })
        .catch(err => {
            res.status(404).json("Brand not found");
        })
        
    }else{
        res.json(400).json("Invalid amount");
    }
    
})

module.exports = app