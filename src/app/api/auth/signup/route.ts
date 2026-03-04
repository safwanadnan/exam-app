import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine if this is the very first user in the system
        const userCount = await prisma.user.count();
        const role = userCount === 0 ? 'ADMIN' : 'MANAGER'; // Default to MANAGER if not first user

        // Create the user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                hashedPassword,
                role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            }
        });

        return NextResponse.json(user, { status: 201 });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
