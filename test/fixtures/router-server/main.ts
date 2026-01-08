import express, { Router } from 'express';

const app = express();

const userRouter = Router();

function getUsers(req, res) {
  res.json({ users: [] });
}

function createUser(req, res) {
  res.json({ created: true });
}

function getUser(req, res) {
  res.json({ user: {} });
}

userRouter.get('/', getUsers);
userRouter.post('/', createUser);
userRouter.get('/:id', getUser);

app.use('/api/users', userRouter);

app.listen(3000);
