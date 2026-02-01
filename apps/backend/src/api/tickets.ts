import { Router } from 'express';
import { getTickets, getTicket } from '../db/tickets';
import type { TicketStatus } from '@nixo-slackbot/shared';

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

export default router;
