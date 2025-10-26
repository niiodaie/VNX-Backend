import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rentRoutes } from '../apps/rentcontrol/routes/rent.routes';
import { verifyToken } from './middleware/verifyToken';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (_, res) => {
  res.json({ message: 'Welcome to VNX Core API 🚀' });
});

// Mount microservices
app.use('/api/rentcontrol', verifyToken, rentRoutes);

// Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ VNX Core API running on port ${PORT}`));
