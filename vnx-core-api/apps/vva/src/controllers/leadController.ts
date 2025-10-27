import { Request, Response } from 'express'
import { supabase, isSupabaseConfigured } from '../config/supabase'

// Mock data for when Supabase is not configured
const mockLeads = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@techcorp.com',
    company: 'TechCorp Inc',
    industry: 'Technology',
    status: 'new',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@innovate.io',
    company: 'Innovate Solutions',
    industry: 'Software',
    status: 'contacted',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

export const getLeads = async (req: Request, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      res.json({
        success: true,
        data: data || [],
        count: data?.length || 0,
      })
    } else {
      // Return mock data
      res.json({
        success: true,
        data: mockLeads,
        count: mockLeads.length,
        note: 'Using mock data - Supabase not configured',
      })
    }
  } catch (error: any) {
    console.error('Error in getLeads:', error)
    res.status(500).json({
      error: 'Failed to fetch leads',
      message: error.message,
    })
  }
}

export const createLead = async (req: Request, res: Response) => {
  try {
    const { name, email, company, industry, status } = req.body

    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'email'],
      })
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name, email, company, industry, status: status || 'new' })
        .select()
        .single()

      if (error) throw error

      res.status(201).json({
        success: true,
        data,
      })
    } else {
      res.status(501).json({
        error: 'Supabase not configured',
        message: 'Cannot create leads without Supabase configuration',
      })
    }
  } catch (error: any) {
    console.error('Error in createLead:', error)
    res.status(500).json({
      error: 'Failed to create lead',
      message: error.message,
    })
  }
}

export const updateLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      res.json({
        success: true,
        data,
      })
    } else {
      res.status(501).json({
        error: 'Supabase not configured',
        message: 'Cannot update leads without Supabase configuration',
      })
    }
  } catch (error: any) {
    console.error('Error in updateLead:', error)
    res.status(500).json({
      error: 'Failed to update lead',
      message: error.message,
    })
  }
}

export const deleteLead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) throw error

      res.json({
        success: true,
        message: 'Lead deleted successfully',
      })
    } else {
      res.status(501).json({
        error: 'Supabase not configured',
        message: 'Cannot delete leads without Supabase configuration',
      })
    }
  } catch (error: any) {
    console.error('Error in deleteLead:', error)
    res.status(500).json({
      error: 'Failed to delete lead',
      message: error.message,
    })
  }
}

