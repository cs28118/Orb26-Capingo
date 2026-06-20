const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURL = process.env.MONGODB_URL;

    if (!mongoURL) {
      throw new Error('MONGODB_URL is not defined in the .env file');
    }

    await mongoose.connect(mongoURL);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1); 
  }
};

module.exports = connectDB;