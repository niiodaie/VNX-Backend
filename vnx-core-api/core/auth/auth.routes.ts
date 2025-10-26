
import express from 'express';
import { login } from './auth.controller';
export const router = express.Router();
router.post('/login', login);
