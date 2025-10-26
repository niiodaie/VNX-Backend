
import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient';
import { router as authRoutes } from './auth/auth.routes';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('VNX Core API is live 🚀'));
app.use('/auth', authRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
