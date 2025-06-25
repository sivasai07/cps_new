import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import prereqRoutes from './routes/prerequisites';
import summaryRoutes from './routes/summaryRoute' 
import quizAttempts from './routes/quixAttempts'
import learningPath from './routes/learningPath'

// Load environment variables with explicit path
dotenv.config({ path: path.join(__dirname, '../.env') });

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:');
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('PORT:', process.env.PORT);
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.substring(0, 20)}...` : 'undefined');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/prerequisites', prereqRoutes);
app.use('/api', summaryRoutes);
app.use('/api',quizAttempts);
app.use('/api', learningPath);

// MongoDB connection with fallback values
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mern-project';
const port = process.env.PORT || 5000;

console.log('Attempting to connect to MongoDB with URI:', mongoUri);

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Server will continue running without database connection');
  });

app.listen(port, () => console.log(`Server running on port ${port}`));
