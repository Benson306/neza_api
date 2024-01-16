let express = require('express');
let app = express.Router();
let bodyParser = require('body-parser');
const urlEncoded = bodyParser.urlencoded({extended: false});
const bcrypt = require('bcrypt');
const AdminUsersModel = require('../Models/AdminUsersModel');

const currentDate = new Date();
const formattedDate = currentDate.toLocaleDateString('en-GB');
const saltRounds = parseInt(process.env.Salt_Rounds, 10);

app.post('/add_admin_user', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    AdminUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            res.status(409).json('User Exists')
        }else{

            bcrypt.hash(password, saltRounds, function(err, hash) {
                // Store hash in your password DB.
                AdminUsersModel({ email, password: hash, date: formattedDate}).save()
                .then( data =>{
                    res.json('Added');
                })
                .catch(err =>{
                    res.status(401).json('Not Added')
                })
            });
        }
    })
})

app.get('/admin_users', (req, res)=>{
    AdminUsersModel.find({})
    .then(data => {
      let cleanData = [];
      data.map( user => {
        let newData = {}
        newData = {
          _id: user._id,
          email: user.email,
          date: user.date
        }
        cleanData.push(newData);
      })
      res.json(cleanData);
    })
})

app.post('/admin_login', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;

    AdminUsersModel.findOne({email: email})
    .then(data => {
        if(data){
            bcrypt.compare(password, data.password, function(err, result) {
                if(result){
                    res.json({ email: data.email })
                }else{
                    res.status(401).json('Wrong Credentials')
                }
            })
        }else{
            res.status(401).json('Failed');
        }
    })
})

app.delete('/del_admin_users/:id', urlEncoded, (req, res)=>{
    let masterPassword = req.body.masterPassword;
    let master_password = process.env.MASTER_PASSWORD;

    if(masterPassword !== master_password){
        res.status(401).json('Wrong Credentials');
    }else{
        AdminUsersModel.findByIdAndDelete(req.params.id)
        .then(data =>  res.json('success'))
        .catch(err => res.status(500).json('failed'))
    }
    
})

app.put('/update_admin_users/:id', urlEncoded, (req, res)=>{
    let email = req.body.email;
    let password = req.body.password;
    let masterPass = req.body.masterPassword;
    let master_password = process.env.MASTER_PASSWORD;

    if(master_password !== masterPass){
        res.status(401).json('Wrong Credentials');
    }else{
        bcrypt.hash(password, saltRounds, function(err, hash) {
            // Store hash in your password DB.
            AdminUsersModel.findByIdAndUpdate(req.params.id, { email, password : hash }, {new: true})
            .then(data => {
                res.json('success');
            })
            .catch(err =>{
                res.status(500).json('error');
            })
        });
    }
})

module.exports = app;