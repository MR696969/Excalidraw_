import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from '@repo/backend-common/config';
import { middleware } from "./middleware";
import { CreateUserSchema, SigninSchema, CreateRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(cors())

app.post("/signup", async (req, res) => {

    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
        console.log(parsedData.error);
        res.status(400).json({
            message: "Incorrect inputs"
        })
        return;
    }
    try {
        const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);
        const user = await prismaClient.user.create({
            data: {
                email: parsedData.data.username,
                password: hashedPassword,
                name: parsedData.data.name
            }
        })
        res.status(201).json({
            userId: user.id
        })
    } catch(e) {
        res.status(411).json({
            message: "User already exists with this email"
        })
    }
})

app.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Incorrect inputs"
        })
        return;
    }

    try {
        const user = await prismaClient.user.findFirst({
            where: {
                email: parsedData.data.username
            }
        })

        if (!user) {
            res.status(401).json({
                message: "Invalid email or password"
            })
            return;
        }

        const passwordMatch = await bcrypt.compare(parsedData.data.password, user.password);
        if (!passwordMatch) {
            res.status(401).json({
                message: "Invalid email or password"
            })
            return;
        }

        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET, { expiresIn: "24h" });

        res.json({
            token
        })
    } catch (e) {
        res.status(500).json({
            message: "Internal server error"
        })
    }
})

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Incorrect inputs"
        })
        return;
    }
    
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({
            message: "Unauthorized"
        })
        return;
    }

    try {
        const room = await prismaClient.room.create({
            data: {
                slug: parsedData.data.name,
                adminId: userId
            }
        })

        res.status(201).json({
            roomId: room.id
        })
    } catch(e) {
        res.status(409).json({
            message: "Room already exists with this name"
        })
    }
})

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        console.log(req.params.roomId);
        const messages = await prismaClient.chat.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "desc"
            },
            take: 1000
        });

        res.json({
            messages
        })
    } catch(e) {
        console.log(e);
        res.json({
            messages: []
        })
    }
    
})

app.get("/room/:slug", async (req, res) => {
    const slug = req.params.slug;
    const room = await prismaClient.room.findFirst({
        where: {
            slug
        }
    });

    res.json({
        room
    })
})

app.listen(PORT, () => {
    console.log(`HTTP Backend running on port ${PORT}`);
});