const { getAllUsers, getUserById, updateUser } = require("../controllers/userController");
const { isLoggedIn } = require("../controllers/authController");

const router = require("express").Router();

router.get("/", isLoggedIn, getUserById);
router.patch("/:id", isLoggedIn, updateUser);
router.get("/admin", isLoggedIn, getAllUsers);

module.exports = router;
