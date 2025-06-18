// write a function to get rate of cBTC <-> USDT

const axios = require("axios");

const getBTCRate = async (amount) => {
  const url = `https://priceserver-qrwzxck8.b4a.run/coins/price-convert?amount=${amount}&symbol=cbBTC&convert=USD`;
  try {
    const response = await axios.get(url);
    console.log("BTC Price",response.data.convertedPrice);
    return response.data.convertedPrice;
  } catch (error) {
    console.error(error.message);
  }
};

const getUSDRate = async (amount) => {
  const url = `https://priceserver-qrwzxck8.b4a.run/coins/price-convert?amount=${amount}&symbol=USD&convert=BTC`;
  try {
    const response = await axios.get(url);
    console.log(response.data.convertedPrice);
    return response.data.convertedPrice;
  } catch (error) {
    console.error(error.message);
  }
};

module.exports = { getBTCRate, getUSDRate };
