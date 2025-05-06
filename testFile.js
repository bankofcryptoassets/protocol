const axios = require("axios");

const getUSDRate = async(amount) => {
    const url = `https://priceserver-qrwzxck8.b4a.run/coins/price-convert?amount=${amount}&symbol=USD&convert=BTC`
        try {
            const response = await axios.get(url);
            console.log(response.data.convertedPrice);
            return response.data.convertedPrice;
        } catch (error) {
            console.error(error.message);
        }
    }
getUSDRate(100000)
