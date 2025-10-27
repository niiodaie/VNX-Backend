import { Router } from 'express'
import { getLeads, createLead, updateLead, deleteLead } from '../controllers/leadController'

const router = Router()

// GET /api/leads - Get all leads
router.get('/', getLeads)

// POST /api/leads - Create a new lead
router.post('/', createLead)

// PUT /api/leads/:id - Update a lead
router.put('/:id', updateLead)

// DELETE /api/leads/:id - Delete a lead
router.delete('/:id', deleteLead)

export default router

