import express, { Router } from 'express';

const app = express();

const apiRouter = Router();
const userRouter = Router();

function getUsers(req, res) {
  res.json({ users: [] });
}

function getUser(req, res) {
  res.json({ user: {} });
}

userRouter.get('/', getUsers);
userRouter.get('/:id', getUser);

apiRouter.use('/users', userRouter);
app.use('/api/v1', apiRouter);

app.listen(3000);
