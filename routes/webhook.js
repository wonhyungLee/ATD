const express = require('express');
const router = express.Router();

// Main webhook endpoint - /order
router.post('/order', async (req, res) => {
    const { tradingService, logger, discordService } = req.app.locals;
    
    try {
        // Log incoming webhook
        logger.info('Webhook received at /order', {
            body: req.body,
            headers: req.headers,
            ip: req.ip
        });

        // Validate webhook data
        tradingService.validateWebhookData(req.body);

        // Send immediate acknowledgment
        res.status(200).json({ 
            status: 'received',
            timestamp: new Date().toISOString()
        });

        // Process order asynchronously
        setImmediate(async () => {
            try {
                await tradingService.processOrder(req.body);
            } catch (error) {
                logger.error('Async order processing failed:', error);
                await discordService.sendError('Async Order Processing Failed', error);
            }
        });

    } catch (error) {
        logger.error('Webhook validation failed:', error);
        
        // Send error to Discord
        await discordService.sendError('Webhook Validation Failed', error);
        
        // Still return 200 to prevent TradingView from retrying
        res.status(200).json({ 
            status: 'error',
            error: error.message
        });
    }
});

// Alternative webhook endpoints for compatibility
router.post('/webhook', async (req, res) => {
    req.app.locals.logger.info('Redirecting /webhook to /order');
    req.url = '/order';
    router.handle(req, res);
});

router.post('/tradingview', async (req, res) => {
    req.app.locals.logger.info('Redirecting /tradingview to /order');
    req.url = '/order';
    router.handle(req, res);
});

// Test webhook endpoint
router.post('/test', async (req, res) => {
    const { logger, discordService } = req.app.locals;
    
    try {
        logger.info('Test webhook received', { body: req.body });
        
        await discordService.sendNotification({
            title: 'Test Webhook Received',
            color: 0x9b59b6,
            fields: [
                { name: 'Timestamp', value: new Date().toISOString(), inline: false },
                { name: 'Body', value: JSON.stringify(req.body, null, 2).substring(0, 1000), inline: false }
            ]
        });
        
        res.json({ 
            status: 'success',
            message: 'Test webhook processed',
            received: req.body
        });
    } catch (error) {
        logger.error('Test webhook error:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// Webhook status endpoint
router.get('/webhook/status', (req, res) => {
    res.json({
        status: 'active',
        endpoints: [
            '/order (recommended)',
            '/webhook',
            '/tradingview',
            '/test'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;