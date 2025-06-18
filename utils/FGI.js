const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function fetchFearGreedIndex() {
  try {
    const response = await axios.get('https://fear-and-greed-index.p.rapidapi.com/v1/fgi', {
      headers: {
        'x-rapidapi-host': 'fear-and-greed-index.p.rapidapi.com',
        'x-rapidapi-key': process.env.FGI_INDEX,
      },
    });

    const nowIndex = response.data.fgi.now;

    // console.log(`Current Fear & Greed Index: ${nowIndex} (${nowLabel})`);
    console.log(nowIndex);
    return nowIndex;
  } catch (error) {
    console.error('Failed to fetch Fear & Greed Index:', error);
  }
}

module.exports = {
    fetchFearGreedIndex,
};
