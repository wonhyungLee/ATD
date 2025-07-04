const express = require('express');
const router = express.Router();

// Get all API keys (without secrets)
router.get('/keys', (req, res) => {
    const { kisApiService, logger } = req.app.locals;
    
    try {
        const keys = {};
        for (const [account, data] of Object.entries(kisApiService.apiKeys)) {
            keys[account] = {
                accountNumber: data.accountNumber,
                isMock: data.isMock,
                createdAt: data.createdAt
            };
        }
        res.json({ success: true, keys });
    } catch (error) {
        logger.error('Failed to get API keys:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new API key
router.post('/keys', async (req, res) => {
    const { kisApiService, logger, discordService } = req.app.locals;
    const { account, appKey, appSecret, accountNumber, isMock } = req.body;
    
    try {
        if (!account || !appKey || !appSecret || !accountNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        kisApiService.addApiKey(account, appKey, appSecret, accountNumber, isMock);
        
        await discordService.sendNotification({
            title: 'API Key Added',
            color: 0x00ff00,
            fields: [
                { name: 'Account', value: account, inline: true },
                { name: 'Account Number', value: accountNumber, inline: true },
                { name: 'Mode', value: isMock ? 'Mock' : 'Real', inline: true }
            ]
        });

        res.json({ success: true, message: 'API key added successfully' });
    } catch (error) {
        logger.error('Failed to add API key:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update API key
router.put('/keys/:account', async (req, res) => {
    const { kisApiService, logger, discordService } = req.app.locals;
    const { account } = req.params;
    const { appKey, appSecret, accountNumber, isMock } = req.body;
    
    try {
        if (!kisApiService.apiKeys[account]) {
            return res.status(404).json({ 
                success: false, 
                error: 'Account not found' 
            });
        }

        kisApiService.addApiKey(account, appKey, appSecret, accountNumber, isMock);
        
        await discordService.sendNotification({
            title: 'API Key Updated',
            color: 0x3498db,
            fields: [
                { name: 'Account', value: account, inline: true },
                { name: 'Account Number', value: accountNumber, inline: true },
                { name: 'Mode', value: isMock ? 'Mock' : 'Real', inline: true }
            ]
        });

        res.json({ success: true, message: 'API key updated successfully' });
    } catch (error) {
        logger.error('Failed to update API key:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete API key
router.delete('/keys/:account', async (req, res) => {
    const { kisApiService, logger, discordService } = req.app.locals;
    const { account } = req.params;
    
    try {
        if (!kisApiService.apiKeys[account]) {
            return res.status(404).json({ 
                success: false, 
                error: 'Account not found' 
            });
        }

        kisApiService.removeApiKey(account);
        
        await discordService.sendNotification({
            title: 'API Key Removed',
            color: 0xff0000,
            fields: [
                { name: 'Account', value: account, inline: true }
            ]
        });

        res.json({ success: true, message: 'API key removed successfully' });
    } catch (error) {
        logger.error('Failed to remove API key:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get account balance
router.get('/balance/:account', async (req, res) => {
    const { kisApiService, logger } = req.app.locals;
    const { account } = req.params;
    
    try {
        const balance = await kisApiService.getBalance(account);
        res.json({ success: true, balance });
    } catch (error) {
        logger.error('Failed to get balance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all accounts summary
router.get('/summary', async (req, res) => {
    const { tradingService, logger } = req.app.locals;
    
    try {
        const summary = await tradingService.getAllAccountsSummary();
        res.json({ success: true, summary });
    } catch (error) {
        logger.error('Failed to get accounts summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current price
router.get('/price/:symbol', async (req, res) => {
    const { kisApiService, logger } = req.app.locals;
    const { symbol } = req.params;
    
    try {
        const price = await kisApiService.getCurrentPrice(symbol);
        res.json({ success: true, price });
    } catch (error) {
        logger.error('Failed to get price:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manual order placement
router.post('/order', async (req, res) => {
    const { tradingService, logger } = req.app.locals;
    
    try {
        const result = await tradingService.processOrder(req.body);
        res.json({ success: true, result });
    } catch (error) {
        logger.error('Manual order failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;