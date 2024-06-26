// import midelware authorization
const authorization = require("../midelware/authorization");

// controler carts
const controlerCarts = require('../controler/carts')

const router = require("express").Router();

router.get('/list', authorization, controlerCarts.getCarts)
router.post('/create', authorization, controlerCarts.createCarts)
router.put('/update/:id', authorization, controlerCarts.updateCart)
router.delete('/delete/:id', authorization, controlerCarts.deleteCarts)

module.exports = router