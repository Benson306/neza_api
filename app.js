let express = require('express');

let app =  express();

app.get('/index',(req, res)=>{
    res.json('success');
})

let port = process.env.PORT || 5000;

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})