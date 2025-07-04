class TradingService {
    constructor(logger, kisApiService, discordService) {
        this.logger = logger;
        this.kisApi = kisApiService;
        this.discord = discordService;
    }

    async processOrder(orderData) {
        try {
            // Validate order data
            if (!orderData.symbol || !orderData.action || !orderData.contracts) {
                throw new Error('Invalid order data: missing required fields');
            }

            // Default account if not specified
            const account = orderData.account || 'default';

            this.logger.info('Processing order', { account, orderData });

            // Check if account exists
            if (!this.kisApi.apiKeys[account]) {
                throw new Error(`Account not found: ${account}`);
            }

            // Get current balance before order
            let balanceBefore;
            try {
                balanceBefore = await this.kisApi.getBalance(account);
                await this.discord.sendBalanceUpdate({
                    'Status': 'Before Order',
                    'Total Asset': balanceBefore.totalAsset,
                    'Deposit': balanceBefore.deposit,
                    'P&L': balanceBefore.profitLoss,
                    'P&L Rate': `${balanceBefore.profitRate}%`
                });
            } catch (error) {
                this.logger.warn('Failed to get balance before order:', error);
            }

            // Place order
            const result = await this.kisApi.placeOrder(account, orderData);

            // Send order result to Discord
            await this.discord.sendOrderResult(orderData, result);

            // Get balance after order (with delay)
            setTimeout(async () => {
                try {
                    const balanceAfter = await this.kisApi.getBalance(account);
                    await this.discord.sendBalanceUpdate({
                        'Status': 'After Order',
                        'Total Asset': balanceAfter.totalAsset,
                        'Deposit': balanceAfter.deposit,
                        'P&L': balanceAfter.profitLoss,
                        'P&L Rate': `${balanceAfter.profitRate}%`
                    });
                } catch (error) {
                    this.logger.warn('Failed to get balance after order:', error);
                }
            }, 5000);

            return result;
        } catch (error) {
            this.logger.error('Order processing error:', error);
            await this.discord.sendError('Order Processing Failed', error);
            throw error;
        }
    }

    async getAccountSummary(account) {
        try {
            const balance = await this.kisApi.getBalance(account);
            const accountInfo = await this.kisApi.getAccountBalance(account);
            
            return {
                balance,
                positions: accountInfo.output1 || []
            };
        } catch (error) {
            this.logger.error('Failed to get account summary:', error);
            throw error;
        }
    }

    async getAllAccountsSummary() {
        const summaries = {};
        
        for (const account of Object.keys(this.kisApi.apiKeys)) {
            try {
                summaries[account] = await this.getAccountSummary(account);
            } catch (error) {
                summaries[account] = { error: error.message };
            }
        }
        
        return summaries;
    }

    // Validate webhook data from TradingView
    validateWebhookData(data) {
        const required = ['symbol', 'action', 'contracts'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validate action
        if (!['buy', 'sell'].includes(data.action.toLowerCase())) {
            throw new Error(`Invalid action: ${data.action}. Must be 'buy' or 'sell'`);
        }

        // Validate contracts
        const contracts = parseInt(data.contracts);
        if (isNaN(contracts) || contracts <= 0) {
            throw new Error(`Invalid contracts: ${data.contracts}. Must be a positive number`);
        }

        return true;
    }

    // Process bulk orders
    async processBulkOrders(orders) {
        const results = [];
        
        for (const order of orders) {
            try {
                const result = await this.processOrder(order);
                results.push({ order, result, success: true });
            } catch (error) {
                results.push({ order, error: error.message, success: false });
            }
        }
        
        return results;
    }
}

module.exports = TradingService;