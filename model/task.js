const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true   
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    default: "To Do", // default value
    enum: ["To Do", "In Progress", "Done"] // only allow these
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Tasks", taskSchema);
