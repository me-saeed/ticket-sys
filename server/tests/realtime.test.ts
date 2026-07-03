import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setIo } from '../src/realtime.js';

let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let clientSocket: ClientSocket;
let port: number;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const app = createApp();
  httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: true } });
  setIo(io);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      resolve();
    });
  });

  clientSocket = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  await new Promise<void>((resolve) => clientSocket.on('connect', () => resolve()));
});

afterAll(async () => {
  clientSocket.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('Socket.IO live updates', () => {
  it('broadcasts ticket:created after POST /api/tickets', async () => {
    const event = new Promise<unknown>((resolve) => {
      clientSocket.once('ticket:created', resolve);
    });

    const res = await request(`http://127.0.0.1:${port}`)
      .post('/api/tickets')
      .send({
        title: 'Live create test',
        description: 'Socket should notify listeners.',
        customerName: 'Socket User',
        customerEmail: 'socket@example.com',
        priority: 'low',
      });

    expect(res.status).toBe(201);
    const payload = await event;
    expect(payload).toEqual({
      ticket: expect.objectContaining({ id: res.body.id, title: 'Live create test' }),
    });
  });
});
