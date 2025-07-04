const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class KisApiService {
    constructor(logger) {
        this.logger = logger;
        this.apiKeys = this.loadApiKeys();
        this.baseUrl = 'https://openapi.koreainvestment.com:9443';
        this.mockUrl = 'https://openapivts.koreainvestment.com:29443';
        this.tokens = {};
    }

    loadApiKeys() {
        try {
            const keysPath = path.join(__dirname, '../data/apikeys.json');
            if (fs.existsSync(keysPath)) {
                return JSON.parse(fs.readFileSync(keysPath, 'utf8'));
            }
            return {};
        } catch (error) {
            this.logger.error('Failed to load API keys:', error);
            return {};
        }
    }

    saveApiKeys() {
        try {
            const keysPath = path.join(__dirname, '../data/apikeys.json');
            fs.writeFileSync(keysPath, JSON.stringify(this.apiKeys, null, 2));
        } catch (error) {
            this.logger.error('Failed to save API keys:', error);
        }
    }

    addApiKey(account, appKey, appSecret, accountNumber, isMock = false) {
        this.apiKeys[account] = {
            appKey,
            appSecret,
            accountNumber,
            isMock,
            createdAt: new Date().toISOString()
        };
        this.saveApiKeys();
        this.logger.info(`API key added for account: ${account}`);
    }

    removeApiKey(account) {
        delete this.apiKeys[account];
        delete this.tokens[account];
        this.saveApiKeys();
        this.logger.info(`API key removed for account: ${account}`);
    }

    async getAccessToken(account) {
        const apiKey = this.apiKeys[account];
        if (!apiKey) {
            throw new Error(`No API key found for account: ${account}`);
        }

        const url = `${apiKey.isMock ? this.mockUrl : this.baseUrl}/oauth2/tokenP`;
        
        try {
            const response = await axios.post(url, {
                grant_type: 'client_credentials',
                appkey: apiKey.appKey,
                appsecret: apiKey.appSecret
            });

            this.tokens[account] = {
                token: response.data.access_token,
                expiresAt: Date.now() + (response.data.expires_in * 1000)
            };

            return response.data.access_token;
        } catch (error) {
            this.logger.error('Failed to get access token:', error);
            throw error;
        }
    }

    async getToken(account) {
        if (this.tokens[account] && this.tokens[account].expiresAt > Date.now()) {
            return this.tokens[account].token;
        }
        return await this.getAccessToken(account);
    }

    generateTrId(isBuy, isMock) {
        if (isMock) {
            return isBuy ? 'VTTC0011U' : 'VTTC0012U';
        }
        return isBuy ? 'TTTC0011U' : 'TTTC0012U';
    }

    // Place order (buy/sell)
    async placeOrder(account, orderData) {
        const apiKey = this.apiKeys[account];
        if (!apiKey) {
            throw new Error(`No API key found for account: ${account}`);
        }

        const token = await this.getToken(account);
        const url = `${apiKey.isMock ? this.mockUrl : this.baseUrl}/uapi/domestic-stock/v1/trading/order-cash`;
        
        const isBuy = orderData.action.toLowerCase() === 'buy';
        const trId = this.generateTrId(isBuy, apiKey.isMock);

        const headers = {
            'content-type': 'application/json; charset=utf-8',
            'authorization': `Bearer ${token}`,
            'appkey': apiKey.appKey,
            'appsecret': apiKey.appSecret,
            'tr_id': trId,
            'custtype': 'P'
        };

        const body = {
            CANO: apiKey.accountNumber.substring(0, 8),
            ACNT_PRDT_CD: apiKey.accountNumber.substring(8),
            PDNO: orderData.symbol,
            ORD_DVSN: '01', // Market order
            ORD_QTY: orderData.contracts.toString(),
            ORD_UNPR: '0'
        };

        try {
            this.logger.info(`Placing ${orderData.action} order`, { account, orderData, body });
            const response = await axios.post(url, body, { headers });
            
            if (response.data.rt_cd === '0') {
                return {
                    success: true,
                    orderId: response.data.output.ODNO,
                    message: response.data.msg1
                };
            } else {
                throw new Error(response.data.msg1);
            }
        } catch (error) {
            this.logger.error('Order placement failed:', error);
            throw error;
        }
    }

    // Get account balance
    async getBalance(account) {
        const apiKey = this.apiKeys[account];
        if (!apiKey) {
            throw new Error(`No API key found for account: ${account}`);
        }

        const token = await this.getToken(account);
        const url = `${apiKey.isMock ? this.mockUrl : this.baseUrl}/uapi/domestic-stock/v1/trading/inquire-balance`;
        
        const headers = {
            'content-type': 'application/json; charset=utf-8',
            'authorization': `Bearer ${token}`,
            'appkey': apiKey.appKey,
            'appsecret': apiKey.appSecret,
            'tr_id': apiKey.isMock ? 'VTTC8434R' : 'TTTC8434R'
        };

        const params = {
            CANO: apiKey.accountNumber.substring(0, 8),
            ACNT_PRDT_CD: apiKey.accountNumber.substring(8),
            AFHR_FLPR_YN: 'N',
            OFL_YN: '',
            INQR_DVSN: '02',
            UNPR_DVSN: '01',
            FUND_STTL_ICLD_YN: 'Y',
            FNCG_AMT_AUTO_RDPT_YN: 'N',
            PRCS_DVSN: '01',
            CTX_AREA_FK100: '',
            CTX_AREA_NK100: ''
        };

        try {
            const response = await axios.get(url, { headers, params });
            
            if (response.data.rt_cd === '0') {
                const output = response.data.output1[0];
                return {
                    totalAsset: output.samt,
                    deposit: output.dnca_tot_amt,
                    totalBuy: output.thdt_buy_amt,
                    totalEval: output.tot_evlu_amt,
                    profitLoss: output.evlu_pfls_smtl_amt,
                    profitRate: output.evlu_pfls_rt
                };
            } else {
                throw new Error(response.data.msg1);
            }
        } catch (error) {
            this.logger.error('Failed to get balance:', error);
            throw error;
        }
    }

    // Get account info for a specific stock
    async getAccountBalance(account) {
        const apiKey = this.apiKeys[account];
        if (!apiKey) {
            throw new Error(`No API key found for account: ${account}`);
        }

        const token = await this.getToken(account);
        const url = `${apiKey.isMock ? this.mockUrl : this.baseUrl}/uapi/domestic-stock/v1/trading/inquire-account-balance`;
        
        const headers = {
            'authorization': `Bearer ${token}`,
            'appkey': apiKey.appKey,
            'appsecret': apiKey.appSecret,
            'tr_id': 'CTRP6548R'
        };

        const params = {
            CANO: apiKey.accountNumber.substring(0, 8),
            ACNT_PRDT_CD: apiKey.accountNumber.substring(8),
            INQR_DVSN_1: '',
            BSPR_BF_DT_APLY_YN: 'Y'
        };

        try {
            const response = await axios.get(url, { headers, params });
            return response.data;
        } catch (error) {
            this.logger.error('Failed to get account balance:', error);
            throw error;
        }
    }

    // Get current price
    async getCurrentPrice(symbol) {
        // For simplicity, using the first available account's credentials
        const accounts = Object.keys(this.apiKeys);
        if (accounts.length === 0) {
            throw new Error('No API keys configured');
        }

        const account = accounts[0];
        const apiKey = this.apiKeys[account];
        const token = await this.getToken(account);
        
        const url = `${apiKey.isMock ? this.mockUrl : this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`;
        
        const headers = {
            'authorization': `Bearer ${token}`,
            'appkey': apiKey.appKey,
            'appsecret': apiKey.appSecret,
            'tr_id': 'FHKST01010100'
        };

        const params = {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: symbol
        };

        try {
            const response = await axios.get(url, { headers, params });
            if (response.data.rt_cd === '0') {
                const output = response.data.output;
                return {
                    currentPrice: output.stck_prpr,
                    changeRate: output.prdy_ctrt,
                    volume: output.acml_vol
                };
            }
        } catch (error) {
            this.logger.error('Failed to get current price:', error);
            throw error;
        }
    }
}

module.exports = KisApiService;