let express = require('express');

let app =  express();

require('dotenv').config();

app.use(express.json());

let cors = require('cors');
 
app.use(cors());

let mongoose = require('mongoose');

//Connect to mongoDb using mongoose library
let mongoURI = process.env.DEV_MONGO_URI;

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(mongoURI);

let BrandsController = require('./Controllers/BrandsController');
app.use('/', BrandsController);

let BrandUsersController = require('./Controllers/BrandUsersController');
app.use('/', BrandUsersController);

let AdminUsersController = require('./Controllers/AdminUsersController');
app.use('/', AdminUsersController);

let PayoutsController = require('./Controllers/PayoutsController');
app.use('/', PayoutsController);

let CreatorsController = require('./Controllers/CreatorsController');
app.use('/', CreatorsController);

let WithdrawalsController = require('./Controllers/WithdrawalsController');
app.use('/', WithdrawalsController);

let DepositController = require('./Controllers/DepositController');
app.use('/', DepositController);

let port = process.env.PORT || 5000;

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})