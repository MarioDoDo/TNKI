import { Server } from "socket.io";

const io = new Server(3000, { cors: { origin: '*' } });

const start_positions = [
    { x: 0, y: 0 },
    { x: 11, y: 0 },
    { x: 0, y: 11 },
    { x: 11, y: 11 },
];

class Tank {
    constructor(index) {
        this.x = start_positions[index].x;
        this.y = start_positions[index].y;
        this.dir = 0;
        this.lives = 3;
        this.ammo = 3;
    }

    move(axe, dir) {
        //axe (x||y)
        //

    }


}

const colors = ["red", "green", "blue", "yellow"];
let rooms = {}; //name: {max_player, players:[]}
let map_id_room = {} // id:room

io.on("connection", (socket) => {
    console.info(`Client ${socket.id} connected`)

    socket.on("create_room", (msg) => {
        let data = JSON.parse(msg);

        if (!rooms[data.room]) {
            rooms[data.room] = {
                max_player: data.max_player,
                players: [socket.id]
            }
            map_id_room[socket.id] = data.room;
            socket.join(data.room);
            io.to(socket.id).emit("join_room", JSON.stringify({ player_index: 0, room: data.room, max_player: data.max_player }));
        } else {
            io.to(socket.id).emit("error", JSON.stringify({ message: "Room already exists" }));
        }
    })

    socket.on("join_room", (room) => {
        if (!rooms[room]) {
            return;
        }
        let player_count = rooms[room].players.length;
        if (player_count < rooms[room].max_player) {
            rooms[room].players = rooms[room].players.concat(socket.id);
            map_id_room[socket.id] = room;
            socket.join(room);
            io.to(socket.id).emit("join_room", JSON.stringify({ player_index: player_count, room: room, max_player: rooms[room].max_player }));
            io.to(room).emit("new_player", JSON.stringify({ player_count: player_count + 1 }));
        }
        console.log(rooms);
    })

    socket.on("start_room", (room) => {
        io.to(room).emit("start_room");
    })

    socket.on('disconnect', () => {
        let room = map_id_room[socket.id]
        if (!room) {
            return;
        }
        rooms[room].players = rooms[room].players.filter(player => player != socket.id);
        if (rooms[room].players.length == 0) {
            delete rooms[room];
        }
        delete map_id_room[socket.id];
        console.info(`Client gone [id=${socket.id}]`);
    });

    socket.on("update", (msg) => {
        let room = map_id_room[socket.id]

        io.to(room).emit("update", msg);
    })

    socket.on("shot", (msg) => {
        let room = map_id_room[socket.id]
        console.log("shot")
        io.to(room).emit("shot", msg);
    })

    socket.on("leave_room", (msg) => {
        let id = JSON.parse(msg).id;
        let room = map_id_room[id];

        io.to(room).emit("leave_room", JSON.stringify({ id: id }));
        socket.leave(room);

        if (room) {
            rooms[room].players = rooms[room].players.filter(x => x != id);
            delete map_id_room[id];

            if (rooms[room].players.length == 0) {
                delete rooms[room];
            }
        }
    })

});