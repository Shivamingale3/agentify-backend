import { Router } from 'express';
import authController from '../controller/auth.controller';

const authRouter = Router();
authRouter.post('/register', authController.register.bind(authController));
export default authRouter;
