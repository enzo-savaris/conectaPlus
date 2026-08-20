import { Router } from 'express';
import { login } from '../controller/auth.controller.ts';

const rotasAuth = Router();

rotasAuth.post('/login', login);

export default rotasAuth;
