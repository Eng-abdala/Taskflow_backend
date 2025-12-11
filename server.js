// ...existing code...
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// models
const Task = require('./model/task');
const User = require('./model/register');

// config
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/TasksFlow';
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_jwt_secret';
const PORT = process.env.PORT || 5000;

// connect DB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message || err);
    process.exit(1);
  });

// auth middleware
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No authorization header' });

  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Routes

// Register - creates a new user (password hashed)

app.post('/register', async (req, res) => {
  try {
    console.log('REGISTER request body:', req.body);
    const { email, username, password, confirmPassword } = req.body;

    // basic validation
    if (!email || !username || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // check uniqueness
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ message: 'Email already in use' });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(409).json({ message: 'Username already in use' });

    // hash and save (do NOT store confirmPassword)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hashedPassword });

    const savedUser = await newUser.save();
    res.status(201).json({ message: 'User created', user: { id: savedUser._id, email: savedUser.email, username: savedUser.username } });
  } catch (err) {
    console.error('REGISTER error:', err);
    // handle duplicate key error if it slips through
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      return res.status(409).json({ message: `${field} already exists` });
    }
    // mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join('; ');
      return res.status(400).json({ message: messages || 'Validation error' });
    }
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});


// Login - verifies credentials and returns JWT
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message || err });
  }
});

// Get logged-in user info
app.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user', error: err.message || err });
  }
});

// Add task - only for authenticated user
app.post('/addTask', authenticate, async (req, res) => {
  try {
    const task = new Task({ ...req.body, userId: req.userId });
    const saved = await task.save();
    res.status(201).json({ message: 'Task added', task: saved });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add task', error: err.message || err });
  }
});

// Get tasks for logged-in user
app.get('/getTask', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: err.message || err });
  }
});

// Get single task (only owner)
app.get('/getSingleTask/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (String(task.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch task', error: err.message || err });
  }
});

// Update task (only owner)
app.put('/updateTask/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (String(task.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    Object.assign(task, req.body);
    const updated = await task.save();
    res.json({ message: 'Task updated', task: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update task', error: err.message || err });
  }
});

// Update task status (only owner)
app.put('/updateStatus/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (String(task.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    task.status = req.body.status ?? task.status;
    const updated = await task.save();
    res.json({ message: 'Status updated', task: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status', error: err.message || err });
  }
});

// Delete task (only owner)
app.delete('/deleteTask/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (String(task.userId) !== String(req.userId)) return res.status(403).json({ message: 'Forbidden' });

    await Task.deleteOne({ _id: req.params.id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete task', error: err.message || err });
  }
});

// optional: get all users (admin use) - safe to remove if not needed
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users', error: err.message || err });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// ...existing code...