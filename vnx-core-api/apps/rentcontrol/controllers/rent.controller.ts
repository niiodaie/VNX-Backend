import { Request, Response } from 'express';
import { supabase } from '../../../core/supabaseClient';

export const getProperties = async (_: Request, res: Response) => {
  const { data, error } = await supabase.from('properties').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json({ properties: data });
};
