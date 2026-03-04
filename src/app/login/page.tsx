import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LoginClient from "./login-client";

export default async function LoginPage() {
    // Check if any users exist in the database
    const userCount = await prisma.user.count();

    // If no users exist, mandate that they go to the signup page first
    if (userCount === 0) {
        redirect("/signup");
    }

    // If users do exist, show the login form and hide the signup link
    return <LoginClient hasUsers={userCount > 0} />;
}
