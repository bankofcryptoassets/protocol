const router = require("express").Router();

const { isLoggedIn } = require("../controllers/authController");
const { socialsShare } = require("../controllers/socialsController")

router.post("/share", isLoggedIn, socialsShare);

module.exports = router;