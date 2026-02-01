import { Router } from 'express';
import { getTickets, getTicket, deleteTicket, updateTicket } from '../db/tickets';
import type { TicketStatus } from '@nixo-slackbot/shared';
import { emitTicketUpdated } from '../socket/events';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as TicketStatus | undefined;
    const tickets = await getTickets(status);
    res.json(tickets);
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tickets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ticket' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status if provided
    if (status && !['open', 'closed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be open, closed, or resolved.' });
    }
    
    const ticket = await updateTicket(req.params.id, { status });
    
    // Emit socket event for real-time updates
    emitTicketUpdated(ticket.id);
    
    res.json(ticket);
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to update ticket' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteTicket(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to delete ticket' });
  }
});

export default router;
