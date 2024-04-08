let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const crypto = require('crypto');
const nodemailer  = require('nodemailer');
const bcrypt = require('bcrypt');
const CreatorsModel = require('../Models/CreatorsModel');

const multer = require('multer'); // For handling file uploads
const fs = require('fs'); // For working with the file system
const path = require('path'); // For handling file paths
const CreatorDocModel = require('../Models/CreatorDocModels');
const storage = multer.diskStorage({
    destination: (req, file, cb)=>{
        cb(null, './uploads');
    },
    filename: (req, file, cb)=>{
        cb(null, Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({ storage })

const masterPs = process.env.MASTER_PASSWORD;
const saltRounds = parseInt(process.env.Salt_Rounds, 10);

app.post('/creator_login', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    CreatorsModel.findOne({email: email})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    res.json({ _id: data._id, email: data.email, name: data.name, firstTimePassword: data.firstTime, isVerified: data.isVerified, status: data.status})
                }else{
                    res.status(401).json('Wrong Credentials');
                }
            })
        }else{
            res.status(401).json('Failed');
        }
    })
})

app.post('/change_creator_password', urlEncoded,(req, res)=>{
    let _id = req.body._id;
    let password = req.body.password;
    const saltRounds = parseInt(process.env.Salt_Rounds, 10);

    bcrypt.hash(password, saltRounds, function(err, hash) {
        // Store hash in your password DB.
        CreatorsModel.findOneAndUpdate({_id: _id}, { password: hash, firstTime: false }, {new: true} )
        .then( data =>{
            res.json({
                isVerified: data.isVerified,
                status: data.status
            });
        })
        .catch(err =>{
            res.status(500).json('failed')
        })
    });  
})


app.post("/upload_kyc/:id", upload.fields([{ name: 'id_file', maxCount: 1 }, { name: 'kra_file', maxCount: 1 }]), urlEncoded, (req, res)=>{
    const kra_file = req.files.kra_file[0].filename;
    const id_file = req.files.id_file[0].filename;
    const creator_id =  req.params.id;
    const id_number = req.body.id_number;
    const kra_number = req.body.kra_number;
    const phone_number = req.body.phone_number;

    CreatorDocModel.findOneAndUpdate({ creator_id :  creator_id}, { phone_number, kra_file, id_file, creator_id, id_number, kra_number}, {upsert: true})
    .then(()=>{
        CreatorsModel.findByIdAndUpdate(creator_id, { status : 2 }, { new: true})
        .then(()=>{
            res.json("Success");
        })
        .catch(err => {
            res.status(500).json("Failed");
        }) 
    })
    .catch(err => {
        res.status(500).json("Failed");
    })
    
})


app.get("/creator_applications", async (req, res) => {
    try {
        const creators = await CreatorsModel.find({ status: 2 });

        const promises = creators.map(async (creator) => {
            const creatorDoc = await CreatorDocModel.findOne({ creator_id: creator._id });
            return { ...creator.toObject(), ...(creatorDoc ? creatorDoc.toObject() : {}) };
        });

        const response = await Promise.all(promises);
        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json("Failed to fetch creator applications");
    }
});

app.get("/handle_approvals/:id/:type", (req, res)=>{
    CreatorsModel.findByIdAndUpdate(req.params.id ,{ status : Number(req.params.type) }, {new: true})
    .then(data => {
        if(Number(type) == 0){
            //Send Email
            CreatorsModel.findByIdAndUpdate(req.params.id ,{ isVerified : true }, {new: true})
            .then(()=>{
                res.json("success");
            })
            .catch(()=>{
                res.status(500).json("Failed")
            })
        }else{
            res.json("success");
        }
    })
    .catch(err => {
        res.status(500).json("error");
    })
});

app.get("/get_verification/:id", urlEncoded, (req, res)=>{
    CreatorsModel.findOne({ _id: req.params.id})
    .then((data)=>{
        res.json({ status: data.status })
    })
    .catch(err => {
        console.log(err)
        res.status(500).json("Failed");
    })
})

app.get("/get_creator/:id", urlEncoded, (req, res)=>{
    CreatorsModel.findOne({_id: req.params.id})
    .then(data => {
        let response = { email: data.email, name: data.name, balance: data.balance, totalWithdrawal: data.totalWithdrawal, country: data.country};
        res.json(response);
    })
    .catch(err => {
        res.status(500).json("failed");
    })
})

app.get("/get_creator_phone_number/:id", urlEncoded, (req, res)=>{
    CreatorDocModel.findOne({ creator_id: req.params.id})
    .then(data => {
        res.json(data.phone_number)
    })
    .catch(err =>{
        res.status(500).json("failed");
    })
})

module.exports = app;