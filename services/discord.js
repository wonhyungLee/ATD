const axios = require('axios');

class DiscordService {
    constructor(logger) {
        this.logger = logger;
        this.webhookUrl = 'https://discord.com/api/webhooks/1285380737243025460/hq7ADjGVHMK0aZe_XF4YNkPLFmwibtkEMGLT3oC9TxUcyuCS_5aCA9Ypp3yzSUb6z_5R';
    }

    async sendNotification(embed) {
        try {
            const message = {
                embeds: [{
                    title: embed.title,
                    color: embed.color || 0x0099ff,
                    fields: embed.fields || [],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'ATD Auto Trading System'
                    }
                }]
            };

            await axios.post(this.webhookUrl, message);
            this.logger.info('Discord notification sent', { title: embed.title });
        } catch (error) {
            this.logger.error('Discord notification error:', error);
        }
    }

    async sendError(title, error) {
        try {
            const errorMessage = {
                embeds: [{
                    title: `Error: ${title}`,
                    color: 0xff0000,
                    fields: [
                        {
                            name: 'Error Message',
                            value: error.message || 'Unknown error',
                            inline: false
                        },
                        {
                            name: 'Error Type',
                            value: error.name || 'Error',
                            inline: true
                        },
                        {
                            name: 'Timestamp',
                            value: new Date().toLocaleString(),
                            inline: true
                        }
                    ],
                    description: error.stack ? `\`\`\`${error.stack.substring(0, 1000)}\`\`\`` : 'No stack trace available',
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'ATD Error Handler'
                    }
                }]
            };

            await axios.post(this.webhookUrl, errorMessage);
            this.logger.error('Error notification sent to Discord');
        } catch (discordError) {
            this.logger.error('Failed to send error to Discord:', discordError);
        }
    }

    async sendOrderResult(orderData, result) {
        try {
            const color = result.success ? 0x00ff00 : 0xff0000;
            const status = result.success ? 'Success' : 'Failed';

            const message = {
                embeds: [{
                    title: `Order ${status}: ${orderData.action} ${orderData.symbol}`,
                    color: color,
                    fields: [
                        {
                            name: 'Symbol',
                            value: orderData.symbol,
                            inline: true
                        },
                        {
                            name: 'Action',
                            value: orderData.action.toUpperCase(),
                            inline: true
                        },
                        {
                            name: 'Quantity',
                            value: orderData.contracts,
                            inline: true
                        },
                        {
                            name: 'Price',
                            value: orderData.price,
                            inline: true
                        },
                        {
                            name: 'Order ID',
                            value: result.orderId || 'N/A',
                            inline: true
                        },
                        {
                            name: 'Message',
                            value: result.message || 'Order processed',
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: `ATD | Account: ${orderData.account || 'default'}`
                    }
                }]
            };

            await axios.post(this.webhookUrl, message);
        } catch (error) {
            this.logger.error('Failed to send order result to Discord:', error);
        }
    }

    async sendBalanceUpdate(balanceData) {
        try {
            const fields = Object.entries(balanceData).map(([key, value]) => ({
                name: key,
                value: value.toString(),
                inline: true
            }));

            const message = {
                embeds: [{
                    title: 'Account Balance Update',
                    color: 0x3498db,
                    fields: fields,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'ATD Balance Monitor'
                    }
                }]
            };

            await axios.post(this.webhookUrl, message);
        } catch (error) {
            this.logger.error('Failed to send balance update to Discord:', error);
        }
    }
}

module.exports = DiscordService;