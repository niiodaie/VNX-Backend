import express from 'express';
import { getProperties } from '../controllers/rent.controller';

export const rentRoutes = express.Router();

rentRoutes.get('/properties', getProperties);
