import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { quoteLoan, createLoanFromQuote, getLoan, cancelLoan } from './lending.new.controller';
import { quoteLoanSchema, createLoanFromQuoteSchema, loanIdParamSchema } from './lending.new.validation';

// E2E examples for docs/testing
export const lendingExamples = new Hono();
lendingExamples.use('/*', authMiddleware);

lendingExamples.post('/examples/quote-usdt-eth', zValidator('json', quoteLoanSchema), quoteLoan);
lendingExamples.post('/examples/create-from-quote', zValidator('json', createLoanFromQuoteSchema), createLoanFromQuote);
lendingExamples.get('/examples/loan/:id', zValidator('param', loanIdParamSchema), getLoan);
lendingExamples.post('/examples/loan/:id/cancel', zValidator('param', loanIdParamSchema), cancelLoan);

