const axios = require('axios');
const crypto = require('crypto');

class DeribitService {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://test.deribit.com/api/v2';
  }

  generateSignature(timestamp, method, path, params = {}) {
    const data = timestamp + method + path + (Object.keys(params).length ? JSON.stringify(params) : '');
    return crypto.createHmac('sha256', this.apiSecret).update(data).digest('hex');
  }

  async request(method, path, params = {}) {
    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp, method, path, params);
    const basicAuth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        },
        data: method === 'GET' ? undefined : {
          params,
          method: path,
          jsonrpc: '2.0',
          id: 1
        },
        params: method === 'GET' ? params : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Deribit API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOptionPrice(instrumentName) {
    return this.request('GET', '/public/get_instrument', { instrument_name: instrumentName });
  }

  async buyPutOption(instrumentName, amount) {
    return this.request('POST', '/private/buy', {
      
      instrument_name: instrumentName,
      amount: amount,
      type: 'market',
      otoco_config:[]
    });
  }

  async listApikeys() {
    return this.request('GET', '/private/list_api_keys');
  }

  async sellPutOption(instrumentName, amount, price) {
    return this.request('POST', '/private/sell', {
      instrument_name: instrumentName,
      amount: amount,
      type: 'market',
      otoco_config:[]
    });
  }

  async getPosition(instrumentName) {
    return this.request('GET', '/private/get_position', { instrument_name: instrumentName });
  }

  async getAccountSummary(currency = 'BTC') {
    return this.request('GET', '/private/get_account_summary', { currency });
  }

  async getInstruments(currency = 'BTC', kind = 'option', expired = false) {
    return this.request('GET', '/public/get_instruments', {
      currency,
      kind,
      expired
    });
  }

  async getOptionChain(currency = 'BTC', kind = 'put') {
    return this.request('GET', '/public/get_book_summary_by_currency', {
      currency,
      kind
    });
  }
}

module.exports = DeribitService; 