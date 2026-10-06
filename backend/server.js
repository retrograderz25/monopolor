const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

const port = Number(process.env.PORT || 3001);

const rawFrontendUrl = String(process.env.FRONTEND_URL || '').trim();
const allowedOrigins = rawFrontendUrl
    ? rawFrontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['*'];

const corsOptions = {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
};

const server = http.createServer(app);

// Socket.IO uses its own Engine.IO handshake. Keep the configuration simple
// and let Socket.IO use its default polling -> WebSocket upgrade flow.
const io = new Server(server, {
    cors: corsOptions,
    pingInterval: 25000,
    pingTimeout: 20000,
});

app.use(cors(corsOptions));

app.get('/', (_req, res) => {
    res.json({
        name: 'Monopoly Vietnam Backend',
        status: 'ok',
        realtime: 'socket.io',
    });
});

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        rooms: Object.keys(gameRooms).length,
    });
});


io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection_error', {
        code: err.code,
        message: err.message,
        url: err.req?.url,
        origin: err.req?.headers?.origin,
        transport: err.req?.headers?.['sec-websocket-protocol'] || err.req?.headers?.upgrade,
    });
});


// ------------------------------------------------------------
// BOARD
// ------------------------------------------------------------

function getStandardMonopolyBoard() {
    return [
        { id: 0, name: 'GO (Bắt đầu)', type: 'GO' },
        { id: 1, name: 'Hàng Bài', type: 'PROPERTY', group: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], housePrice: 50, owner: null, houses: 0, isMortgaged: false },
        { id: 2, name: 'Khí Vận (Chest)', type: 'CHEST' },
        { id: 3, name: 'Bạch Mai', type: 'PROPERTY', group: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], housePrice: 50, owner: null, houses: 0, isMortgaged: false },
        { id: 4, name: 'Thuế Thu Nhập', type: 'TAX', amount: 200 },
        { id: 5, name: 'Ga Hà Nội', type: 'RAILROAD', group: 'railroad', price: 200, rent: [25, 50, 100, 200], owner: null, isMortgaged: false },
        { id: 6, name: 'Tràng Tiền', type: 'PROPERTY', group: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], housePrice: 50, owner: null, houses: 0, isMortgaged: false },
        { id: 7, name: 'Cơ Hội (Chance)', type: 'CHANCE' },
        { id: 8, name: 'Đinh Tiên Hoàng', type: 'PROPERTY', group: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], housePrice: 50, owner: null, houses: 0, isMortgaged: false },
        { id: 9, name: 'Bà Triệu', type: 'PROPERTY', group: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], housePrice: 50, owner: null, houses: 0, isMortgaged: false },
        { id: 10, name: 'Nhà Tù / Thăm Tù', type: 'JAIL' },
        { id: 11, name: 'Huế', type: 'PROPERTY', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 12, name: 'Cty Điện Lực', type: 'UTILITY', group: 'utility', price: 150, owner: null, isMortgaged: false },
        { id: 13, name: 'Trần Hưng Đạo', type: 'PROPERTY', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 14, name: 'Phố Huế', type: 'PROPERTY', group: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 15, name: 'Ga Đà Nẵng', type: 'RAILROAD', group: 'railroad', price: 200, owner: null, isMortgaged: false },
        { id: 16, name: 'Lê Lợi', type: 'PROPERTY', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 17, name: 'Khí Vận (Chest)', type: 'CHEST' },
        { id: 18, name: 'Nguyễn Huệ', type: 'PROPERTY', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 19, name: 'Đồng Khởi', type: 'PROPERTY', group: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], housePrice: 100, owner: null, houses: 0, isMortgaged: false },
        { id: 20, name: 'Bãi Đỗ Xe Free', type: 'FREE_PARKING' },
        { id: 21, name: 'Ngô Quyền', type: 'PROPERTY', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 22, name: 'Cơ Hội (Chance)', type: 'CHANCE' },
        { id: 23, name: 'Lý Thường Kiệt', type: 'PROPERTY', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 24, name: 'Hai Bà Trưng', type: 'PROPERTY', group: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 25, name: 'Ga Huế', type: 'RAILROAD', group: 'railroad', price: 200, owner: null, isMortgaged: false },
        { id: 26, name: 'Phan Đình Phùng', type: 'PROPERTY', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 27, name: 'Hoàng Diệu', type: 'PROPERTY', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 28, name: 'Cty Cấp Nước', type: 'UTILITY', group: 'utility', price: 150, owner: null, isMortgaged: false },
        { id: 29, name: 'Điện Biên Phủ', type: 'PROPERTY', group: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], housePrice: 150, owner: null, houses: 0, isMortgaged: false },
        { id: 30, name: 'VÀO TÙ (Go To Jail)', type: 'GO_TO_JAIL' },
        { id: 31, name: 'Hồ Con Rùa', type: 'PROPERTY', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], housePrice: 200, owner: null, houses: 0, isMortgaged: false },
        { id: 32, name: 'Bến Bạch Đằng', type: 'PROPERTY', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], housePrice: 200, owner: null, houses: 0, isMortgaged: false },
        { id: 33, name: 'Khí Vận (Chest)', type: 'CHEST' },
        { id: 34, name: 'Nguyễn Thị Minh Khai', type: 'PROPERTY', group: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], housePrice: 200, owner: null, houses: 0, isMortgaged: false },
        { id: 35, name: 'Ga Sài Gòn', type: 'RAILROAD', group: 'railroad', price: 200, owner: null, isMortgaged: false },
        { id: 36, name: 'Cơ Hội (Chance)', type: 'CHANCE' },
        { id: 37, name: 'Bến Vân Đồn', type: 'PROPERTY', group: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], housePrice: 200, owner: null, houses: 0, isMortgaged: false },
        { id: 38, name: 'Thuế Xa Xỉ', type: 'TAX', amount: 100 },
        { id: 39, name: 'Vincom Landmark 81', type: 'PROPERTY', group: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], housePrice: 200, owner: null, houses: 0, isMortgaged: false },
    ];
}

// ------------------------------------------------------------
// CARDS
// ------------------------------------------------------------

const chanceCards = [
    { text: 'Tiến thẳng đến ô Bắt Đầu, nhận $200.', action: (p) => { p.position = 0; p.money += 200; } },
    { text: 'Bị cảnh sát bắt. Vào tù ngay lập tức!', action: (p) => { p.position = 10; p.inJail = true; } },
    { text: 'Vi phạm tốc độ. Phạt $15.', action: (p) => { p.money -= 15; } },
    { text: 'Đi thẳng đến Landmark 81.', action: (p) => { p.position = 39; } },
    { text: 'Lùi lại 3 bước.', action: (p) => { p.position = (p.position - 3 + 40) % 40; } },
];

const chestCards = [
    { text: 'Lỗi ngân hàng, bạn được nhận $200.', action: (p) => { p.money += 200; } },
    { text: 'Thanh toán viện phí. Trừ $50.', action: (p) => { p.money -= 50; } },
    { text: 'Trúng giải thưởng nhỏ. Nhận $10.', action: (p) => { p.money += 10; } },
    { text: 'Đóng quỹ từ thiện. Trừ $100.', action: (p) => { p.money -= 100; } },
    { text: 'Tiền bảo hiểm đáo hạn. Nhận $50.', action: (p) => { p.money += 50; } },
];

const gameRooms = {};

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function calculateRent(board, cell, diceTotal) {
    if (cell.isMortgaged) return 0;

    if (cell.type === 'PROPERTY') {
        if (cell.houses > 0) return cell.rent[cell.houses];

        const sameGroup = board.filter((c) => c.group === cell.group);
        const hasMonopoly = sameGroup.every((c) => c.owner === cell.owner);
        return hasMonopoly ? cell.rent[0] * 2 : cell.rent[0];
    }

    if (cell.type === 'RAILROAD') {
        const count = board.filter(
            (c) => c.type === 'RAILROAD' && c.owner === cell.owner && !c.isMortgaged
        ).length;
        return 25 * Math.pow(2, Math.max(0, count - 1));
    }

    if (cell.type === 'UTILITY') {
        const count = board.filter(
            (c) => c.type === 'UTILITY' && c.owner === cell.owner && !c.isMortgaged
        ).length;
        return count === 2 ? diceTotal * 10 : diceTotal * 4;
    }

    return 0;
}

function checkBankruptcy(room, player) {
    if (player.money < 0 && !player.bankrupt) {
        room.pendingAction = {
            type: 'DEBT',
            amount: Math.abs(player.money),
        };
    } else if (player.money >= 0 && room.pendingAction?.type === 'DEBT') {
        room.pendingAction = null;
    }
}

function broadcastState(roomId, room) {
    io.to(roomId).emit('UPDATE_STATE', room);
}

// ------------------------------------------------------------
// SOCKETS
// ------------------------------------------------------------

io.on('connection', (socket) => {
    socket.on('JOIN_ROOM', ({ roomId, playerId, playerName }) => {
        const normalizedRoomId = String(roomId || 'ROOM_1').trim() || 'ROOM_1';
        const normalizedPlayerName = String(playerName || '').trim().slice(0, 24);
        const normalizedPlayerId = String(playerId || '').trim();

        if (!normalizedPlayerId || !normalizedPlayerName) {
            return socket.emit('ERROR', 'Thiếu thông tin người chơi.');
        }

        if (!gameRooms[normalizedRoomId]) {
            gameRooms[normalizedRoomId] = {
                id: normalizedRoomId,
                status: 'WAITING',
                players: [],
                board: getStandardMonopolyBoard(),
                currentTurnIndex: 0,
                doublesCount: 0,
                hasRolled: false,
                pendingAction: null,
                trades: [],
                chanceDeck: shuffle([...chanceCards]),
                chestDeck: shuffle([...chestCards]),
            };
        }

        const room = gameRooms[normalizedRoomId];
        let player = room.players.find((p) => p.playerId === normalizedPlayerId);

        if (player) {
            player.socketId = socket.id;
            player.disconnected = false;
            socket.join(normalizedRoomId);
            io.to(normalizedRoomId).emit('MESSAGE', `🟢 ${player.name} đã kết nối lại.`);
        } else {
            if (room.status === 'PLAYING') {
                return socket.emit('ERROR', 'Trận đấu đã bắt đầu, không thể tham gia!');
            }

            if (room.players.length >= 6) {
                return socket.emit('ERROR', 'Phòng đã đủ 6 người!');
            }

            player = {
                playerId: normalizedPlayerId,
                socketId: socket.id,
                name: normalizedPlayerName,
                money: 1500,
                position: 0,
                inJail: false,
                jailTurns: 0,
                bankrupt: false,
                disconnected: false,
            };

            room.players.push(player);
            socket.join(normalizedRoomId);
        }

        broadcastState(normalizedRoomId, room);
    });

    socket.on('START_GAME', (roomId) => {
        const room = gameRooms[roomId];

        if (room && room.players.length >= 2) {
            room.status = 'PLAYING';
            room.hasRolled = false;
            room.pendingAction = null;

            broadcastState(roomId, room);
            io.to(roomId).emit(
                'MESSAGE',
                `🎉 Game bắt đầu! Lượt đầu tiên: ${room.players[0].name}`
            );
        }
    });

    socket.on('ROLL_DICE', (roomId) => {
        const room = gameRooms[roomId];
        if (!room || room.status !== 'PLAYING' || room.pendingAction) return;

        const player = room.players[room.currentTurnIndex];
        if (!player || player.socketId !== socket.id || player.bankrupt) return;

        if (room.hasRolled) {
            return socket.emit('ERROR', 'Bạn đã tung xúc xắc rồi! Hãy kết thúc lượt.');
        }

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const isDouble = d1 === d2;
        const diceTotal = d1 + d2;

        io.to(roomId).emit('DICE_RESULT', {
            d1,
            d2,
            isDouble,
            playerName: player.name,
        });

        // Jail handling
        if (player.inJail) {
            if (isDouble) {
                player.inJail = false;
                player.jailTurns = 0;
                room.doublesCount = 0;
                room.hasRolled = true;
                io.to(roomId).emit('MESSAGE', `🔓 ${player.name} đổ đôi và được ra tù!`);
            } else {
                player.jailTurns++;
                room.hasRolled = true;

                if (player.jailTurns >= 3) {
                    player.money -= 50;
                    player.inJail = false;
                    player.jailTurns = 0;
                    io.to(roomId).emit(
                        'MESSAGE',
                        `👮 ${player.name} hết 3 lượt ở tù, nộp phạt $50 để bước ra và di chuyển.`
                    );
                } else {
                    io.to(roomId).emit(
                        'MESSAGE',
                        `🔒 ${player.name} tung không được đôi, vẫn phải ở tù (Lượt ${player.jailTurns}/3)`
                    );
                    broadcastState(roomId, room);
                    return;
                }
            }
        }

        // Three doubles in a row
        if (isDouble && !player.inJail) {
            room.doublesCount++;

            if (room.doublesCount === 3) {
                player.position = 10;
                player.inJail = true;
                room.doublesCount = 0;
                room.hasRolled = true;

                io.to(roomId).emit(
                    'MESSAGE',
                    `🚨 ${player.name} đổ đôi 3 lần liên tiếp! Bị tống giam ngay!`
                );

                broadcastState(roomId, room);
                return;
            }

            io.to(roomId).emit(
                'MESSAGE',
                `🎲 ${player.name} đổ ĐÔI! Được quyền xúc thêm lần nữa sau hành động.`
            );
        } else {
            room.doublesCount = 0;
            room.hasRolled = true;
        }

        const oldPos = player.position;
        player.position = (oldPos + diceTotal) % 40;

        if (player.position < oldPos && !player.inJail) {
            player.money += 200;
            io.to(roomId).emit(
                'MESSAGE',
                `💵 ${player.name} đi qua vạch GO, nhận $200!`
            );
        }

        const cell = room.board[player.position];
        io.to(roomId).emit('MESSAGE', `📍 ${player.name} dẫm lên ô ${cell.name}`);

        if (cell.type === 'GO_TO_JAIL') {
            player.position = 10;
            player.inJail = true;
            room.doublesCount = 0;
            room.hasRolled = true;
        } else if (cell.type === 'TAX') {
            player.money -= cell.amount;
        } else if (cell.type === 'CHANCE' || cell.type === 'CHEST') {
            const deck = cell.type === 'CHANCE' ? room.chanceDeck : room.chestDeck;
            const card = deck.shift();
            deck.push(card);

            io.to(roomId).emit('MESSAGE', `🃏 Bốc thẻ: ${card.text}`);
            card.action(player);
        } else if (['PROPERTY', 'RAILROAD', 'UTILITY'].includes(cell.type)) {
            if (!cell.owner) {
                room.pendingAction = {
                    type: 'BUY_PROMPT',
                    cellId: cell.id,
                    price: cell.price,
                };
            } else if (cell.owner !== player.playerId && !cell.isMortgaged) {
                const rent = calculateRent(room.board, cell, diceTotal);
                const owner = room.players.find((p) => p.playerId === cell.owner);

                if (owner && !owner.inJail) {
                    player.money -= rent;
                    owner.money += rent;
                    io.to(roomId).emit(
                        'MESSAGE',
                        `💸 ${player.name} trả $${rent} tiền thuê cho ${owner.name}!`
                    );
                }
            }
        }

        checkBankruptcy(room, player);
        broadcastState(roomId, room);
    });

    socket.on('PAY_JAIL_FINE', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[room.currentTurnIndex];

        if (
            player?.socketId === socket.id &&
            player.inJail &&
            player.money >= 50 &&
            !room.hasRolled
        ) {
            player.money -= 50;
            player.inJail = false;
            player.jailTurns = 0;

            io.to(roomId).emit(
                'MESSAGE',
                `💰 ${player.name} nộp $50 tiền bảo lãnh để được tự do!`
            );

            broadcastState(roomId, room);
        }
    });

    socket.on('BUY_PROPERTY', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[room.currentTurnIndex];

        if (
            player?.socketId !== socket.id ||
            room.pendingAction?.type !== 'BUY_PROMPT'
        ) {
            return;
        }

        const cell = room.board[room.pendingAction.cellId];

        if (player.money >= cell.price) {
            player.money -= cell.price;
            cell.owner = player.playerId;
            io.to(roomId).emit(
                'MESSAGE',
                `🏘️ ${player.name} vừa mua khu đất ${cell.name}!`
            );
        } else {
            socket.emit('ERROR', 'Bạn không đủ tiền để mua tài sản này.');
        }

        room.pendingAction = null;
        broadcastState(roomId, room);
    });

    socket.on('SKIP_BUY', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[room.currentTurnIndex];

        if (
            player?.socketId === socket.id &&
            room.pendingAction?.type === 'BUY_PROMPT'
        ) {
            room.pendingAction = null;
            broadcastState(roomId, room);
        }
    });

    socket.on('BUILD_HOUSE', ({ roomId, cellId }) => {
        const room = gameRooms[roomId];
        const player = room?.players.find((p) => p.socketId === socket.id);
        const cell = room?.board[cellId];

        if (!player || !cell || cell.owner !== player.playerId || cell.type !== 'PROPERTY') {
            return;
        }

        const groupCells = room.board.filter((c) => c.group === cell.group);
        const hasMonopoly = groupCells.every(
            (c) => c.owner === player.playerId && !c.isMortgaged
        );
        const minHouses = Math.min(...groupCells.map((c) => c.houses));

        if (
            hasMonopoly &&
            player.money >= cell.housePrice &&
            cell.houses === minHouses &&
            cell.houses < 5
        ) {
            player.money -= cell.housePrice;
            cell.houses++;
            broadcastState(roomId, room);
        }
    });

    socket.on('SELL_HOUSE', ({ roomId, cellId }) => {
        const room = gameRooms[roomId];
        const player = room?.players.find((p) => p.socketId === socket.id);
        const cell = room?.board[cellId];

        if (!player || !cell || cell.owner !== player.playerId || cell.houses === 0) {
            return;
        }

        const groupCells = room.board.filter((c) => c.group === cell.group);
        const maxHouses = Math.max(...groupCells.map((c) => c.houses));

        if (cell.houses === maxHouses) {
            cell.houses--;
            player.money += cell.housePrice / 2;
            checkBankruptcy(room, player);
            broadcastState(roomId, room);
        }
    });

    socket.on('MORTGAGE', ({ roomId, cellId }) => {
        const room = gameRooms[roomId];
        const player = room?.players.find((p) => p.socketId === socket.id);
        const cell = room?.board[cellId];

        if (!player || !cell || cell.owner !== player.playerId || cell.isMortgaged) {
            return;
        }

        if (room.board.some((c) => c.group === cell.group && c.houses > 0)) {
            return socket.emit(
                'ERROR',
                'Bạn phải bán hết nhà trên cụm màu này trước khi cầm cố đất!'
            );
        }

        cell.isMortgaged = true;
        player.money += cell.price / 2;
        checkBankruptcy(room, player);
        broadcastState(roomId, room);
    });

    socket.on('UNMORTGAGE', ({ roomId, cellId }) => {
        const room = gameRooms[roomId];
        const player = room?.players.find((p) => p.socketId === socket.id);
        const cell = room?.board[cellId];

        if (!player || !cell) return;

        const cost = Math.ceil((cell.price / 2) * 1.1);

        if (
            cell.owner === player.playerId &&
            cell.isMortgaged &&
            player.money >= cost
        ) {
            player.money -= cost;
            cell.isMortgaged = false;
            broadcastState(roomId, room);
        }
    });

    socket.on(
        'PROPOSE_TRADE',
        ({ roomId, targetPlayerId, offerMoney, requestMoney, offerCells, requestCells }) => {
            const room = gameRooms[roomId];
            const sender = room?.players.find((p) => p.socketId === socket.id);

            if (!sender || sender.playerId === targetPlayerId) return;

            const normalizedOfferCells = Array.isArray(offerCells) ? offerCells : [];
            const normalizedRequestCells = Array.isArray(requestCells) ? requestCells : [];
            const safeOfferMoney = Math.max(0, Number(offerMoney) || 0);
            const safeRequestMoney = Math.max(0, Number(requestMoney) || 0);

            const target = room.players.find((p) => p.playerId === targetPlayerId);
            if (!target || target.bankrupt) {
                return socket.emit('ERROR', 'Người chơi này không còn khả dụng để trade.');
            }

            if (safeOfferMoney > sender.money) {
                return socket.emit('ERROR', 'Bạn không đủ tiền để đề nghị giao dịch này.');
            }

            if (safeRequestMoney > target.money) {
                return socket.emit('ERROR', 'Đối tác không đủ tiền để thực hiện giao dịch này.');
            }

            const offerOwnedBySender = normalizedOfferCells.every(
                (cid) => room.board[cid] && room.board[cid].owner === sender.playerId
            );
            const requestOwnedByTarget = normalizedRequestCells.every(
                (cid) => room.board[cid] && room.board[cid].owner === target.playerId
            );

            if (!offerOwnedBySender || !requestOwnedByTarget) {
                return socket.emit('ERROR', 'Có tài sản trong giao dịch không thuộc đúng người sở hữu.');
            }

            const invalidTrade = [...normalizedOfferCells, ...normalizedRequestCells].some(
                (cid) => room.board[cid].houses > 0
            );

            if (invalidTrade) {
                return socket.emit(
                    'ERROR',
                    'Không thể giao dịch đất đang có nhà, vui lòng bán nhà trước!'
                );
            }

            if (
                safeOfferMoney === 0 &&
                safeRequestMoney === 0 &&
                normalizedOfferCells.length === 0 &&
                normalizedRequestCells.length === 0
            ) {
                return socket.emit('ERROR', 'Lời mời trade đang trống.');
            }

            room.trades.push({
                id: Date.now(),
                fromId: sender.playerId,
                toId: targetPlayerId,
                offerMoney: safeOfferMoney,
                requestMoney: safeRequestMoney,
                offerCells: normalizedOfferCells,
                requestCells: normalizedRequestCells,
            });

            io.to(roomId).emit(
                'MESSAGE',
                `🤝 ${sender.name} vừa gửi lời mời giao dịch!`
            );

            broadcastState(roomId, room);
        }
    );

    socket.on('RESPOND_TRADE', ({ roomId, tradeId, accept }) => {
        const room = gameRooms[roomId];
        const tradeIndex = room?.trades.findIndex((t) => t.id === tradeId);

        if (tradeIndex === -1 || tradeIndex == null) return;

        const trade = room.trades[tradeIndex];
        const receiver = room.players.find((p) => p.socketId === socket.id);

        if (!receiver || receiver.playerId !== trade.toId) return;

        if (accept) {
            const sender = room.players.find((p) => p.playerId === trade.fromId);

            if (!sender) {
                room.trades.splice(tradeIndex, 1);
                broadcastState(roomId, room);
                return;
            }

            const senderOwnsAll = trade.offerCells.every(
                (cid) => room.board[cid]?.owner === sender.playerId && room.board[cid]?.houses === 0
            );
            const receiverOwnsAll = trade.requestCells.every(
                (cid) => room.board[cid]?.owner === receiver.playerId && room.board[cid]?.houses === 0
            );

            if (
                !senderOwnsAll ||
                !receiverOwnsAll ||
                sender.money < trade.offerMoney ||
                receiver.money < trade.requestMoney
            ) {
                socket.emit(
                    'ERROR',
                    'Tài sản hoặc số dư đã thay đổi, giao dịch không thể thực hiện.'
                );
            } else {
                sender.money = sender.money - trade.offerMoney + trade.requestMoney;
                receiver.money = receiver.money - trade.requestMoney + trade.offerMoney;

                trade.offerCells.forEach((cid) => {
                    room.board[cid].owner = receiver.playerId;
                });

                trade.requestCells.forEach((cid) => {
                    room.board[cid].owner = sender.playerId;
                });

                io.to(roomId).emit(
                    'MESSAGE',
                    `✅ Giao dịch thành công giữa ${sender.name} và ${receiver.name}!`
                );

                checkBankruptcy(room, sender);
                checkBankruptcy(room, receiver);
            }
        }

        room.trades.splice(tradeIndex, 1);
        broadcastState(roomId, room);
    });

    socket.on('DECLARE_BANKRUPTCY', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[room.currentTurnIndex];

        if (!player || player.socketId !== socket.id || player.money >= 0) return;

        player.bankrupt = true;
        room.pendingAction = null;

        room.board.forEach((cell) => {
            if (cell.owner === player.playerId) {
                cell.owner = null;
                cell.houses = 0;
                cell.isMortgaged = false;
            }
        });

        io.to(roomId).emit(
            'MESSAGE',
            `💀 ${player.name} ĐÃ PHÁ SẢN! Tài sản bị tịch thu!`
        );

        const alivePlayers = room.players.filter((p) => !p.bankrupt);

        if (alivePlayers.length === 1) {
            io.to(roomId).emit(
                'MESSAGE',
                `🏆 GAME OVER! ${alivePlayers[0].name} LÀ NHÀ TÀI PHIỆT CUỐI CÙNG!`
            );
            room.status = 'WAITING';
        }

        room.hasRolled = true;
        socket.emit('FORCE_END_TURN');
        broadcastState(roomId, room);
    });

    socket.on('END_TURN', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[room.currentTurnIndex];

        if (!player || player.socketId !== socket.id || room.pendingAction) return;

        if (!room.hasRolled) {
            return socket.emit(
                'ERROR',
                'Bạn phải tung xúc xắc trước khi qua lượt!'
            );
        }

        if (player.money < 0) {
            return socket.emit(
                'ERROR',
                'Bạn đang nợ, phải xoay tiền hoặc Phá Sản!'
            );
        }

        room.hasRolled = false;

        do {
            room.currentTurnIndex =
                (room.currentTurnIndex + 1) % room.players.length;
        } while (room.players[room.currentTurnIndex].bankrupt);

        const nextPlayer = room.players[room.currentTurnIndex];

        io.to(roomId).emit(
            'MESSAGE',
            `▶️ Tới lượt của: ${nextPlayer.name}`
        );

        broadcastState(roomId, room);
    });

    socket.on('disconnect', () => {
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            const player = room.players.find((p) => p.socketId === socket.id);

            if (!player) continue;

            player.disconnected = true;

            if (room.status === 'WAITING') {
                room.players = room.players.filter((p) => p.socketId !== socket.id);
            }

            const onlinePlayers = room.players.filter((p) => !p.disconnected);

            if (onlinePlayers.length === 0) {
                delete gameRooms[roomId];
            } else {
                io.to(roomId).emit(
                    'MESSAGE',
                    `🔴 ${player.name} đã mất kết nối...`
                );
                broadcastState(roomId, room);
            }
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Monopoly Backend running on 0.0.0.0:${port}`);
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
