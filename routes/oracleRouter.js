const router = require("express").Router();

const { setPrice } = require("../controllers/oracleController");

router.post("/set-price", setPrice);
