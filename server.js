const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Import services
const DiscordService = require('./services/discord');
const KisApiService = require('./services/kisApi');
const TradingService = require('./services/trading');

// Import routes
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');

// Initialize Express app
const app = express();
const PORT = 80; // Use port 80 for simple URL

// Create necessary directories
const dirs = ['./data', './logs', './config', './models', './routes', './services', './public'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/trading.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Basic authentication middleware
const basicAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    
    if (!auth) {
        return next(); // Allow public routes
    }
    
    const [username, password] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    
    if (username === 'root' && password === 'dldnjsgud') {
        next();
    } else {
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// Initialize services
const discordService = new DiscordService(logger);
const kisApiService = new KisApiService(logger);
const tradingService = new TradingService(logger, kisApiService, discordService);

// Make services available to routes
app.locals.logger = logger;
app.locals.discordService = discordService;
app.locals.kisApiService = kisApiService;
app.locals.tradingService = tradingService;

// Routes
app.use('/api', basicAuth, apiRoutes);
app.use('/', webhookRoutes); // Simple webhook routes without /webhook prefix

// Main webhook endpoint - SIMPLE URL
app.post('/order', async (req, res) => {
    try {
        logger.info('Webhook received', { body: req.body });
        
        // Send immediate response
        res.status(200).json({ status: 'received' });
        
        // Process order asynchronously
        await tradingService.processOrder(req.body);
        
        // Notify Discord
        await discordService.sendNotification({
            title: 'Order Received',
            color: 0x00ff00,
            fields: [
                { name: 'Symbol', value: req.body.symbol || 'N/A', inline: true },
                { name: 'Action', value: req.body.action || 'N/A', inline: true },
                { name: 'Quantity', value: req.body.contracts || 'N/A', inline: true },
                { name: 'Price', value: req.body.price || 'N/A', inline: true }
            ]
        });
        
    } catch (error) {
        logger.error('Webhook processing error:', error);
        await discordService.sendError('Webhook Processing Error', error);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    discordService.sendError('Server Error', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    logger.info(`ATD Server running on port ${PORT}`);
    logger.info(`Webhook endpoint: http://YOUR_IP/order`);
    
    // Send startup notification to Discord
    discordService.sendNotification({
        title: 'ATD System Started',
        color: 0x0099ff,
        fields: [
            { name: 'Status', value: 'Online', inline: true },
            { name: 'Port', value: PORT.toString(), inline: true },
            { name: 'Webhook URL', value: 'http://YOUR_IP/order', inline: false }
        ]
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Server shutting down...');
    discordService.sendNotification({
        title: 'ATD System Shutdown',
        color: 0xff0000,
        fields: [
            { name: 'Status', value: 'Offline', inline: true }
        ]
    }).then(() => {
        process.exit(0);
    });
});