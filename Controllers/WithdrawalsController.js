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
const axios = require("axios");
const { runInNewContext } = require('vm');
const CreatorDocModel = require('../Models/CreatorDocModels');

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
});

function createTransferReceipt ( creator_id, account_number, callback){ 
    CreatorsModel.findOne({ _id: creator_id})
    .then(async receiptResponse => {
        if(receiptResponse.receipt_code.length < 3 ){
            try {
                const response = await axios.post(
                    'https://api.paystack.co/transferrecipient',
                    {
                        type: "mobile_money",
                        name: receiptResponse.name,
                        account_number: account_number,
                        bank_code: "MPESA",
                        currency: "KES"
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
        
                // Return the response from Paystack API
                CreatorsModel.findByIdAndUpdate(creator_id, { receipt_code : response.data.data.recipient_code}, { new: true})
                .then(()=>{
                    callback(response.data.data.recipient_code, null);
                })
                .catch((err)=>{
                    callback(null, err);
                })
            } catch (error) {
                // Return error response
                callback(null, error.response.data);
            }

        }else{
            callback(receiptResponse.receipt_code, null);
        }
    })
    .catch(err => {
        callback(null, err)
    })
    
};

app.post("/make_withdrawal", urlEncoded, (req, res)=>{
    let password = req.body.password;
    let creator_id = req.body.creator_id;
    let amount = Number(req.body.amount);
    let reason = "Neza withdraw";
    let currency = "KES";
    
    const currentDate = new Date();
    const date = currentDate.toLocaleDateString('en-GB');

    CreatorsModel.findOne({ _id: creator_id})
    .then(data => {
        if(data){
            CreatorDocModel.findOne({ creator_id: data._id })
            .then(docData => {
                let phone_number = docData.phone_number.replace("+254", "0");
                bcrypt.compare(password, data.password, function(err, result) {
                    if(result){
                        // Compare balance vs amount
                        if( amount <= Number(data.balance)){
    
                            let newAmount = Number(data.balance) - amount;
                            let newWithdrawalBal = Number(data.totalWithdrawal) + amount;
                            
                                WithdrawalsModel({ creator_id: creator_id, currency, status:"transfer.pending", amount: amount, date: date}).save()
                                .then((savedTransfer)=>{
    
                                    //Create transfer receipt if it does not exists
                                    createTransferReceipt(creator_id, phone_number,(async (receipt, error) =>{
                                        if(!error){
                                            // Make Paystack Transaction
                                            try {
                                                const response = await initiatePayout(amount*100, currency, receipt, savedTransfer._id, reason);
                                                //update transaction status
                                                WithdrawalsModel.findByIdAndUpdate(savedTransfer._id, { status: "transfer.queued" }, { new: true})
                                                .then(()=>{
                                                    //update balance
                                                    CreatorsModel.findOneAndUpdate({_id: data._id}, { balance: newAmount, totalWithdrawal: newWithdrawalBal  }, { new: true})
                                                    .then(data => {
                                                        res.json("success");
                                                    })
                                                });
                                                
                                            } catch (error) {
                                                // Return error response
                                                WithdrawalsModel.findByIdAndUpdate(savedTransfer._id, { status: "transfer.failed" }, { new: true})
                                                .then(()=>{
                                                    res.status(500).json("failed: payment");
                                                });
                                            }
                                        }else{
                                            res.status(500).json(error);
                                        }
                                        
                                    }))
                                    
                                })
                                .catch(err => {
                                    res.status(500).json("failed: record intial transaction");
                                })
                            
                        }else{
                            res.status(300).json('invalid amount')
                        }
                    }else{
                        res.status(401).json('wrong credentials');
                    }
                })
            })
            .catch(err => {
                res.status(401).json('failed');
            })  
        }else{
            res.status(401).json('failed');
        }
    })
    .catch(err => {
        console.log(err);
    })
});

async function initiatePayout(amount, currency, recipientCode, reference, reason) {
    try {
        const response = await axios.post(
            "https://api.paystack.co/transfer",
            {
                source: 'balance',
                amount: amount,
                currency : currency,
                recipient: recipientCode,
                reference: reference,
                reason: reason,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Return the response
        return response.data;
    } catch (error) {
        console.error('Error initiating payout:', error.response.data.message);
        throw error;
    }
}

app.post("/withdrwal_confirmation", (req, res)=>{
    let data = req.body;

    WithdrawalsModel.findByIdAndUpdate(data.data.reference, { status: data.event }, { new: true})
    .then((newData)=>{

        //reversal
        if(data.event == "transfer.failed"){
            CreatorsModel.findOne({ _id: newData.creator_id})
            .then(result => {
                let newBal = result.balance + newData.amount;
                let newTotalWithdrawal = result.totalWithdrawal - newData.amount;

                CreatorsModel.findByIdAndUpdate(newData.creator_id, { balance: newBal, totalWithdrawal: newTotalWithdrawal }, { new: true})
                .then(()=>{
                    res.sendStatus(200);
                })
            })
        }else{
            res.sendStatus(200);
        }
    })
    .catch(err=>{
        res.sendStatus(200);
    })
})

app.get("/withdrawals/:id", (req, res)=>{
    WithdrawalsModel.find({ creator_id: req.params.id})
    .then(data => {
        res.json(data);
    })
    .catch(err => {
        res.status(500).json("failed");
    })
})

module.exports = app;