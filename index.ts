import 'dotenv/config';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import auth from './src/modules/auth/auth.routes';
import users from './src/modules/users/users.routes';
import wallets from './src/modules/wallets/wallets.routes';
import lending from './src/modules/lending/lending.routes';
import savings from './src/modules/savings/savings.routes';
import exchange from './src/modules/exchange/exchange.routes';
import notifications from './src/modules/notifications/notifications.routes';
import admin from './src/modules/admin/admin.routes';
import { adminRouter } from './src/modules/admin/admin.routes';
import webhooks from './src/modules/webhooks/webhooks.routes';
import referrals from './src/modules/referrals/referral.routes';
import calculator from './src/modules/calculator/calculator.routes';
import prices from './src/modules/prices/prices.routes';
import dashboard from './src/modules/dashboard/dashboard.routes';
import { adminChat } from './src/modules/adminChat/chat.routes';
import adminAssets from './src/modules/adminAssets/assets.routes';
import connectDB from './src/config/db';
import { createBunWebSocket } from 'hono/bun'

connectDB();

const app = new Hono();
const { websocket } = createBunWebSocket()

// API Logger
app.use(logger())

// Cors Configuration
app.use(cors({
    origin: (origin) => origin ?? '*', // Reflects the request's origin or * if undefined
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposeHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
}))

// Routes

app.get("/", (c) => {
    return c.text("Lendbloc API is Live 🚀", 200)
})

app.route('/api/v1/auth', auth);
app.route('/api/v1/users', users);
app.route('/api/v1/wallets', wallets);
app.route('/api/v1/lending', lending);
app.route('/api/v1/savings', savings);
app.route('/api/v1/exchange', exchange);
app.route('/api/v1/notifications', notifications);
app.route('/api/v1/admin/auth', adminRouter); // Admin Auth
app.route('/api/v1/admin', admin);
app.route('/api/v1/admin/chat', adminChat);
app.route('/api/v1/admin/assets', adminAssets);
app.route('/api/v1/webhooks', webhooks);
app.route('/api/v1/referrals', referrals);
app.route('/api/v1/calculator', calculator);
app.route('/api/v1/prices', prices);
app.route('/api/v1/dashboard', dashboard);

const now = new Date();
const formattedDate = now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
});

console.log(`
==========================================
🚀 LendBloc API is running!
🕒 Deployed at: ${formattedDate}
==========================================
`);


export default {
    port: process.env.PORT || 3000,
    idleTimeout: 255,
    fetch: app.fetch,
    websocket,
}
