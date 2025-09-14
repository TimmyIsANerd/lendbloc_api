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
import { quoteLoan, createLoanFromQuote, getLoan, cancelLoan, listLoans, increaseCollateral, repayRequestOtp, repayConfirm, getLoanAlerts, updateLoanAlerts } from './lending.new.controller';
import { quoteLoanSchema, createLoanFromQuoteSchema, loanIdParamSchema, listLoansQuerySchema, increaseCollateralSchema, repayRequestOtpSchema, repayConfirmSchema, updateLoanAlertsSchema } from './lending.new.validation';

const lending = new Hono();

lending.use('/*', authMiddleware);

// New quote + create-from-quote endpoints
lending.post('/quotes', zValidator('json', quoteLoanSchema), quoteLoan);
lending.post('/loans/from-quote', zValidator('json', createLoanFromQuoteSchema), createLoanFromQuote);
lending.get('/loans', zValidator('query', listLoansQuerySchema), listLoans);
lending.get('/loans/:id', zValidator('param', loanIdParamSchema), getLoan);
lending.post('/loans/:id/cancel', zValidator('param', loanIdParamSchema), cancelLoan);

// New endpoints
lending.post('/loans/:id/collateral/increase', zValidator('param', loanIdParamSchema), zValidator('json', increaseCollateralSchema), increaseCollateral);
lending.post('/loans/:id/repay/otp', zValidator('param', loanIdParamSchema), zValidator('json', repayRequestOtpSchema), repayRequestOtp);
lending.post('/loans/:id/repay/confirm', zValidator('param', loanIdParamSchema), zValidator('json', repayConfirmSchema), repayConfirm);

// Alerts configuration
lending.get('/loans/:id/alerts', zValidator('param', loanIdParamSchema), getLoanAlerts);
lending.put('/loans/:id/alerts', zValidator('param', loanIdParamSchema), zValidator('json', updateLoanAlertsSchema), updateLoanAlerts);

// Existing endpoints (legacy direct-loan & repay)
lending.post('/loans', zValidator('json', createLoanSchema), createLoan);
lending.post('/loans/:id/repay', zValidator('json', repayLoanSchema), repayLoan);

export default lending;
