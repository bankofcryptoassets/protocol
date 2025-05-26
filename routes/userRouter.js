const {
  getAllUsers,
  getUserById,
  updateUser,
  getUserDashboard,
} = require("../controllers/userController");
const { isLoggedIn } = require("../controllers/authController");

const router = require("express").Router();

router.get("/", isLoggedIn, getUserById);
router.patch("/:id", isLoggedIn, updateUser);
router.get("/admin", isLoggedIn, getAllUsers);
router.get("/dashboard", isLoggedIn, getUserDashboard);

module.exports = router;
