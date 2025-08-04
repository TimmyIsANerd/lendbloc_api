import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  createLoan,
  repayLoan,
} from './lending.controller';
import {
  createLoanSchema,
  repayLoanSchema,
} from './lending.validation';

const lending = new Hono();

lending.use('/*', authMiddleware);
lending.post('/loans', zValidator('json', createLoanSchema), createLoan);
lending.post('/loans/:id/repay', zValidator('json', repayLoanSchema), repayLoan);

export default lending;
