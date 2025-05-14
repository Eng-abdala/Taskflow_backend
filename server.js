const express = require('express');
const mongoose =require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors())

// MongoDB connection   
mongoose.connect('mongodb+srv://ciilanesalaad482561:OdIcsaF5j7L6zxBy@taskflow.qfopp6h.mongodb.net/?retryWrites=true&w=majority&appName=taskflow/TasksFlow').then(()=>{
// mongoose.connect('mongodb://localhost:27017/TasksFlow').then(()=>{
    console.log("MongoDB connected")
}).catch((err)=>{
    console.log(err)
})

// impoeting Task Schema
const schemaTask = require('./model/task');


// API that posts the task to the database
app.post('/addTask',async(req,res)=>{
    const postTask= schemaTask(req.body)
  const savedTask = await postTask.save()
  if(savedTask) {
    res.send("Task added successfully")
  }
  else {
    res.send("Task not added")
  }
})


// API that gets all the tasks from the database
app.get('/getTask',async(req,res)=>{
  const gettask = await schemaTask.find()
   if(gettask){
    res.send(gettask)
   }
  })


// delete Task API
app.delete('/deleteTask/:id',async (req,res)=>{
  const deletetask = await schemaTask.deleteOne({_id:req.params.id})
  if(deletetask){
    res.send("✅ Task deleted successfully")      
}
})


// API that updates the task in the database
app.put('/updateTask/:id',async (req,res)=>{
  const updatetask = await schemaTask.updateOne({_id:req.params.id},{$set:req.body})
  if(updatetask){
    res.send("Task updated successfully")
  } 
})


// API that reads single data using id from the url and sets the data in the input fields
app.get('/getSingleTask/:id',async (req,res)=>{
  const gettask = await schemaTask.find({_id:req.params.id})
  if(gettask){
    res.send(gettask)
  } 
})



// API that updates task status in the database
app.put('/updateStatus/:id',async (req,res)=>{
  const updatetask = await schemaTask.updateOne({_id:req.params.id},{$set:req.body})
  if(updatetask){
    res.send("Task status updated successfully")
  } 
})





app.listen(5000,()=>{
console.log("Server is running on port 5000")
}) 