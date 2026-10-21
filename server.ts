import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { Resend } from 'resend';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' })); // Support large images
app.use(cookieParser());

// --- MongoDB Models ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  codeExpires: { type: Date }
});
const User = mongoose.model('User', userSchema);

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: String,
  text: String,
  date: String,
  image: String,
  season: String,
  timeOfDay: String,
  weather: String,
  scene: String,
  intensity: Number,
  fontFamily: String,
  fontSize: Number
});
const Story = mongoose.model('Story', storySchema);

// --- Resend Setup ---
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Auth Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = (decoded as any).userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---
// 1. Send Verification Code
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  let user = await User.findOne({ email });
  if (user && user.isVerified) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  if (!user) {
    user = new User({ email, verificationCode: code, codeExpires: expires });
  } else {
    user.verificationCode = code;
    user.codeExpires = expires;
  }
  await user.save();

  try {
    await resend.emails.send({
      from: 'Flow Journey <onboarding@resend.dev>', // Use verified domain in prod
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    });
    res.json({ message: 'Code sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// 2. Register
app.post('/api/auth/register', async (req, res) => {
  const { email, code, password } = req.body;
  const user = await User.findOne({ email, verificationCode: code, codeExpires: { $gt: new Date() } });
  
  if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

  user.isVerified = true;
  user.password = await bcrypt.hash(password, 10);
  user.verificationCode = undefined;
  user.codeExpires = undefined;
  await user.save();

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
  res.json({ user: { email: user.email } });
});

// 3. Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, isVerified: true });
  if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
  res.json({ user: { email: user.email } });
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// 5. Get Current User
app.get('/api/auth/me', authenticate, async (req: any, res: any) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { email: user.email } });
});

// 6. Stories CRUD
app.get('/api/stories', authenticate, async (req: any, res: any) => {
  const stories = await Story.find({ userId: req.userId }).sort({ date: -1 });
  res.json(stories.map(s => ({ ...s.toObject(), id: s._id })));
});

app.post('/api/stories', authenticate, async (req: any, res: any) => {
  const story = new Story({ ...req.body, userId: req.userId });
  await story.save();
  res.json({ ...story.toObject(), id: story._id });
});

app.put('/api/stories/:id', authenticate, async (req: any, res: any) => {
  const story = await Story.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    req.body,
    { new: true }
  );
  if (!story) return res.status(404).json({ error: 'Not found' });
  res.json({ ...story.toObject(), id: story._id });
});

app.delete('/api/stories/:id', authenticate, async (req: any, res: any) => {
  const story = await Story.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!story) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

// --- Vite Middleware & Start ---
async function startServer() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } else {
    console.warn('MONGODB_URI not set. Database operations will fail.');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
