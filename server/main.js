import { Server } from "socket.io";

const map = [
    [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
];

const colors = ["red", "green", "blue", "yellow"];

const start_positions = [
    { x: 0, y: 0, dir: 2 },
    { x: 11, y: 0, dir: 2 },
    { x: 0, y: 11, dir: 0 },
    { x: 11, y: 11, dir: 0 },
];

const map_key_value = new Map([
    ["ArrowUp", { x: 0, y: -1, dir: 0 }],
    ["ArrowLeft", { x: -1, y: 0, dir: 1 }],
    ["ArrowDown", { x: 0, y: 1, dir: 2 }],
    ["ArrowRight", { x: 1, y: 0, dir: 3 }],
]);

const rooms = new Map();
const map_id_room = new Map();

class Room {
    started = false;
    tanks = new Map();

    constructor(id, tank, max_players, room_name) {
        this.admin = id;
        this.max_players = max_players;
        this.room_name = room_name;

        this.tanks.set(id, tank);
        map_id_room.set(id, room_name);
    }

    join(id, tank) {
        this.tanks.set(id, tank);
        map_id_room.set(id, this.room_name);
    }

    kick(id) {
        this.tanks.delete(id);

        map_id_room.delete(id);

        if (this.tanks_length() === 0) {
            rooms.delete(this.room_name);
        }
    }

    tanks_length() {
        return this.tanks.size;
    }

    refill_ammo() {
        const ammo_status_update = new Map();
        this.tanks.forEach(tank => {
            if (tank.ammo < 3) {
                tank.ammo++;
            }
            ammo_status_update.set(tank.id, tank.ammo);
        })
        return ammo_status_update;
    }

}

class Tank {
    constructor(index, player_name, id) {
        this.x = start_positions[index].x;
        this.y = start_positions[index].y;
        this.dir = start_positions[index].dir;
        this.color = colors[index];
        this.player_name = player_name;
        this.lives = 3;
        this.ammo = 3;
        this.index = index;
        this.id = id;
    }

    validate_move(coords) {
        return coords.every(coord => coord >= 0 && coord <= 11) && !map[coords[1]][coords[0]];
    }

    move(key, shift) {
        const action = map_key_value.get(key);

        if (shift) {
            this.dir = action.dir;
            return [{ property: "dir", value: this.dir }];
        }

        if (this.validate_move([this.x + action.x, this.y + action.y])) {
            this.x += action.x;
            this.y += action.y;
            this.dir = action.dir;

            return [{ property: "x", value: this.x }, { property: "y", value: this.y }, { property: "dir", value: this.dir }];
        }

        return false;
    }

    shoot() {
        if (this.ammo == 0) {
            return;
        }
        this.ammo--;

        let first_baricade = -1, column, shot = {};
        const hits = [];
        switch (this.dir) {
            case 0:
                column = map.reduce((a, b) => a.concat(b[this.x]), []);

                for (let i = column.length - 1; i >= 0; i--) {
                    if (i < this.y && column[i] == 1) {
                        first_baricade = i;
                        break;
                    }

                    rooms.get(map_id_room.get(this.id)).tanks.forEach((tank) => {
                        if (tank.x === this.x && tank.y === i && tank.id !== this.id) {
                            tank.hit();
                            hits.push({ id: tank.id, lives: tank.lives, x: tank.x, y: tank.y });
                        }
                    });
                }

                shot.start_x = this.x;
                shot.start_y = first_baricade + 1;
                shot.end_x = this.x;
                shot.end_y = this.y;
                shot.horizontal = false;
                shot.dir_to_scene_start = true;

                return { path: shot, hits: hits };
            case 1:
                for (let i = map[this.y].length - 1; i >= 0; i--) {
                    if (i < this.x && map[this.y][i] == 1) {
                        first_baricade = i;
                        break;
                    }

                    rooms.get(map_id_room.get(this.id)).tanks.forEach((tank) => {
                        if (tank.x === i && tank.y === this.y && tank.id !== this.id) {
                            tank.hit();
                            hits.push({ id: tank.id, lives: tank.lives, x: tank.x, y: tank.y });
                        }
                    });
                }

                shot.start_x = first_baricade + 1;
                shot.start_y = this.y;
                shot.end_x = this.x;
                shot.end_y = this.y;
                shot.horizontal = true;
                shot.dir_to_scene_start = true;

                return { path: shot, hits: hits };
            case 2:
                column = map.reduce((a, b) => a.concat(b[this.x]), []);

                for (let i = 0; i < column.length; i++) {
                    if (i > this.y && column[i] == 1) {
                        first_baricade = i;
                        break;
                    }

                    rooms.get(map_id_room.get(this.id)).tanks.forEach((tank) => {
                        if (tank.x === this.x && tank.y === i && tank.id !== this.id) {
                            tank.hit();
                            hits.push({ id: tank.id, lives: tank.lives, x: tank.x, y: tank.y });
                        }
                    });

                }

                shot.start_x = this.x;
                shot.start_y = this.y;
                shot.end_x = this.x;
                shot.end_y = first_baricade === -1 ? 11 : first_baricade - 1;
                shot.horizontal = false;
                shot.dir_to_scene_start = false;

                return { path: shot, hits: hits };
            case 3:
                first_baricade = map[this.y].findIndex((_, i) => {
                    return i > this.x && map[this.y][i] == 1;
                });
                first_baricade = first_baricade == -1 ? 12 : first_baricade;

                for (let i = 0; i < map[this.y].length; i++) {
                    if (i > this.x && map[this.y][i] == 1) {
                        first_baricade = i;
                        break;
                    }

                    rooms.get(map_id_room.get(this.id)).tanks.forEach((tank) => {
                        if (tank.x === i && tank.y === this.y && tank.id !== this.id) {
                            tank.hit();
                            hits.push({ id: tank.id, lives: tank.lives, x: tank.x, y: tank.y });
                        }
                    });
                }

                shot.start_x = this.x;
                shot.start_y = this.y;
                shot.end_x = first_baricade === -1 ? 11 : first_baricade - 1;
                shot.end_y = this.y;
                shot.horizontal = true;
                shot.dir_to_scene_start = false;

                return { path: shot, hits: hits };
        }


    }

    hit() {
        this.lives--;
        if (this.lives === 0) {
            const room = rooms.get(map_id_room.get(this.id));

            room.kick(this.id);
            io.to(this.id).emit("lost");

            io.to(room.room_name).emit("player_left", { player_id: this.id });

            io.in(this.id).socketsLeave(room.room_name);

            if (room.tanks_length() == 1) {
                io.to(room.room_name).emit("win");

                io.in(room.room_name).fetchSockets().then(sockets => {
                    for (const socket of sockets) {
                        rooms.get(map_id_room.get(socket.id)).kick(socket.id);
                    }
                });
            }
        }
    }
}

const io = new Server(3000, { cors: { origin: '*' } });

setInterval(() => {
    rooms.forEach(room => {
        room.refill_ammo();
    })
    rooms.forEach(room => {
        if (room.started) {
            io.to(room.room_name).emit("ammo_updated", { refill: true });
        }
    })
}, 5000);

io.on("connection", (socket) => {
    socket.on("create_room", (msg) => {
        if (rooms.has(msg.room_name)) {
            socket.emit("error", { message: "Room with this name already exists" });
            return;
        }

        if (msg.room_name.length > 10) {
            socket.emit("error", { message: "Maximum room name length is 10!" });
            return;
        }

        if (msg.player_name.length > 10) {
            socket.emit("error", { message: "Maximum player name length is 10!" });
            return;
        }

        const admin_tank = new Tank(0, msg.player_name, socket.id);

        rooms.set(msg.room_name, new Room(socket.id, admin_tank, msg.max_players, msg.room_name));

        socket.join(msg.room_name);

        socket.emit("room_joined", { player_index: 0, room_name: msg.room_name, max_players: msg.max_players });
    });

    socket.on("join_room", (msg) => {
        const room = rooms.get(msg.room_name);

        if (!room) {
            socket.emit("error", { message: "Room with this name doesn't exist! You can create one." });
            return;
        }

        if (room.started) {
            socket.emit("error", { message: "Room already started!" });
            return;
        }

        if (room.tanks_length() == room.max_players) {
            socket.emit("error", { message: "Room is full!" });
            return;
        }

        if (msg.player_name.length > 10) {
            socket.emit("error", { message: "Maximum player name length is 10" });
            return;
        }

        const new_tank = new Tank(room.tanks_length(), msg.player_name, socket.id);

        room.join(socket.id, new_tank);

        socket.join(msg.room_name);

        socket.emit("room_joined", { player_index: new_tank.index, room_name: msg.room_name, max_players: room.max_players });

        io.to(msg.room_name).emit("update_players", { player_count: room.tanks_length(), max_players: room.max_players });
    })

    socket.on("leave_room", () => {
        const room = rooms.get(map_id_room.get(socket.id));

        if (!room) {
            return;
        }

        room.kick(socket.id);
        io.to(room.room_name).emit("update_players", { player_count: room.tanks_length(), max_players: room.max_players });
    });

    socket.on("start_room", () => {
        const room = rooms.get(map_id_room.get(socket.id));

        if (room.admin !== socket.id) {
            socket.emit("error", { message: "Only room creator can start the room!" });
            return;
        }

        room.started = true;
        io.to(room.room_name).emit("room_started", { tanks: [...room.tanks.entries()], map: map, room_name: room.room_name });
    });

    socket.on("update_move", (msg) => {
        const room = rooms.get(map_id_room.get(socket.id));
        const tank = room.tanks.get(socket.id);

        const update_msg = tank.move(msg.key, msg.shift);

        if (update_msg) {
            io.to(room.room_name).emit("move_updated", { id: socket.id, update: update_msg });
        }
    });

    socket.on("update_shoot", () => {
        const room = rooms.get(map_id_room.get(socket.id));
        const tank = room.tanks.get(socket.id);

        const update_msg = tank.shoot();

        if (update_msg) {
            io.to(room.room_name).emit("shoot_updated", update_msg);
            io.to(room.room_name).emit("ammo_updated", { tank_id: tank.id, ammo: tank.ammo });
        }
    });

    socket.on('disconnect', () => {
        const room = rooms.get(map_id_room.get(socket.id));

        if (!room) {
            return;
        }

        room.kick(socket.id);
        io.to(room.room_name).emit("player_left", { player_id: socket.id });

        if (room.tanks_length() === 1) {
            io.to(room.room_name).emit("win");
        }
    });
});