const ethers = require("ethers");
const { contract } = require("../constants");

const fetchDetails = async (url, authKey, token) => {
  const response = await fetch(`${url}/v1/prices/latest?assets=${token}`, {
    headers: {
      Authorization: `Basic ${authKey}`,
    },
  });

  console.log("Response", response);

  const rawJson = await response.text();
  const safeJsonText = rawJson.replace(
    /(?<!["\d])\b\d{16,}\b(?!["])/g, // Regex to find large integers not already in quotes
    (match) => `"${match}"`, // Convert large numbers to strings
  );

  const responseData = JSON.parse(safeJsonText);

  return Object.keys(responseData.data).map((key) => {
    const data = responseData.data[key];

    return {
      temporalNumericValue: {
        timestampNs: data.stork_signed_price.timestamped_signature.timestamp,
        quantizedValue: data.stork_signed_price.price,
      },
      id: data.stork_signed_price.encoded_asset_id,
      publisherMerkleRoot: data.stork_signed_price.publisher_merkle_root,
      valueComputeAlgHash:
        "0x" + data.stork_signed_price.calculation_alg.checksum,
      r: data.stork_signed_price.timestamped_signature.signature.r,
      s: data.stork_signed_price.timestamped_signature.signature.s,
      v: data.stork_signed_price.timestamped_signature.signature.v,
    };
  });
};

async function setOraclePrice() {
  const url = `https://rest.jp.stork-oracle.network`;
  const headers = {
    Authorization: "c2hyZXlhczpzaW5rLXJlY2Vzcy10ZXJyaWZ5LW9hdG1lYWw=",
  };
  const tokens = ["ETHUSD", "BTCUSD"];

  try {
    const result = [];
    // for (const token of tokens) {
    const results = await fetchDetails(url, headers.Authorization, tokens[1]);
    result.push(results);
    // }

    console.log("Fetched data:", result);

    // call orcale contract
    await attestData(result[0]);
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }
}

async function attestData(verifyData) {
  const wbtc = "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93";
  const storkPubKey = "0x0a803F9b1CCe32e2773e0d2e98b37E0775cA5d44";

  const verify = verifyData[0];
  console.log("Fetched data:", verify);

  const tx = await contract.setPrice(
    wbtc,
    storkPubKey,
    verify.id,
    verify.temporalNumericValue.timestampNs,
    verify.temporalNumericValue.quantizedValue,
    verify.publisherMerkleRoot,
    verify.valueComputeAlgHash,
    verify.r,
    verify.s,
    verify.v,
  );

  console.log("Transaction Hash", tx);

  const price = await contract.getPrice(wbtc);
  console.log("Price", ethers.formatUnits(price, 18));
}

module.exports = {
  setOraclePrice,
};
