let express = require('express');

let app =  express();

require('dotenv').config();

app.use(express.json());

let cors = require('cors');
 
app.use(cors());

let mongoose = require('mongoose');

//Connect to mongoDb using mongoose library
let mongoURI = process.env.DEV_MONGO_URI;

mongoose.connect(mongoURI);

let BrandUsersController = require('./Controllers/BrandsUsersController');
app.use('/', BrandUsersController);

let port = process.env.PORT || 5000;

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})