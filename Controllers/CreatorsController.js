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

function generateRandomNumber() {
    const seed = Date.now();
    const random = Math.floor(seed * Math.random() * 90000) + 10000;
    return random % 90000 + 10000; // Ensures a 5-digit number
}

const RESET_EMAIL_TEMPLATE  = (password) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Password</title>
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
  
          <div class="title">Password reset</div>
  
          <div class="content">
            <p>Sign in to Neza creators dashboard using the following password:</p>
  
            <div class="credentials">
              <table>
                  <td>Password:</td>
                  <td>${password}</td>
                </tr>
              </table>
            </div>
  
            <div class="sign">
              <a href="https://creators.neza.money/" class="signin-btn">Sign In</a>
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

app.post('/reset_creator_password', urlEncoded, (req, res)=>{
    let email = req.body.email;
  
    CreatorsModel.findOne({email: email})
    .then(data => {
        if(data){
            //Generate Password
            const generatedPassword = generateStrongPassword(masterPs, generateRandomNumber(), email);
  
            const options = {
                from: `NEZA <${process.env.EMAIL_USER}>`, // sender address
                to: `${email}`, // receiver email
                subject: "Password Reset", // Subject line
                html: RESET_EMAIL_TEMPLATE(generatedPassword),
            }
  
            // Send Email
            SENDMAIL(options, (info) => {
                console.log("Email sent successfully");
                console.log("MESSAGE ID: ", info.messageId);
            });
  
            bcrypt.hash(generatedPassword, saltRounds, function(err, hash) {
                // Store hash in your password DB.
                CreatorsModel.findOneAndUpdate({email: email},{ password: hash, firstTime: true},{new: true})
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
});

app.put('/change_creator_password', urlEncoded, (req, res)=>{
    let _id = req.body._id;
    let currPassword = req.body.currPassword;
    let newPassword = req.body.newPassword
    const saltRounds = parseInt(process.env.Salt_Rounds, 10);
  
    CreatorsModel.findOne({_id: _id})
    .then(data => {
        if(data){
          bcrypt.compare(currPassword, data.password, function(err, result) {
            if(result){
                bcrypt.hash(newPassword, saltRounds, function(err, hash) {
                    // Store hash in your password DB.
                    CreatorsModel.findOneAndUpdate({_id: _id}, { password: hash }, {new: true} )
                    .then( data =>{
                        res.json('success');
                    })
                    .catch(err =>{
                        res.status(500).json('failed')
                    })
                });
            }else{
                res.status(401).json('Wrong Credentials')
            }
          })
        }else{
          res.status(401).json('Failed');
        }
    })
});

app.put('/change_creator_email', urlEncoded, (req, res)=>{
    let _id = req.body._id;
    let currPassword = req.body.emailPassword;
    let currEmail = req.body.currentEmail;
    let newEmail = req.body.changedEmail;
    const saltRounds = parseInt(process.env.Salt_Rounds, 10);
  
    CreatorsModel.findOne({$and: [{_id: _id}, { email: currEmail}]})
    .then(data => {
        if(data){
          bcrypt.compare(currPassword, data.password, function(err, result) {
            console.log(result)
            if(result){
                CreatorsModel.findOneAndUpdate({_id: _id}, { email: newEmail }, {new: true} )
                .then( data =>{
                    res.json('success');
                })
                .catch(err =>{
                    res.status(500).json('failed');
                })
            }else{
                res.status(401).json('Wrong Credentials');
            }
          })
        }else{
          res.status(401).json('Failed');
        }
    })
  });


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


app.get("/creator_applications/:id", async (req, res) => {
    try {
        const creators = await CreatorsModel.find({ initiatedBy : req.params.id });

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