import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
    //🔴Imp point-> you can define import name like this, but only when you have exported the file in { } export

const router = Router()

router.route("/register").post(registerUser)
//http://localhost:8000/users/register

//router.route("/login").post(loginUser)
//http://localhost:8000/users/login


export default router