require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
    try {
        const password = await bcrypt.hash("admin123", 10);
        const user = await prisma.user.upsert({
            where: { email: "admin@example.com" },
            update: {
                hashedPassword: password,
                role: "ADMIN"
            },
            create: {
                email: "admin@example.com",
                name: "University Admin",
                role: "ADMIN",
                hashedPassword: password,
            }
        });
        console.log("Admin user created:", user.email, "Password: admin123");
    } catch (err) {
        console.error("Error creating user:", err);
        process.exit(1);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    });
