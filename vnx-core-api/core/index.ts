
import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient';
import { router as authRoutes } from './auth/auth.routes';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('VNX Core API v2 running on DigitalOcean 🚀'));
app.use('/auth', authRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`✅ Core API running on port ${port}`));
