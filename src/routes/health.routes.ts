import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
  });
});
export default healthRouter;
