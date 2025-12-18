import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/upload';
import downloadRoutes from './routes/download';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', uploadRoutes);
app.use('/api', downloadRoutes);

app.listen(PORT, () => {
  console.log(`TWill Backend Server running on http://localhost:${PORT}`);
  console.log(`B2 Bucket: ${process.env.B2_BUCKET_NAME}`);
  console.log(`B2 Endpoint: ${process.env.B2_ENDPOINT}`);
});
