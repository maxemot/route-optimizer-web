const { createServer } = require("http");
const { Server } = require("socket.io");
const Client = require("socket.io-client");
const { kv } = require('@vercel/kv');
const server = require("../server"); // Импортируем наш основной сервер

jest.mock('@vercel/kv');

describe("WebSocket-based event handling", () => {
  let io, clientSocket, testServer;

  beforeAll((done) => {
    // Для WebSocket тестов нам нужен контроль над сервером
    testServer = server.listen(() => {
        const port = testServer.address().port;
        clientSocket = new Client(`http://localhost:${port}`);
        clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    testServer.close();
    clientSocket.close();
  });

  beforeEach(async () => {
    kv.__clearStore();
    jest.clearAllMocks();
  });

  test("должен удалять доставки по событию 'delete_deliveries'", (done) => {
    const idsToDelete = ["Д-0001", "Д-0002"];
    kv.set('deliveries', [
        { id: 1, address: "Test 1" },
        { id: 2, address: "Test 2" },
        { id: 3, address: "Test 3" }
    ]);
    
    clientSocket.on('deliveries_deleted', async (deletedIds) => {
        expect(deletedIds).toEqual(idsToDelete);
        const deliveries = await kv.get('deliveries');
        expect(deliveries.length).toBe(1);
        clientSocket.off('deliveries_deleted');
        done();
    });
    
    clientSocket.emit("delete_deliveries", idsToDelete);
  });
  
}); 