
import { PrismaClient } from "@prisma/client";
import { adapter } from "../prisma/adapter";

export const prismaClient = new PrismaClient({ adapter });
